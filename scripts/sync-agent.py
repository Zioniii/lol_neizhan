"""
sync-agent: 本地 LCU 同步推送脚本（支持自动检测模式）

功能:
  - 一次性模式: 连接 LCU 拉取 SGP 数据推送到服务器，然后退出
  - 监听模式 (--watch): 常驻后台，自动检测 LCU 重启/换号，有新会话就自动同步

用法:
    # 一次性同步
    python scripts/sync-agent.py --server http://your-server.com:8766

    # 常驻后台，自动检测
    python scripts/sync-agent.py --server http://your-server.com:8766 --watch

    # 限制范围
    python scripts/sync-agent.py --server http://localhost:8766 --summoner-id 1 2 3 --days 30

环境变量:
    SERVER_URL  服务器地址 (默认 http://localhost:8766)
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.lcu import LcuManager, SgpClient, TENCENT_SERVERS, SERVER_NAMES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sync-agent] %(levelname)s %(message)s",
)
logger = logging.getLogger("sync-agent")

# 抑制 httpx 请求日志
logging.getLogger("httpx").setLevel(logging.WARNING)

PUSH_TIMEOUT = 60.0
SGP_PAGE_SIZE = 200
SGP_MAX_PAGES = 5


def parse_args():
    parser = argparse.ArgumentParser(description="LOL 内战系统 - 本地战绩同步推送代理")
    parser.add_argument(
        "--server",
        default=os.getenv("SERVER_URL", "http://localhost:8766"),
        help="服务器地址 (默认 http://localhost:8766)",
    )
    parser.add_argument(
        "--summoner-id",
        type=int,
        nargs="*",
        default=None,
        help="限定同步的选手 ID，不传则同步所有活跃选手",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="仅同步最近 N 天的对局 (默认不限)",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="监听模式：常驻后台，自动检测 LCU 会话变化并同步",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=2,
        help="监听模式下轮询间隔秒数 (默认 2)",
    )
    return parser.parse_args()


def get_server_summoners(server_url: str, summoner_ids: list[int] | None) -> list[dict]:
    """从服务器获取选手列表"""
    url = f"{server_url}/api/summoners"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    all_summoners = resp.json()

    if summoner_ids:
        id_set = set(summoner_ids)
        all_summoners = [s for s in all_summoners if s["id"] in id_set]

    active = [s for s in all_summoners if s.get("is_active")]
    return active


def resolve_missing_puuid(lcu: LcuManager, server_url: str, summoners: list[dict]) -> list[dict]:
    """解析缺少 PUUID 的选手并更新到服务器"""
    updated = []
    for s in summoners:
        if s.get("puuid"):
            updated.append(s)
            continue
        try:
            puuid = lcu.resolve_puuid(s["game_name"], s["tag_line"])
            if puuid:
                s["puuid"] = puuid
                httpx.put(
                    f"{server_url}/api/summoners/{s['id']}/puuid",
                    json={"puuid": puuid},
                    timeout=10,
                )
                logger.info(f"  已解析 PUUID for {s['nickname']}: {puuid}")
        except Exception as e:
            logger.warning(f"  无法解析 PUUID for {s['nickname']}: {e}")
        updated.append(s)
    return updated


def push_games(server_url: str, server_id: str, region: str, games: list[dict]) -> dict:
    """推送一批对局数据到服务器"""
    url = f"{server_url}/api/sync/push"
    payload = {
        "server_id": server_id,
        "region": region,
        "games": games,
    }
    resp = httpx.post(url, json=payload, timeout=PUSH_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def run_sync(lcu: LcuManager, server_url: str, summoner_ids: list[int] | None, days: int | None) -> bool:
    """
    完整同步流程：拉 SGP 数据并推送到服务器。
    返回 True 表示至少推送了数据，False 表示无数据或失败。
    """
    # 获取 token
    try:
        entitle_token, session_token = lcu.get_tokens()
    except Exception as e:
        logger.error(f"获取 JWT token 失败: {e}")
        return False

    # 获取选手列表
    try:
        summoners = get_server_summoners(server_url, summoner_ids)
    except Exception as e:
        logger.error(f"获取选手列表失败: {e}")
        return False

    # 解析缺少 PUUID 的选手
    try:
        summoners = resolve_missing_puuid(lcu, server_url, summoners)
        summoners = [s for s in summoners if s.get("puuid")]
    except Exception as e:
        logger.warning(f"PUUID 解析异常: {e}")

    if not summoners:
        logger.warning("没有需要同步的选手（缺少 PUUID 且无法解析）")
        return False

    # 初始化 SGP 客户端
    sgp = SgpClient(entitle_token, session_token)

    # 日期过滤
    date_filter_ts = None
    if days:
        date_filter_ts = int(
            (datetime.utcnow() - timedelta(days=days)).timestamp() * 1000
        )

    total_pushed = 0
    total_skipped = 0
    has_any = False

    for s in summoners:
        puuid = s["puuid"]
        nickname = s["nickname"]
        riot_id = f"{s['game_name']}#{s['tag_line']}"

        logger.info(f"同步 [{nickname}]({riot_id})")

        for srv_id in TENCENT_SERVERS:
            region_name = SERVER_NAMES.get(srv_id, srv_id)
            try:
                all_games = []
                for page in range(SGP_MAX_PAGES):
                    gd = sgp.get_match_history(
                        srv_id, puuid, page * SGP_PAGE_SIZE, SGP_PAGE_SIZE
                    )
                    page_games = gd.get("games", [])
                    if not page_games:
                        break

                    if date_filter_ts:
                        page_games = [
                            g for g in page_games
                            if g.get("json", {}).get("gameCreation", 0) >= date_filter_ts
                        ]

                    all_games.extend(page_games)
                    if len(page_games) < SGP_PAGE_SIZE:
                        break

                if not all_games:
                    continue

                has_any = True
                result = push_games(server_url, srv_id, region_name, all_games)
                pushed = result.get("total_pushed", 0)
                skipped = result.get("total_skipped", 0)
                total_pushed += pushed
                total_skipped += skipped
                logger.info(f"  [{region_name}] 推送 {len(all_games)} 场 → 新增 {pushed} 场")

            except httpx.HTTPStatusError as e:
                logger.warning(f"  [{region_name}] 推送失败 (HTTP {e.response.status_code})")
                continue
            except Exception as e:
                logger.warning(f"  [{region_name}] 查询失败: {e}")
                continue

    if has_any:
        logger.info(f"本轮同步完成: 新增 {total_pushed} 场, 跳过 {total_skipped} 场")
    return has_any


def _make_session_key(lcu: LcuManager) -> str | None:
    """生成当前 LCU 会话的唯一标识，用于检测变化"""
    if not lcu._auth:
        return None
    a = lcu._auth
    return f"{a.pid}:{a.port}:{a.riot_client_port}"


def do_watch(args):
    """监听模式：常驻后台，检测 LCU 会话变化后自动同步"""
    server_url = args.server.rstrip("/")
    logger.info(f"启动监听模式 (轮询间隔 {args.interval}s)")
    logger.info(f"服务器: {server_url}")

    last_key = None
    warned_no_lcu = False

    while True:
        lcu = LcuManager()
        if not lcu.refresh():
            if not warned_no_lcu:
                logger.info("等待 League Client 启动...")
                warned_no_lcu = True
            last_key = None
            time.sleep(args.interval)
            continue

        warned_no_lcu = False

        # 轮询服务器待办（自定义房间消息等）
        try:
            resp = httpx.get(f"{server_url}/api/sync/pending-chat", timeout=5)
            pd = resp.json()
            chat_msg = pd.get("chat_message")
            if chat_msg:
                logger.info("收到待发送的房间消息")
                lcu.send_custom_game_chat(chat_msg)
        except Exception as e:
            logger.warning(f"轮询待办失败: {e}")

        current_key = _make_session_key(lcu)

        if current_key == last_key:
            # 同一 LCU 进程，跳过（仍能确保启动后有初始同步）
            time.sleep(args.interval)
            continue

        # 新会话或初始启动
        if last_key is None:
            logger.info("检测到 League Client，开始首次同步...")
        else:
            logger.info("检测到 LCU 会话变化（客户端重启/换号），重新同步...")

        # 等待 LCU 完全就绪（刚启动时 token 可能还没准备好）
        for retry in range(30):
            try:
                lcu.get_tokens()
                break
            except Exception:
                if retry == 0:
                    logger.info("等待 LCU 就绪...")
                time.sleep(2)
        else:
            logger.warning("LCU 就绪超时，将在下一轮重试")
            last_key = None
            time.sleep(args.interval)
            continue

        run_sync(lcu, server_url, args.summoner_id, args.days)
        last_key = current_key
        logger.info(f"监听中，每 {args.interval}s 检测会话变化...")


def main():
    args = parse_args()
    server_url = args.server.rstrip("/")

    if args.watch:
        do_watch(args)
        return

    # 一次性模式
    logger.info("正在检测本地 League Client...")
    lcu = LcuManager()
    if not lcu.refresh():
        logger.error("未检测到 League Client，请先启动 LOL 客户端并登录")
        sys.exit(1)

    logger.info(f"LCU 已连接 (is_tencent={lcu.is_tencent})")

    start = time.time()
    run_sync(lcu, server_url, args.summoner_id, args.days)
    elapsed = time.time() - start
    logger.info(f"总耗时 {elapsed:.1f}s")


if __name__ == "__main__":
    main()

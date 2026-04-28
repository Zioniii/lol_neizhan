import logging
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Summoner, GameRecord, SyncLog, Match, MatchParticipant
from ..schemas import SyncRequest, SyncLogOut, SyncPushRequest, SyncPushResponse
from ..lcu import LcuManager, SgpClient, TENCENT_SERVERS, SERVER_NAMES
from ..champion_map import to_chinese

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync", tags=["sync"])

# 手动同步触发标记（agent 轮询用）
_manual_sync_pending = False

# 待发送的自定义房间消息（agent 负责实际发送，因为 agent 有 LCU 访问权限）
_pending_chat_message: str | None = None


def set_pending_chat_message(msg: str) -> None:
    """设置待发送的自定义房间消息，由 agent 轮询取走"""
    global _pending_chat_message
    _pending_chat_message = msg


def get_lcu() -> LcuManager:
    from ..main import lcu_manager
    return lcu_manager


def _parse_timestamp(ts: int) -> datetime:
    """Riot timestamp (毫秒) → 北京时间 (UTC+8)"""
    return datetime.utcfromtimestamp(ts / 1000) + timedelta(hours=8)


def _count_pool_players(participants: list, puuid_to_sid: dict) -> int:
    """统计参与者中有多少是池子里的固定选手"""
    count = 0
    for p in participants:
        p_puuid = (p.get("puuid") or "").lower()
        if p_puuid and p_puuid in puuid_to_sid:
            count += 1
    return count


@router.get("/status")
def sync_status(db: Session = Depends(get_db), lcu: LcuManager = Depends(get_lcu)):
    summoners = db.query(Summoner).filter(Summoner.is_active == True).all()
    result = []
    for s in summoners:
        last_log = (
            db.query(SyncLog)
            .filter(SyncLog.summoner_id == s.id)
            .order_by(SyncLog.sync_start.desc())
            .first()
        )
        total_records = db.query(GameRecord).filter(GameRecord.summoner_id == s.id).count()
        result.append({
            "summoner_id": s.id,
            "riot_id": f"{s.game_name}#{s.tag_line}",
            "nickname": s.nickname,
            "puuid": s.puuid,
            "total_games_synced": total_records,
            "last_sync": last_log.sync_start.isoformat() if last_log else None,
            "last_sync_status": last_log.status if last_log else None,
        })
    return {
        "lcu_connected": lcu.connected,
        "summoners": result,
    }


@router.get("/logs", response_model=list[SyncLogOut])
def list_sync_logs(db: Session = Depends(get_db)):
    logs = (
        db.query(SyncLog)
        .order_by(SyncLog.sync_start.desc())
        .limit(50)
        .all()
    )
    result = []
    for log in logs:
        result.append(
            SyncLogOut(
                id=log.id,
                summoner_id=log.summoner_id,
                summoner_nickname=log.summoner.nickname,
                sync_start=log.sync_start,
                sync_end=log.sync_end,
                games_fetched=log.games_fetched,
                status=log.status,
                error_message=log.error_message,
            )
        )
    return result


@router.post("")
def sync_match_history(
    req: SyncRequest,
    db: Session = Depends(get_db),
    lcu: LcuManager = Depends(get_lcu),
):
    if not lcu.connected:
        raise HTTPException(503, "LCU 未连接，请启动 LOL 客户端后再同步")

    # 获取 JWT token
    try:
        entitle_token, session_token = lcu.get_tokens()
    except Exception as e:
        raise HTTPException(503, f"获取 JWT token 失败: {e}")

    sgp = SgpClient(entitle_token, session_token)

    # 确定要同步的选手
    if req.summoner_ids:
        summoners = (
            db.query(Summoner)
            .filter(Summoner.id.in_(req.summoner_ids), Summoner.is_temporary == False)
            .all()
        )
    else:
        summoners = db.query(Summoner).filter(Summoner.is_active == True).all()

    if not summoners:
        raise HTTPException(400, "没有找到要同步的选手")

    # 解析日期过滤
    start_ts = None
    end_ts = None
    if req.start_date:
        start_ts = int(datetime.strptime(req.start_date, "%Y-%m-%d").timestamp() * 1000)
    if req.end_date:
        end_dt = datetime.strptime(req.end_date, "%Y-%m-%d") + timedelta(days=1)
        end_ts = int(end_dt.timestamp() * 1000)

    # 构建池子 PUUID → summoner 映射（用于补全其他选手数据）
    puuid_to_sid = {}
    sid_to_info = {}
    for s in db.query(Summoner).all():
        sid_to_info[s.id] = s
        if s.puuid:
            puuid_to_sid[s.puuid.lower()] = s.id

    results = []
    for summoner in summoners:
        log = SyncLog(
            summoner_id=summoner.id,
            sync_start=datetime.utcnow(),
            status="running",
        )
        db.add(log)
        db.flush()
        log_id = log.id

        total_fetched = 0
        error_msg = None

        try:
            # 确保 PUUID 已解析
            if not summoner.puuid:
                puuid = lcu.resolve_puuid(summoner.game_name, summoner.tag_line)
                if puuid:
                    summoner.puuid = puuid
                    puuid_to_sid[puuid.lower()] = summoner.id
                    db.flush()
                else:
                    raise Exception("无法解析 PUUID，请确认 Riot Client 已登录")

            # 遍历所有腾讯区服
            for srv_id in TENCENT_SERVERS:
                try:
                    # 分页拉取，每区最多 1000 场（5 页）
                    all_games = []
                    for page in range(5):
                        gd = sgp.get_match_history(srv_id, summoner.puuid, page * 200, 200)
                        page_games = gd.get("games", [])
                        if not page_games:
                            break
                        all_games.extend(page_games)
                        if len(page_games) < 200:
                            break
                    games = all_games

                    for g in games:
                        json_data = g.get("json", {})
                        participants = json_data.get("participants", [])

                        # 内战判定：总人数≥6，且两边都必须有固定选手
                        if len(participants) < 6:
                            continue
                        team_has_pool = {}
                        for p in participants:
                            p_puuid = (p.get("puuid") or "").lower()
                            is_pool = bool(p_puuid and p_puuid in puuid_to_sid)
                            tid = p.get("teamId")
                            if tid is not None:
                                if tid not in team_has_pool:
                                    team_has_pool[tid] = is_pool
                                else:
                                    team_has_pool[tid] = team_has_pool[tid] or is_pool
                        if not all(team_has_pool.values()):
                            continue
                        riot_game_id = str(json_data.get("gameId", ""))
                        game_creation = json_data.get("gameCreation", 0)

                        # 日期过滤
                        if start_ts and game_creation < start_ts:
                            continue
                        if end_ts and game_creation > end_ts:
                            continue

                        region_name = SERVER_NAMES.get(srv_id, srv_id)

                        # 英雄名转中文（raw_data 也一并转）
                        for p in participants:
                            en = p.get("championName", "")
                            if en:
                                p["championName"] = to_chinese(en)

                        # 为每个池子选手创建/补全 GameRecord
                        for p in participants:
                            p_puuid = p.get("puuid", "").lower()
                            if not p_puuid:
                                continue

                            target_sid = puuid_to_sid.get(p_puuid)
                            if target_sid is None:
                                continue  # 不是池子选手，跳过

                            # 去重
                            existing = (
                                db.query(GameRecord)
                                .filter(
                                    GameRecord.riot_game_id == riot_game_id,
                                    GameRecord.summoner_id == target_sid,
                                )
                                .first()
                            )
                            if existing:
                                continue

                            record = GameRecord(
                                riot_game_id=riot_game_id,
                                summoner_id=target_sid,
                                champion_name=to_chinese(p.get("championName", "")),
                                win=p.get("win"),
                                kills=p.get("kills", 0),
                                deaths=p.get("deaths", 0),
                                assists=p.get("assists", 0),
                                game_duration=json_data.get("gameDuration", 0),
                                game_creation=_parse_timestamp(game_creation)
                                if game_creation
                                else None,
                                participants_count=len(participants),
                                region=region_name,
                                raw_data=json_data,
                            )
                            db.add(record)
                            total_fetched += 1

                except Exception as e:
                    # 某个区服查询失败，继续查其他区
                    logger.warning(f"查询区服 {srv_id} 失败: {e}")
                    continue

            log.status = "done"
            log.games_fetched = total_fetched

        except Exception as e:
            log.status = "failed"
            error_msg = str(e)
            log.error_message = error_msg

        log.sync_end = datetime.utcnow()
        log.games_fetched = total_fetched
        db.commit()

        results.append({
            "games_fetched": total_fetched,
            "error": error_msg,
        })

    return {
        "total_games_synced": sum(r["games_fetched"] for r in results),
        "status": "done" if not any(r["error"] for r in results) else "failed",
        "error": next((r["error"] for r in results if r["error"]), None),
    }


@router.post("/push", response_model=SyncPushResponse)
def push_sync_data(
    req: SyncPushRequest,
    db: Session = Depends(get_db),
):
    """sync-agent 推送接口：接收本地拉取的 SGP 数据，无需 LCU 校验，只做数据入库"""
    # 构建池子 PUUID → summoner 映射
    puuid_to_sid = {}
    for s in db.query(Summoner).all():
        if s.puuid:
            puuid_to_sid[s.puuid.lower()] = s.id

    total_pushed = 0
    total_skipped = 0

    for game in req.games:
        json_data = game.get("json", game)  # 兼容 SGP 嵌套格式和直接格式
        participants = json_data.get("participants", [])
        if not participants:
            total_skipped += 1
            continue

        # 内战判定：人数≥6，且两边都有固定选手
        if len(participants) < 6:
            total_skipped += 1
            continue

        team_has_pool = {}
        for p in participants:
            p_puuid = (p.get("puuid") or "").lower()
            is_pool = bool(p_puuid and p_puuid in puuid_to_sid)
            tid = p.get("teamId")
            if tid is not None:
                if tid not in team_has_pool:
                    team_has_pool[tid] = is_pool
                else:
                    team_has_pool[tid] = team_has_pool[tid] or is_pool
        if not all(team_has_pool.values()):
            total_skipped += 1
            continue

        riot_game_id = str(json_data.get("gameId", ""))
        game_creation = json_data.get("gameCreation", 0)
        game_duration = json_data.get("gameDuration", 0)

        # 英雄名转中文
        for p in participants:
            en = p.get("championName", "")
            if en:
                p["championName"] = to_chinese(en)

        # 为每个池子选手创建/补全 GameRecord
        game_pushed = 0
        for p in participants:
            p_puuid = p.get("puuid", "").lower()
            if not p_puuid:
                continue
            target_sid = puuid_to_sid.get(p_puuid)
            if target_sid is None:
                continue

            # 去重
            existing = (
                db.query(GameRecord)
                .filter(
                    GameRecord.riot_game_id == riot_game_id,
                    GameRecord.summoner_id == target_sid,
                )
                .first()
            )
            if existing:
                continue

            record = GameRecord(
                riot_game_id=riot_game_id,
                summoner_id=target_sid,
                champion_name=to_chinese(p.get("championName", "")),
                win=p.get("win"),
                kills=p.get("kills", 0),
                deaths=p.get("deaths", 0),
                assists=p.get("assists", 0),
                game_duration=game_duration,
                game_creation=_parse_timestamp(game_creation) if game_creation else None,
                participants_count=len(participants),
                region=req.region,
                raw_data=json_data,
            )
            db.add(record)
            game_pushed += 1

        if game_pushed > 0:
            total_pushed += 1
        else:
            total_skipped += 1

    db.commit()

    return SyncPushResponse(
        total_pushed=total_pushed,
        total_skipped=total_skipped,
        message=f"成功入库 {total_pushed} 场对局，跳过 {total_skipped} 场",
    )


@router.post("/trigger")
def trigger_manual_sync():
    """网页手动触发：通知 agent 执行一次同步"""
    global _manual_sync_pending
    _manual_sync_pending = True
    return {"ok": True, "message": "已通知 agent 同步"}


@router.get("/pending")
def check_pending_sync():
    """agent 轮询：是否有手动同步请求（读取后自动清除）"""
    global _manual_sync_pending
    pending = _manual_sync_pending
    if pending:
        _manual_sync_pending = False
    return {"pending": pending, "chat_message": _pending_chat_message}


@router.get("/pending-chat")
def check_pending_chat():
    """agent 轮询：是否有待发送的房间消息（读取后自动清除）"""
    global _pending_chat_message
    msg = _pending_chat_message
    if msg:
        _pending_chat_message = None
    return {"chat_message": msg}


@router.post("/pending-chat")
def resend_pending_chat(match_id: int, db: Session = Depends(get_db)):
    """前端手动触发：重新发送指定内战场次的分组结果到自定义房间"""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "内战记录不存在")

    blue_names: list[str] = []
    red_names: list[str] = []
    for mp in match.participants:
        nickname = mp.summoner.nickname + (" (临时)" if mp.summoner.is_temporary else "")
        if mp.team == 0:
            blue_names.append(nickname)
        else:
            red_names.append(nickname)

    msg = (
        f"────────\n"
        f"【内战管理】分组结果\n"
        f"蓝方 ({len(blue_names)}人): {', '.join(blue_names)}\n"
        f"红方 ({len(red_names)}人): {', '.join(red_names)}"
    )
    set_pending_chat_message(msg)
    return {"ok": True, "message": "已通知 agent 发送"}

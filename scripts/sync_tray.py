"""
LOL Sync Agent - 系统托盘版
双击运行，常驻系统托盘，自动检测 LCU 并同步战绩到服务器。
"""
import os
import sys
import time
import json
import logging
import subprocess
import threading
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pystray
import tkinter as tk
from PIL import Image, ImageDraw

# ── 路径设置 ──
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    APP_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = str(Path(__file__).resolve().parent.parent)
    APP_DIR = str(Path(__file__).resolve().parent)

sys.path.insert(0, BASE_DIR)

# ── 日志文件（带轮转，单文件最大 1MB，保留 3 个备份）──
LOG_FILE = os.path.join(APP_DIR, 'sync-agent.log')
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sync-tray] %(levelname)s %(message)s",
    handlers=[
        RotatingFileHandler(LOG_FILE, maxBytes=1024*1024, backupCount=3, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("sync-tray")
# 抑制 httpx 请求日志，避免每个 HTTP 请求都写一行
logging.getLogger("httpx").setLevel(logging.WARNING)

# ── 配置 ──
CONFIG_FILE = os.path.join(APP_DIR, 'sync-agent.json')
DEFAULT_CONFIG = {
    "server_url": "http://localhost:8766",
    "poll_interval": 2,
    "sync_interval_minutes": 10,
}


def load_config() -> dict:
    if os.path.isfile(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            # 合并默认值（新增字段）
            for k, v in DEFAULT_CONFIG.items():
                cfg.setdefault(k, v)
            return cfg
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)


def save_config(cfg: dict):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# ── 核心逻辑 ──
import httpx
from backend.lcu import LcuManager, SgpClient, TENCENT_SERVERS, SERVER_NAMES

PUSH_TIMEOUT = 60.0
SGP_PAGE_SIZE = 200
SGP_MAX_PAGES = 5


class SyncWorker:
    def __init__(self, server_url: str, sync_interval_minutes: int = 10):
        self.server_url = server_url.rstrip("/")
        self.sync_interval_minutes = sync_interval_minutes
        self.running = False
        self._thread: threading.Thread | None = None
        self._chat_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        # 状态（供 UI 读取）
        self.lcu_connected = False
        self.summoner_name: str | None = None
        self.last_sync_time: str | None = None
        self.last_sync_result: str = ""
        self.status_text = "就绪"

    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self._chat_thread = threading.Thread(target=self._chat_poll_loop, daemon=True)
        self._chat_thread.start()
        self._gameflow_thread = threading.Thread(target=self._gameflow_loop, daemon=True)
        self._gameflow_thread.start()
        self.status_text = "运行中"

    def stop(self):
        self.running = False
        self._stop_event.set()
        self.status_text = "已停止"

    def _loop(self):
        last_key = None
        last_sync_ts = 0.0

        while not self._stop_event.is_set():
            try:
                lcu = LcuManager()
                if not lcu.refresh():
                    self.lcu_connected = False
                    last_key = None
                    self._stop_event.wait(2)
                    continue

                self.lcu_connected = True

                # 每次循环都刷新当前账号名
                try:
                    data = lcu.get_current_summoner()
                    if data:
                        gn = data.get("gameName") or data.get("displayName") or ""
                        tl = data.get("tagLine") or data.get("internalTag") or ""
                        self.summoner_name = f"{gn}#{tl}" if tl else gn or None
                except Exception:
                    self.summoner_name = None

                # 判定是否需要同步（房间消息轮询已移至独立线程 _chat_poll_loop）
                current_key = self._session_key(lcu)
                now = time.time()
                need_sync = False

                if current_key != last_key:
                    need_sync = True  # 会话变化
                elif now - last_sync_ts >= self.sync_interval_minutes * 60:
                    need_sync = True  # 定时同步
                else:
                    # 检查服务端是否有手动触发
                    try:
                        r = httpx.get(f"{self.server_url}/api/sync/pending", timeout=5)
                        if r.status_code == 200 and r.json().get("pending"):
                            need_sync = True
                    except Exception:
                        pass

                if not need_sync:
                    self._stop_event.wait(2)
                    continue

                # 等待 LCU 就绪
                ready = False
                for _ in range(30):
                    try:
                        lcu.get_tokens()
                        ready = True
                        break
                    except Exception:
                        self._stop_event.wait(2)
                if not ready:
                    last_key = None
                    last_sync_ts = 0.0
                    continue

                self._do_sync(lcu)
                last_key = current_key
                last_sync_ts = time.time()
                self.last_sync_time = datetime.now().strftime("%H:%M:%S")

            except Exception as e:
                logger.error(f"工作线程异常: {e}", exc_info=True)
                self.lcu_connected = False
                self._stop_event.wait(2)

    def _session_key(self, lcu: LcuManager) -> str | None:
        if not lcu._auth:
            return None
        a = lcu._auth
        return f"{a.pid}:{a.port}:{a.riot_client_port}"

    def _chat_poll_loop(self):
        """独立线程：轮询待发送的房间消息，不阻塞同步流程"""
        while not self._stop_event.is_set():
            try:
                # 每次轮询独立检测 LCU
                lcu = LcuManager()
                if not lcu.refresh():
                    self._stop_event.wait(2)
                    continue

                r = httpx.get(f"{self.server_url}/api/sync/pending-chat", timeout=5)
                pd = r.json()
                chat_msg = pd.get("chat_message")
                if chat_msg:
                    logger.info("收到待发送的房间消息")
                    lcu.send_custom_game_chat(chat_msg)
            except Exception as e:
                logger.debug(f"轮询房间消息失败: {e}")
            self._stop_event.wait(2)

    def _gameflow_loop(self):
        """独立线程：轮询 LCU gameflow 状态，检测自定义房间和对局状态"""
        last_phase = None
        while not self._stop_event.is_set():
            try:
                lcu = LcuManager()
                if not lcu.refresh() or not lcu._lcu_http:
                    self._stop_event.wait(2)
                    continue

                r = lcu._lcu_http.get("/lol-gameflow/v1/gameflow-phase")
                if r.status_code != 200:
                    self._stop_event.wait(2)
                    continue

                phase = r.json()

                if phase == "Lobby" and last_phase != "Lobby":
                    try:
                        lobby_r = lcu._lcu_http.get("/lol-lobby/v2/lobby")
                        if lobby_r.status_code == 200:
                            lobby_data = lobby_r.json()
                            game_mode = lobby_data.get("gameConfig", {}).get("gameMode", "")
                            is_custom = game_mode == "CUSTOM"
                            if is_custom:
                                members_r = lcu._lcu_http.get("/lol-lobby/v2/lobby/members")
                                members = members_r.json() if members_r.status_code == 200 else []
                                httpx.post(f"{self.server_url}/api/sync/lobby/update", json={
                                    "is_custom_game": True,
                                    "game_mode": game_mode,
                                    "members": [{
                                        "puuid": m.get("puuid", ""),
                                        "summoner_name": m.get("summonerName", ""),
                                        "game_name": m.get("gameName", ""),
                                        "tag_line": m.get("tagLine", ""),
                                    } for m in members],
                                }, timeout=5)
                                logger.info(f"检测到自定义房间: {len(members)} 人")
                    except Exception as e:
                        logger.debug(f"房间检测失败: {e}")

                elif last_phase == "Lobby" and phase != "Lobby":
                    try:
                        httpx.post(f"{self.server_url}/api/sync/lobby/clear", timeout=5)
                    except Exception:
                        pass

                last_phase = phase
            except Exception as e:
                logger.debug(f"gameflow 轮询异常: {e}")

            self._stop_event.wait(2)

    def _do_sync(self, lcu: LcuManager):
        try:
            entitle_token, session_token = lcu.get_tokens()
        except Exception as e:
            logger.error(f"获取 token 失败: {e}")
            self.last_sync_result = f"token 失败: {e}"
            return

        try:
            summoners = self._get_summoners()
        except Exception as e:
            logger.error(f"获取选手列表失败: {e}")
            self.last_sync_result = f"获取选手列表失败: {e}"
            return

        if not summoners:
            self.last_sync_result = "没有可同步的选手"
            return

        # 解析缺少 PUUID 的选手
        try:
            summoners = self._resolve_puuid(lcu, summoners)
            # 过滤掉仍然没有 PUUID 的
            summoners = [s for s in summoners if s.get("puuid")]
        except Exception as e:
            logger.warning(f"PUUID 解析异常: {e}")

        if not summoners:
            self.last_sync_result = "所有选手均无 PUUID，无法同步"
            return

        sgp = SgpClient(entitle_token, session_token)
        total_pushed = 0
        total_skipped = 0

        for s in summoners:
            puuid = s["puuid"]
            nickname = s["nickname"]

            for srv_id in TENCENT_SERVERS:
                region_name = SERVER_NAMES.get(srv_id, srv_id)
                try:
                    all_games = []
                    for page in range(SGP_MAX_PAGES):
                        gd = sgp.get_match_history(srv_id, puuid, page * SGP_PAGE_SIZE, SGP_PAGE_SIZE)
                        page_games = gd.get("games", [])
                        if not page_games:
                            break
                        all_games.extend(page_games)
                        if len(page_games) < SGP_PAGE_SIZE:
                            break

                    if not all_games:
                        continue

                    result = self._push_games(srv_id, region_name, all_games)
                    total_pushed += result.get("total_pushed", 0)
                    total_skipped += result.get("total_skipped", 0)

                except httpx.HTTPStatusError:
                    continue
                except Exception as e:
                    logger.warning(f"  [{region_name}] {e}")
                    continue

        self.last_sync_result = f"新增 {total_pushed} 场, 跳过 {total_skipped} 场"
        if total_pushed > 0:
            logger.info(f"同步完成: {self.last_sync_result}")

    def _get_summoners(self) -> list[dict]:
        r = httpx.get(f"{self.server_url}/api/summoners", timeout=10)
        r.raise_for_status()
        return [s for s in r.json() if s.get("is_active")]

    def _resolve_puuid(self, lcu: LcuManager, summoners: list[dict]) -> list[dict]:
        """解析缺少 PUUID 的选手，并更新到服务器"""
        updated = []
        for s in summoners:
            if s.get("puuid"):
                updated.append(s)
                continue
            try:
                puuid = lcu.resolve_puuid(s["game_name"], s["tag_line"])
                if puuid:
                    s["puuid"] = puuid
                    # 更新服务器
                    httpx.put(
                        f"{self.server_url}/api/summoners/{s['id']}/puuid",
                        json={"puuid": puuid},
                        timeout=10,
                    )
                    logger.info(f"  resolved PUUID for {s['nickname']}: {puuid}")
            except Exception as e:
                logger.warning(f"  failed to resolve PUUID for {s['nickname']}: {e}")
            updated.append(s)
        return updated

    def _push_games(self, server_id: str, region: str, games: list[dict]) -> dict:
        r = httpx.post(
            f"{self.server_url}/api/sync/push",
            json={"server_id": server_id, "region": region, "games": games},
            timeout=PUSH_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()


# ── 系统托盘 ──


def get_startup_shortcut() -> str:
    """Windows 开机自启快捷方式路径"""
    startup = os.path.join(
        os.environ.get("APPDATA", ""),
        "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
    )
    return os.path.join(startup, "LOL-Sync-Agent.lnk")


def is_auto_start() -> bool:
    return os.path.isfile(get_startup_shortcut())


def set_auto_start(enable: bool):
    shortcut = get_startup_shortcut()
    if not enable:
        try:
            os.remove(shortcut)
            logger.info("已关闭开机自启")
        except FileNotFoundError:
            pass
        return

    # 确定目标 exe 路径
    if getattr(sys, 'frozen', False):
        target = sys.executable
    else:
        target = os.path.join(APP_DIR, "LOL-Sync-Agent.exe")
        if not os.path.isfile(target):
            target = os.path.join(BASE_DIR, "scripts", "sync_tray.py")

    ps = (
        f'$ws = New-Object -ComObject WScript.Shell; '
        f'$s = $ws.CreateShortcut("{shortcut}"); '
        f'$s.TargetPath = "{target}"; '
        f'$s.WorkingDirectory = "{os.path.dirname(target)}"; '
        f'$s.Save()'
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
        capture_output=True, timeout=10,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if os.path.isfile(shortcut):
        logger.info(f"已开启开机自启: {target}")
    else:
        logger.error("创建开机自启快捷方式失败")


def create_tray_icon() -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, 62, 62], fill=(30, 120, 220))
    draw.ellipse([6, 6, 58, 58], fill=(50, 150, 255))
    draw.text((14, 14), "LOL", fill=(255, 255, 255))
    return img


def run_tray():
    config = load_config()
    worker = SyncWorker(
        server_url=config.get("server_url", DEFAULT_CONFIG["server_url"]),
        sync_interval_minutes=config.get("sync_interval_minutes", DEFAULT_CONFIG["sync_interval_minutes"]),
    )
    worker.start()

    # tk 主窗口（常驻，在主线程跑事件循环）
    tk_root = tk.Tk()
    tk_root.withdraw()

    icon = pystray.Icon("sync-agent", create_tray_icon(), "LOL 战绩同步代理")

    def make_menu():
        lcu_status = "✓ 已连接" if worker.lcu_connected else "✗ 未连接"
        last_sync = worker.last_sync_time or "-"
        items = [
            pystray.MenuItem(f"LCU: {lcu_status}", None, enabled=False),
            pystray.MenuItem(f"状态: {worker.status_text}", None, enabled=False),
        ]
        if worker.summoner_name:
            items.append(pystray.MenuItem(f"当前账号: {worker.summoner_name}", None, enabled=False))
        items.extend([
            pystray.MenuItem(f"上次同步: {last_sync}  {worker.last_sync_result}", None, enabled=False),
            pystray.MenuItem(f"同步间隔: {worker.sync_interval_minutes} 分钟", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                f"开机自启: {'✓' if is_auto_start() else '✗'}",
                on_toggle_autostart,
            ),
            pystray.MenuItem("设置服务器地址", on_settings),
            pystray.MenuItem("设置同步间隔", on_interval_settings),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出", on_exit),
        ])
        return pystray.Menu(*items)

    def on_settings(_icon_item):
        import tkinter.simpledialog as simpledialog
        from tkinter import messagebox

        def _do():
            new_url = simpledialog.askstring(
                "设置服务器地址", "服务器地址:",
                parent=tk_root, initialvalue=worker.server_url,
            )
            if new_url:
                new_url = new_url.rstrip("/")
                if new_url != worker.server_url:
                    worker.server_url = new_url
                    cfg = load_config()
                    cfg["server_url"] = new_url
                    save_config(cfg)
                    messagebox.showinfo("设置成功", f"服务器地址已更新为:\n{new_url}", parent=tk_root)

        tk_root.after(0, _do)

    def on_interval_settings(_icon_item):
        import tkinter.simpledialog as simpledialog
        from tkinter import messagebox

        def _do():
            new_val = simpledialog.askinteger(
                "设置同步间隔", "自动同步间隔（分钟）:",
                parent=tk_root, initialvalue=worker.sync_interval_minutes,
                minvalue=1, maxvalue=1440,
            )
            if new_val is not None and new_val != worker.sync_interval_minutes:
                worker.sync_interval_minutes = new_val
                cfg = load_config()
                cfg["sync_interval_minutes"] = new_val
                save_config(cfg)
                messagebox.showinfo("设置成功", f"同步间隔已更新为 {new_val} 分钟", parent=tk_root)

        tk_root.after(0, _do)

    def on_toggle_autostart(_icon_item):
        enable = not is_auto_start()
        set_auto_start(enable)
        # 立即刷新菜单
        icon.menu = make_menu()
        icon.update_menu()

    def on_exit(_icon_item):
        worker.stop()
        icon.visible = False
        tk_root.quit()

    # 初始菜单
    icon.menu = make_menu()

    def update_menu_loop():
        # 等 icon.run() 启动后再开始刷新
        while not getattr(icon, 'visible', False):
            time.sleep(0.5)
        while True:
            time.sleep(3)
            icon.menu = make_menu()
            icon.update_menu()

    threading.Thread(target=update_menu_loop, daemon=True).start()
    # pystray 跑后台线程，tk 事件循环在主线程
    threading.Thread(target=icon.run, daemon=True).start()
    tk_root.mainloop()


if __name__ == "__main__":
    logger.info("Sync Agent Tray 启动")
    run_tray()

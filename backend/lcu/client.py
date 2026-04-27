"""
LCU API 和 Riot Client API 的 HTTP 客户端。
支持国服（WeGame）和全球服（Riot）两种版本。

国服: 使用 RiotClientServices 端口（如 3938），提供 name#tag → PUUID 和 token
全球服: 使用 LCU 端口 + Riot Client 端口
"""
import base64
import time
import httpx
from .lockfile import LcuAuth, discover, ClientDiscovery

USER_AGENT = "LeagueOfLegendsClient/14.13.596.7996 (rcp-be-lol-match-history)"
TIMEOUT = 12.5


def _build_http(port: int, token: str) -> httpx.Client:
    auth_str = base64.b64encode(f"riot:{token}".encode()).decode()
    return httpx.Client(
        base_url=f"https://127.0.0.1:{port}",
        headers={
            "Authorization": f"Basic {auth_str}",
            "User-Agent": USER_AGENT,
        },
        verify=False,
        timeout=TIMEOUT,
    )


class LcuManager:
    """管理 LCU 和 Riot Client 的连接生命周期"""

    def __init__(self):
        self._discovery: ClientDiscovery | None = None
        self._lcu_http: httpx.Client | None = None
        self._riot_http: httpx.Client | None = None
        self._auth: LcuAuth | None = None

    def refresh(self) -> bool:
        """重新发现客户端并建立连接"""
        self._discovery = discover()
        if self._discovery.has_lcu:
            self._auth = self._discovery.lcu

            # 国服和全球服都有 LCU API (全球: --app-port, 国服: 同样 --app-port)
            if self._auth.port > 0:
                self._lcu_http = _build_http(self._auth.port, self._auth.auth_token)
            else:
                self._lcu_http = None

            # Riot Client API（name#tag 查询）
            if self._auth.riot_client_port > 0:
                # 国服 Riot Client 用不同的 auth token
                rc_token = self._auth.riot_client_auth_token or self._auth.auth_token
                self._riot_http = _build_http(
                    self._auth.riot_client_port, rc_token
                )
            else:
                self._riot_http = None
            return True

        self._lcu_http = None
        self._riot_http = None
        self._auth = None
        return False

    @property
    def connected(self) -> bool:
        return self._auth is not None

    @property
    def is_tencent(self) -> bool:
        return self._auth is not None and self._auth.is_tencent

    def get_tokens(self) -> tuple[str, str]:
        """获取 entitlements_token 和 league_session_token"""
        if not self._lcu_http:
            raise RuntimeError("LCU 未连接")
        r1 = self._lcu_http.get("/entitlements/v1/token")
        r1.raise_for_status()
        data = r1.json()
        # 国服返回 accessToken，全球服返回 token
        entitle = data.get("accessToken") or data.get("token") or ""

        r2 = self._lcu_http.get("/lol-league-session/v1/league-session-token")
        r2.raise_for_status()
        # 国服返回纯字符串，全球服返回 {"token": "..."}
        try:
            d2 = r2.json()
            if isinstance(d2, str):
                session = d2
            else:
                session = d2.get("token", "")
        except Exception:
            session = r2.text.strip().strip('"')
        return entitle, session

    def resolve_puuid(self, game_name: str, tag_line: str) -> str | None:
        """通过 Riot Client API 解析 name#tag → PUUID"""
        http = self._riot_http or self._lcu_http
        if not http:
            return None
        r = http.get(
            "/player-account/aliases/v1/lookup",
            params={"gameName": game_name, "tagLine": tag_line},
        )
        if r.status_code != 200:
            return None
        aliases = r.json()
        if aliases and len(aliases) > 0:
            return aliases[0].get("puuid")
        return None

    def get_current_summoner(self) -> dict | None:
        """
        获取当前登录的召唤师信息。
        全球服: LCU API /lol-summoner/v1/current-summoner
        国服:   Riot Client API /player-account/v1/current-account (fallback)
        """
        # 优先 LCU API
        if self._lcu_http:
            try:
                r = self._lcu_http.get("/lol-summoner/v1/current-summoner")
                if r.status_code == 200:
                    return r.json()
            except Exception:
                pass

        # 国服 fallback: Riot Client API
        if self._riot_http:
            try:
                r = self._riot_http.get("/player-account/v1/current-account")
                if r.status_code == 200:
                    return r.json()
            except Exception:
                pass

        return None

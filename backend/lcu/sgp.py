"""
SGP (Service Gateway Proxy) API 客户端。
使用 LCU 提供的 JWT token 跨区查询对局历史。
"""
import json
import httpx
from pathlib import Path

USER_AGENT = "LeagueOfLegendsClient/14.13.596.7996 (rcp-be-lol-match-history)"
TIMEOUT = 12.5

# 腾讯服务器间可互通的服务器列表 (一个 token 可查所有)
TENCENT_SERVERS = [
    "TENCENT_HN1",    # 艾欧尼亚
    "TENCENT_HN10",   # 黑色玫瑰
    "TENCENT_NJ100",  # 联盟一区
    "TENCENT_GZ100",  # 联盟二区
    "TENCENT_CQ100",  # 联盟三区
    "TENCENT_TJ100",  # 联盟四区
    "TENCENT_TJ101",  # 联盟五区
    "TENCENT_BGP2",   # 峡谷之巅
]

SERVER_NAMES = {
    "TENCENT_HN1": "艾欧尼亚",
    "TENCENT_HN10": "黑色玫瑰",
    "TENCENT_NJ100": "联盟一区",
    "TENCENT_GZ100": "联盟二区",
    "TENCENT_CQ100": "联盟三区",
    "TENCENT_TJ100": "联盟四区",
    "TENCENT_TJ101": "联盟五区",
    "TENCENT_BGP2": "峡谷之巅",
}


def _load_server_config() -> dict:
    """加载 SGP 服务器配置（从 LeagueAkari 提取的内置配置）"""
    return {
        "servers": {
            "TENCENT_HN1": {"matchHistory": "https://hn1-k8s-sgp.lol.qq.com:21019", "common": "https://hn1-k8s-sgp.lol.qq.com:21019"},
            "TENCENT_HN10": {"matchHistory": "https://hn10-k8s-sgp.lol.qq.com:21019", "common": "https://hn10-k8s-sgp.lol.qq.com:21019"},
            "TENCENT_TJ100": {"matchHistory": "https://tj100-sgp.lol.qq.com:21019", "common": "https://tj100-sgp.lol.qq.com:21019"},
            "TENCENT_TJ101": {"matchHistory": "https://tj101-sgp.lol.qq.com:21019", "common": "https://tj101-sgp.lol.qq.com:21019"},
            "TENCENT_NJ100": {"matchHistory": "https://nj100-sgp.lol.qq.com:21019", "common": "https://nj100-sgp.lol.qq.com:21019"},
            "TENCENT_GZ100": {"matchHistory": "https://gz100-sgp.lol.qq.com:21019", "common": "https://gz100-sgp.lol.qq.com:21019"},
            "TENCENT_CQ100": {"matchHistory": "https://cq100-sgp.lol.qq.com:21019", "common": "https://cq100-sgp.lol.qq.com:21019"},
            "TENCENT_BGP2": {"matchHistory": "https://bgp2-k8s-sgp.lol.qq.com:21019", "common": "https://bgp2-k8s-sgp.lol.qq.com:21019"},
        }
    }


class SgpClient:
    """SGP API 封装 — 跨区战绩查询"""

    def __init__(self, entitlements_token: str, league_session_token: str):
        self.entitlements_token = entitlements_token
        self.league_session_token = league_session_token
        self._config = _load_server_config()
        self._http = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            verify=False,
            timeout=TIMEOUT,
        )

    def _get_server_url(self, server_id: str) -> str:
        s = self._config["servers"].get(server_id.upper())
        if not s:
            raise ValueError(f"未知的服务器: {server_id}")
        return s["matchHistory"]

    def _get_sub_id(self, server_id: str) -> str:
        """腾讯服只取 rsoPlatformId（HN1, HN10等），其他服直接用 server_id"""
        if server_id.startswith("TENCENT"):
            return server_id.split("_")[1] if "_" in server_id else server_id
        return server_id

    def get_match_history(
        self, server_id: str, puuid: str,
        start: int = 0, count: int = 100, tag: str | None = None
    ) -> dict:
        """获取某区服某玩家的对局历史列表（含完整数据）"""
        base = self._get_server_url(server_id)
        params = {"startIndex": start, "count": count}
        if tag:
            params["tag"] = tag
        url = f"{base}/match-history-query/v1/products/lol/player/{puuid}/SUMMARY"
        r = self._http.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {self.entitlements_token}"},
        )
        r.raise_for_status()
        return r.json()

    def get_game_summary(self, server_id: str, game_id: int) -> dict:
        """获取单场对局的摘要信息"""
        base = self._get_server_url(server_id)
        sub_id = self._get_sub_id(server_id)
        url = f"{base}/match-history-query/v1/products/lol/{sub_id.upper()}_{game_id}/SUMMARY"
        r = self._http.get(
            url,
            headers={"Authorization": f"Bearer {self.entitlements_token}"},
        )
        r.raise_for_status()
        return r.json()

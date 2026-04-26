"""
发现并解析 League Client 和 Riot Client 的连接信息。
使用 psutil 查询进程命令行，支持国服（WeGame）和全球服（Riot）两种版本。

国服版本:
  LeagueClient.exe --riotclient-auth-token=... --riotclient-app-port=3938 ...
  RiotClientServices.exe 监听 --riotclient-app-port (如 3938)，提供 Riot Client API
  LCU API 端口 (如 6782) 对国服外部访问受限

全球服版本:
  LeagueClient.exe --app-port=... --remoting-auth-token=... --riotclient-app-port=...
"""
import os
import re
from dataclasses import dataclass

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

RIOT_CERT = """-----BEGIN CERTIFICATE-----
MIIEIDCCAwgCCQDJC+QAdVx4UDANBgkqhkiG9w0BAQUFADCB0TELMAkGA1UEBhMC
VVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFTATBgNVBAcTDFNhbnRhIE1vbmljYTET
MBEGA1UEChMKUmlvdCBHYW1lczEdMBsGA1UECxMUTG9MIEdhbWUgRW5naW5lZXJp
bmcxMzAxBgNVBAMTKkxvTCBHYW1lIEVuZ2luZWVyaW5nIENlcnRpZmljYXRlIEF1
dGhvcml0eTEtMCsGCSqGSIb3DQEJARYeZ2FtZXRlY2hub2xvZ2llc0ByaW90Z2Ft
ZXMuY29tMB4XDTEzMTIwNDAwNDgzOVoXDTQzMTEyNzAwNDgzOVowgdExCzAJBgNV
BAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRUwEwYDVQQHEwxTYW50YSBNb25p
Y2ExEzARBgNVBAoTClJpb3QgR2FtZXMxHTAbBgNVBAsTFExvTCBHYW1lIEVuZ2lu
ZWVyaW5nMTMwMQYDVQQDEypMb0wgR2FtZSBFbmdpbmVlcmluZyBDZXJ0aWZpY2F0
ZSBBdXRob3JpdHkxLTArBgkqhkiG9w0BCQEWHmdhbWV0ZWNobm9sb2dpZXNAcmlv
dGdhbWVzLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKoJemF/
6PNG3GRJGbjzImTdOo1OJRDI7noRwJgDqkaJFkwv0X8aPUGbZSUzUO23cQcCgpYj
21ygzKu5dtCN2EcQVVpNtyPuM2V4eEGr1woodzALtufL3Nlyh6g5jKKuDIfeUBHv
JNyQf2h3Uha16lnrXmz9o9wsX/jf+jUAljBJqsMeACOpXfuZy+YKUCxSPOZaYTLC
y+0GQfiT431pJHBQlrXAUwzOmaJPQ7M6mLfsnpHibSkxUfMfHROaYCZ/sbWKl3lr
ZA9DbwaKKfS1Iw0ucAeDudyuqb4JntGU/W0aboKA0c3YB02mxAM4oDnqseuKV/CX
8SQAiaXnYotuNXMCAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAf3KPmddqEqqC8iLs
lcd0euC4F5+USp9YsrZ3WuOzHqVxTtX3hR1scdlDXNvrsebQZUqwGdZGMS16ln3k
WObw7BbhU89tDNCN7Lt/IjT4MGRYRE+TmRc5EeIXxHkQ78bQqbmAI3GsW+7kJsoO
q3DdeE+M+BUJrhWorsAQCgUyZO166SAtKXKLIcxa+ddC49NvMQPJyzm3V+2b1roP
SvD2WV8gRYUnGmy/N0+u6ANq5EsbhZ548zZc+BI4upsWChTLyxt2RxR7+uGlS1+5
EcGfKZ+g024k/J32XP4hdho7WYAS2xMiV83CfLR/MNi8oSMaVQTdKD8cpgiWJk3L
XWehWA==
-----END CERTIFICATE-----"""


def _parse_command_line(cmdline: str) -> dict | None:
    """
    从进程命令行中提取连接参数。
    支持全球服和国服两种格式。
    """
    # 全球服格式
    global_patterns = {
        "port": r"--app-port=(\d+)",
        "auth_token": r"--remoting-auth-token=([\w\-_]+)",
        "pid": r"--app-pid=(\d+)",
    }
    # 国服/通用格式
    tencent_patterns = {
        "region": r"--region=([\w\-_]+)",
        "rso_platform_id": r"--rso_platform_id=([\w\-_]+)",
        "riot_client_port": r"--riotclient-app-port=(\d+)",
        "riot_client_auth_token": r"--riotclient-auth-token=([\w\-_]+)",
        "locale": r"--locale=([\w\-_]+)",
    }

    result = {}
    for key, pattern in {**global_patterns, **tencent_patterns}.items():
        m = re.search(pattern, cmdline)
        if m:
            val = m.group(1)
            if "port" in key or "pid" in key:
                val = int(val)
            result[key] = val

    # 全球服: 需要 port + auth_token
    has_global = "port" in result and "auth_token" in result
    # 国服: 需要 riot_client_port + riot_client_auth_token
    has_tencent = "riot_client_port" in result and "riot_client_auth_token" in result

    if has_global or has_tencent:
        return result
    return None


def _discover_with_psutil() -> dict | None:
    """使用 psutil 发现所有 LOL 进程并提取连接参数"""
    if not HAS_PSUTIL:
        return None

    # 按优先级搜索进程: LeagueClientUx.exe 拥有最完整的命令行参数
    # LeagueClient.exe (国服) 可能缺少 --app-port/--remoting-auth-token
    target_names = ["LeagueClientUx.exe", "LeagueClient.exe", "RiotClientServices.exe"]

    best = None
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            name = proc.info.get("name") or ""
            if name not in target_names:
                continue

            cmdline = proc.info.get("cmdline") or []
            full_cmd = " ".join(cmdline)
            if not full_cmd:
                continue

            parsed = _parse_command_line(full_cmd)
            if not parsed:
                continue

            parsed["process_name"] = name
            parsed["_pid"] = proc.info["pid"]

            # 优先选择有完整参数（同时有 LCU port 和 Riot Client port）的进程
            has_lcu = "port" in parsed and "auth_token" in parsed
            has_rc = "riot_client_port" in parsed and "riot_client_auth_token" in parsed

            if has_lcu and has_rc:
                return parsed  # 最完整，直接返回

            if best is None:
                best = parsed
            elif has_lcu and not ("port" in best and "auth_token" in best):
                best = parsed
        except Exception:
            continue

    return best


def _discover_with_lockfile() -> dict | None:
    """通过 lockfile 发现（仅全球服有效）"""
    candidate_dirs = [
        os.path.expandvars(r"%ProgramFiles%\Riot Games\League of Legends"),
        r"C:\Program Files\Riot Games\League of Legends",
        r"D:\Program Files\Riot Games\League of Legends",
        os.path.expandvars(r"%ProgramFiles(x86)%\Riot Games\League of Legends"),
    ]
    for d in candidate_dirs:
        p = os.path.join(d, "lockfile")
        if not os.path.isfile(p):
            continue
        try:
            # lockfile 大小可能为 0（国服），跳过
            if os.path.getsize(p) == 0:
                continue
            with open(p, "r") as f:
                content = f.read().strip()
            parts = content.split(":")
            if len(parts) >= 5:
                return {
                    "port": int(parts[2]),
                    "auth_token": parts[3],
                    "pid": int(parts[1]),
                    "process_name": parts[0],
                }
        except Exception:
            pass
    return None


# ── 公共接口 ──

@dataclass
class LcuAuth:
    """LCU/Riot Client 连接凭据"""
    # LCU API（全球服）或 Riot Client API（国服）
    port: int = 0
    auth_token: str = ""
    pid: int = 0
    region: str = ""
    rso_platform_id: str = ""
    # Riot Client API（name#tag 查询）
    riot_client_port: int = 0
    riot_client_auth_token: str = ""
    certificate: str = RIOT_CERT
    is_tencent: bool = False  # 国服标记

    @property
    def lcu_port(self) -> int:
        """LCU API 端口（全球服 = port，国服暂不可用）"""
        if not self.is_tencent:
            return self.port
        return 0  # 国服 LCU API 不可用

    @property
    def name_resolve_port(self) -> int:
        """name#tag → PUUID 查询端口"""
        if self.is_tencent:
            return self.riot_client_port
        return self.riot_client_port or self.port  # 全球服 fallback 到 LCU


@dataclass
class ClientDiscovery:
    lcu: LcuAuth | None = None

    @property
    def has_lcu(self) -> bool:
        return self.lcu is not None

    @property
    def has_riot_client(self) -> bool:
        """是否能进行 name#tag → PUUID 查询"""
        if self.lcu is None:
            return False
        if self.lcu.is_tencent:
            return self.lcu.riot_client_port > 0
        return self.lcu.riot_client_port > 0 or self.lcu.port > 0


def discover() -> ClientDiscovery:
    """自动发现本机运行的 League Client"""
    result = ClientDiscovery()

    # 方案1: psutil 进程发现（支持国服 + 全球服）
    parsed = _discover_with_psutil()
    if parsed:
        is_tencent = parsed.get("region", "").upper() == "TENCENT"
        auth = LcuAuth(
            port=parsed.get("port", 0),
            auth_token=parsed.get("auth_token", ""),
            pid=parsed.get("_pid", parsed.get("pid", 0)),
            region=parsed.get("region", ""),
            rso_platform_id=parsed.get("rso_platform_id", ""),
            riot_client_port=parsed.get("riot_client_port", 0),
            riot_client_auth_token=parsed.get("riot_client_auth_token", ""),
            is_tencent=is_tencent,
        )
        result.lcu = auth
        return result

    # 方案2: lockfile 发现（全球服 fallback）
    lf = _discover_with_lockfile()
    if lf:
        auth = LcuAuth(
            port=lf["port"],
            auth_token=lf["auth_token"],
            pid=lf["pid"],
        )
        result.lcu = auth

    return result

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Summoner ──

class SummonerCreate(BaseModel):
    riot_id: str = Field(..., description="召唤师完整ID, 如 被绑的提莫#56022")
    nickname: str = Field(..., description="昵称, 如 周某人")


class SummonerUpdate(BaseModel):
    nickname: Optional[str] = None
    is_active: Optional[bool] = None
    puuid: Optional[str] = None


class SummonerOut(BaseModel):
    id: int
    game_name: str
    tag_line: str
    puuid: Optional[str]
    nickname: str
    is_active: bool
    is_temporary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def riot_id(self) -> str:
        return f"{self.game_name}#{self.tag_line}"


# ── Match ──

class MatchCreate(BaseModel):
    name: Optional[str] = None
    summoner_ids: list[int] = Field(default=[], min_length=0, description="参战固定选手ID列表")
    temp_players: list[str] = Field(default=[], description="临时玩家昵称列表，只参与分组")


class MatchParticipantOut(BaseModel):
    id: int
    summoner_id: int
    summoner_name: str  # riot_id
    summoner_nickname: str
    team: int
    is_temporary: bool = False

    model_config = {"from_attributes": True}


class MatchOut(BaseModel):
    id: int
    name: Optional[str]
    created_at: datetime
    participants: list[MatchParticipantOut]

    model_config = {"from_attributes": True}


# ── Sync ──

class SyncRequest(BaseModel):
    summoner_ids: Optional[list[int]] = None  # 不传则同步全部活跃选手
    start_date: Optional[str] = None  # 开始日期 YYYY-MM-DD
    end_date: Optional[str] = None  # 结束日期 YYYY-MM-DD


class SyncLogOut(BaseModel):
    id: int
    summoner_id: int
    summoner_nickname: str
    sync_start: datetime
    sync_end: Optional[datetime]
    games_fetched: int
    status: str
    error_message: Optional[str]

    model_config = {"from_attributes": True}


# ── Stats ──

class SummonerStats(BaseModel):
    summoner_id: int
    riot_id: str
    nickname: str
    total_games: int
    wins: int
    losses: int
    win_rate: float
    avg_kills: float
    avg_deaths: float
    avg_assists: float
    avg_kda: float


class HeadToHead(BaseModel):
    summoner_id: int
    riot_id: str
    nickname: str
    games_played: int
    wins: int
    losses: int
    win_rate: float


class SyncPushRequest(BaseModel):
    """sync-agent 推送对局数据的请求体"""
    server_id: str = Field(..., description="SGP 区服ID, 如 TENCENT_HN1")
    region: str = Field(..., description="区服中文名, 如 艾欧尼亚")
    games: list[dict] = Field(..., description="原始对局数据列表 (SGP 返回的 games 数组)")


class SyncPushResponse(BaseModel):
    total_pushed: int = 0
    total_skipped: int = 0
    message: str = ""


# ── LCU Status ──

class LcuStatus(BaseModel):
    connected: bool
    summoner_name: Optional[str] = None
    region: Optional[str] = None

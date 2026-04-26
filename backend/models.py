from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from .database import Base


class Summoner(Base):
    __tablename__ = "summoners"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_name = Column(String(64), nullable=False, comment="召唤师名称(不带tag)")
    tag_line = Column(String(32), nullable=False, comment="tag, 不含#")
    puuid = Column(String(128), nullable=True, comment="PUUID, 自动解析")
    nickname = Column(String(64), nullable=False, comment="昵称")
    is_active = Column(Boolean, default=True, comment="是否在选手池中")
    is_temporary = Column(Boolean, default=False, comment="临时玩家，只参与分组，不计战绩")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 反向关系
    match_participants = relationship("MatchParticipant", back_populates="summoner")
    game_records = relationship("GameRecord", back_populates="summoner")
    sync_logs = relationship("SyncLog", back_populates="summoner")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=True, comment="内战名称")
    created_at = Column(DateTime, default=datetime.utcnow)

    participants = relationship("MatchParticipant", back_populates="match")


class MatchParticipant(Base):
    __tablename__ = "match_participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    summoner_id = Column(Integer, ForeignKey("summoners.id"), nullable=False)
    team = Column(Integer, nullable=False, comment="0=蓝方, 1=红方")

    match = relationship("Match", back_populates="participants")
    summoner = relationship("Summoner", back_populates="match_participants")


class GameRecord(Base):
    __tablename__ = "game_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    riot_game_id = Column(String(64), nullable=False, comment="Riot 对局ID")
    summoner_id = Column(Integer, ForeignKey("summoners.id"), nullable=False)
    champion_name = Column(String(32), nullable=True, comment="使用的英雄")
    win = Column(Boolean, nullable=True, comment="是否获胜")
    kills = Column(Integer, nullable=True)
    deaths = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    game_duration = Column(Integer, nullable=True, comment="游戏时长(秒)")
    game_creation = Column(DateTime, nullable=True, comment="对局时间戳")
    participants_count = Column(Integer, nullable=True, comment="参与人数")
    region = Column(String(16), nullable=True, comment="所在区服")
    raw_data = Column(JSON, nullable=True, comment="原始JSON数据")
    created_at = Column(DateTime, default=datetime.utcnow)

    summoner = relationship("Summoner", back_populates="game_records")

    __table_args__ = (
        # 同一召唤师同一对局不重复录入
        {"sqlite_autoincrement": True},
    )


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summoner_id = Column(Integer, ForeignKey("summoners.id"), nullable=False)
    sync_start = Column(DateTime, nullable=False)
    sync_end = Column(DateTime, nullable=True)
    games_fetched = Column(Integer, default=0)
    status = Column(String(16), default="running", comment="running/done/failed")
    error_message = Column(Text, nullable=True)

    summoner = relationship("Summoner", back_populates="sync_logs")

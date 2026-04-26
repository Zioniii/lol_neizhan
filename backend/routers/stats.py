from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer

from ..database import get_db
from ..models import Summoner, GameRecord
from ..schemas import SummonerStats, HeadToHead

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/summoners", response_model=list[SummonerStats])
def summoner_stats(db: Session = Depends(get_db)):
    summoners = db.query(Summoner).filter(Summoner.is_active == True).all()
    result = []
    for s in summoners:
        total = db.query(GameRecord).filter(GameRecord.summoner_id == s.id).count()
        wins = (
            db.query(GameRecord)
            .filter(GameRecord.summoner_id == s.id, GameRecord.win == True)
            .count()
        )
        losses = total - wins
        avg = (
            db.query(
                func.avg(GameRecord.kills),
                func.avg(GameRecord.deaths),
                func.avg(GameRecord.assists),
            )
            .filter(GameRecord.summoner_id == s.id)
            .first()
        )
        avg_k, avg_d, avg_a = avg[0] or 0, avg[1] or 0, avg[2] or 0
        avg_kda = round((avg_k + avg_a) / max(avg_d, 1), 2)

        result.append(
            SummonerStats(
                summoner_id=s.id,
                riot_id=f"{s.game_name}#{s.tag_line}",
                nickname=s.nickname,
                total_games=total,
                wins=wins,
                losses=losses,
                win_rate=round(wins / total * 100, 1) if total > 0 else 0,
                avg_kills=round(avg_k, 1),
                avg_deaths=round(avg_d, 1),
                avg_assists=round(avg_a, 1),
                avg_kda=avg_kda,
            )
        )

    result.sort(key=lambda x: x.win_rate, reverse=True)
    return result


@router.get("/head-to-head")
def head_to_head_stats(db: Session = Depends(get_db)):
    """统计两两对决 (在同一局中的胜负)"""
    summoners = db.query(Summoner).filter(Summoner.is_active == True).all()
    sid_to_info = {
        s.id: {"riot_id": f"{s.game_name}#{s.tag_line}", "nickname": s.nickname}
        for s in summoners
    }

    # 获取所有 game_id，这些对局里有多个我方选手参与
    all_records = (
        db.query(GameRecord)
        .filter(GameRecord.summoner_id.in_(sid_to_info.keys()))
        .all()
    )

    # 按 game_id 分组，找出同局的所有选手
    game_players: dict[str, list[GameRecord]] = defaultdict(list)
    for r in all_records:
        game_players[r.riot_game_id].append(r)

    # 计算两两间胜负
    # h2h[a_id][b_id] = {wins, losses}
    h2h: dict[int, dict[int, dict]] = defaultdict(lambda: defaultdict(lambda: {"wins": 0, "losses": 0}))

    for game_id, records in game_players.items():
        for i, r1 in enumerate(records):
            for r2 in records[i + 1 :]:
                if r1.summoner_id == r2.summoner_id:
                    continue
                if r1.win and not r2.win:
                    h2h[r1.summoner_id][r2.summoner_id]["wins"] += 1
                    h2h[r2.summoner_id][r1.summoner_id]["losses"] += 1
                elif r2.win and not r1.win:
                    h2h[r2.summoner_id][r1.summoner_id]["wins"] += 1
                    h2h[r1.summoner_id][r2.summoner_id]["losses"] += 1
                # 同赢同输不统计

    # 构造返回
    result = {}
    for a_id, opponents in h2h.items():
        if a_id not in sid_to_info:
            continue
        opponent_stats = []
        for b_id, stats in opponents.items():
            if b_id not in sid_to_info:
                continue
            games = stats["wins"] + stats["losses"]
            if games == 0:
                continue
            opponent_stats.append(
                HeadToHead(
                    summoner_id=b_id,
                    riot_id=sid_to_info[b_id]["riot_id"],
                    nickname=sid_to_info[b_id]["nickname"],
                    games_played=games,
                    wins=stats["wins"],
                    losses=stats["losses"],
                    win_rate=round(stats["wins"] / games * 100, 1),
                )
            )
        opponent_stats.sort(key=lambda x: x.win_rate, reverse=True)
        result[sid_to_info[a_id]["riot_id"]] = opponent_stats

    return result


@router.get("/champions")
def champion_stats(db: Session = Depends(get_db)):
    """英雄使用统计"""
    summoners = db.query(Summoner).filter(Summoner.is_temporary == False).all()
    result = {}
    for s in summoners:
        rows = (
            db.query(
                GameRecord.champion_name,
                func.count().label("cnt"),
                func.sum(GameRecord.win.cast(Integer)).label("wins"),
            )
            .filter(GameRecord.summoner_id == s.id)
            .group_by(GameRecord.champion_name)
            .order_by(func.count().desc())
            .all()
        )
        result[f"{s.game_name}#{s.tag_line}"] = [
            {
                "champion": r[0],
                "games": r[1],
                "wins": r[2] or 0,
                "win_rate": round((r[2] or 0) / r[1] * 100, 1) if r[1] > 0 else 0,
            }
            for r in rows
        ]
    return result

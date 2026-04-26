import random
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Summoner, Match, MatchParticipant, GameRecord
from ..schemas import MatchCreate, MatchOut, MatchParticipantOut

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=list[MatchOut])
def list_matches(db: Session = Depends(get_db)):
    matches = db.query(Match).order_by(Match.created_at.desc()).all()
    result = []
    for m in matches:
        participants = []
        for mp in m.participants:
            participants.append(
                MatchParticipantOut(
                    id=mp.id,
                    summoner_id=mp.summoner_id,
                    summoner_name=f"{mp.summoner.game_name}#{mp.summoner.tag_line}",
                    summoner_nickname=mp.summoner.nickname,
                    team=mp.team,
                    is_temporary=mp.summoner.is_temporary,
                )
            )
        result.append(
            MatchOut(
                id=m.id,
                name=m.name,
                created_at=m.created_at,
                participants=participants,
            )
        )
    return result


# ── 以下 /history 必须在 /{match_id} 之前，避免被泛型路由捕获 ──

@router.get("/history")
def match_history(page: int = 1, page_size: int = 10, db: Session = Depends(get_db)):
    """从已同步的 GameRecord 中提取对局记录（含蓝/红方阵容和胜负）"""
    summoners = {s.id: s for s in db.query(Summoner).all()}
    puuid_to_summoner = {}
    for s in summoners.values():
        if s.puuid:
            puuid_to_summoner[s.puuid.lower()] = s

    # 统计总对局数
    total_q = (
        db.query(GameRecord.riot_game_id)
        .group_by(GameRecord.riot_game_id)
        .subquery()
    )
    total = db.query(total_q).count()

    # 分页获取唯一对局
    offset = (page - 1) * page_size
    sub = (
        db.query(GameRecord.riot_game_id, func.min(GameRecord.id).label("min_id"))
        .group_by(GameRecord.riot_game_id)
        .order_by(func.min(GameRecord.game_creation).desc())
        .offset(offset)
        .limit(page_size)
        .subquery()
    )
    records = (
        db.query(GameRecord)
        .filter(GameRecord.id.in_(db.query(sub.c.min_id)))
        .order_by(GameRecord.game_creation.desc())
        .all()
    )

    result = []
    for rec in records:
        raw = rec.raw_data or {}
        if not raw:
            continue

        teams = raw.get("teams", [])
        participants = raw.get("participants", [])

        blue_win = None
        red_win = None
        for t in teams:
            if t.get("teamId") == 100:
                blue_win = t.get("win")
            elif t.get("teamId") == 200:
                red_win = t.get("win")

        blue_players = []
        red_players = []
        for p in participants:
            pid = (p.get("puuid") or "").lower()
            player = {
                "riot_id": f"{p.get('riotIdGameName', '')}#{p.get('riotIdTagline', '')}",
                "champion": p.get("championName", ""),
                "kills": p.get("kills", 0),
                "deaths": p.get("deaths", 0),
                "assists": p.get("assists", 0),
                "win": p.get("win"),
                "summoner_name": p.get("summonerName", ""),
            }
            # 匹配池子里的选手
            pool_summoner = puuid_to_summoner.get(pid)
            if pool_summoner:
                player["nickname"] = pool_summoner.nickname
                player["in_pool"] = True
            else:
                player["nickname"] = None
                player["in_pool"] = False

            team_id = p.get("teamId")
            if team_id == 100:
                blue_players.append(player)
            elif team_id == 200:
                red_players.append(player)

        # 判断我方选手在哪边多
        blue_in_pool = sum(1 for p in blue_players if p["in_pool"])
        red_in_pool = sum(1 for p in red_players if p["in_pool"])
        our_team = "blue" if blue_in_pool >= red_in_pool else "red"
        our_team_win = blue_win if our_team == "blue" else red_win

        result.append({
            "riot_game_id": rec.riot_game_id,
            "game_creation": rec.game_creation.isoformat() if rec.game_creation else None,
            "game_duration": rec.game_duration,
            "region": rec.region,
            "blue_win": blue_win,
            "red_win": red_win,
            "our_team": our_team,
            "our_team_win": our_team_win,
            "blue_players": blue_players,
            "red_players": red_players,
        })

    return {
        "matches": result,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db)):
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(404, "内战记录不存在")
    participants = []
    for mp in m.participants:
        participants.append(
            MatchParticipantOut(
                id=mp.id,
                summoner_id=mp.summoner_id,
                summoner_name=f"{mp.summoner.game_name}#{mp.summoner.tag_line}",
                summoner_nickname=mp.summoner.nickname,
                team=mp.team,
            )
        )
    return MatchOut(
        id=m.id,
        name=m.name,
        created_at=m.created_at,
        participants=participants,
    )


@router.post("", response_model=MatchOut)
def create_match(data: MatchCreate, db: Session = Depends(get_db)):
    total = len(data.summoner_ids) + len(data.temp_players)
    if total < 2:
        raise HTTPException(400, "至少需要2名参战选手")

    # 收集所有参战召唤师 ID
    all_ids = list(data.summoner_ids)

    # 处理临时玩家：按昵称查找或创建
    for name in data.temp_players:
        name = name.strip()
        if not name:
            continue
        existing = (
            db.query(Summoner)
            .filter(Summoner.nickname == name, Summoner.is_temporary == True)
            .first()
        )
        if existing:
            all_ids.append(existing.id)
        else:
            temp = Summoner(
                game_name=name,
                tag_line="TEMP",
                nickname=name,
                is_active=False,
                is_temporary=True,
            )
            db.add(temp)
            db.flush()
            all_ids.append(temp.id)

    # 验证固定选手 ID 存在
    summoners = db.query(Summoner).filter(Summoner.id.in_(data.summoner_ids)).all()
    if len(summoners) != len(set(data.summoner_ids)):
        raise HTTPException(400, "存在无效的召唤师 ID")

    # 随机打乱后分成两队
    random.shuffle(all_ids)
    mid = (len(all_ids) + 1) // 2
    blue = all_ids[:mid]
    red = all_ids[mid:]

    match = Match(name=data.name)
    db.add(match)
    db.flush()

    participants = []
    for sid in blue:
        mp = MatchParticipant(match_id=match.id, summoner_id=sid, team=0)
        db.add(mp)
        participants.append(mp)
    for sid in red:
        mp = MatchParticipant(match_id=match.id, summoner_id=sid, team=1)
        db.add(mp)
        participants.append(mp)

    db.commit()
    db.refresh(match)

    # 构造返回
    po_list = []
    for mp in participants:
        db.refresh(mp)
        po_list.append(
            MatchParticipantOut(
                id=mp.id,
                summoner_id=mp.summoner_id,
                summoner_name=f"{mp.summoner.game_name}#{mp.summoner.tag_line}",
                summoner_nickname=mp.summoner.nickname,
                team=mp.team,
                is_temporary=mp.summoner.is_temporary,
            )
        )
    return MatchOut(
        id=match.id,
        name=match.name,
        created_at=match.created_at,
        participants=po_list,
    )


@router.delete("/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db)):
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(404, "内战记录不存在")
    # 先删参与记录
    db.query(MatchParticipant).filter(MatchParticipant.match_id == match_id).delete()
    db.delete(m)
    db.commit()
    return {"ok": True}

import random
import logging
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from ..database import get_db
from ..models import Summoner, Match, MatchParticipant, GameRecord
from ..schemas import MatchCreate, MatchOut, MatchParticipantOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("")
def list_matches(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    total = db.query(Match).count()
    matches = (
        db.query(Match)
        .order_by(Match.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = []
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
        items.append(
            MatchOut(
                id=m.id,
                name=m.name,
                created_at=m.created_at,
                participants=participants,
            )
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
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


def _get_forced_team(db: Session, summoner_id: int, side_limit: int) -> int | None:
    """检查选手最近 side_limit 场比赛是否都在同一队，若是则强制换边"""
    recent = (
        db.query(MatchParticipant.team)
        .join(Match, MatchParticipant.match_id == Match.id)
        .filter(MatchParticipant.summoner_id == summoner_id)
        .order_by(Match.created_at.desc())
        .limit(side_limit)
        .all()
    )
    if len(recent) < side_limit:
        return None
    teams = [r[0] for r in recent]
    if all(t == 0 for t in teams):
        return 1  # 强制到红方
    if all(t == 1 for t in teams):
        return 0  # 强制到蓝方
    return None


def _get_win_rates(db: Session, summoner_ids: list[int]) -> dict[int, float]:
    """批量查询选手胜率，无数据的默认 0.5"""
    rows = (
        db.query(
            GameRecord.summoner_id,
            func.count().label("total"),
            func.sum(case((GameRecord.win == True, 1), else_=0)).label("wins"),
        )
        .filter(GameRecord.summoner_id.in_(summoner_ids))
        .group_by(GameRecord.summoner_id)
        .all()
    )
    wr_map: dict[int, float] = {}
    for r in rows:
        total = r.total
        wins = r.wins or 0
        wr_map[r.summoner_id] = wins / total if total > 0 else 0.5
    for sid in summoner_ids:
        wr_map.setdefault(sid, 0.5)
    return wr_map


@router.post("", response_model=MatchOut)
def create_match(data: MatchCreate, db: Session = Depends(get_db)):
    total = len(data.summoner_ids) + len(data.temp_players)
    if total < 2:
        raise HTTPException(400, "至少需要2名参战选手")

    # 处理临时玩家：按昵称查找或创建
    temp_ids: list[int] = []
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
            temp_ids.append(existing.id)
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
            temp_ids.append(temp.id)

    # 验证固定选手 ID 存在
    summoners = db.query(Summoner).filter(Summoner.id.in_(data.summoner_ids)).all()
    if len(summoners) != len(set(data.summoner_ids)):
        raise HTTPException(400, "存在无效的召唤师 ID")

    # ── 3-phase team assignment ──
    fixed_ids = list(data.summoner_ids)
    blue: list[int] = []
    red: list[int] = []

    # Phase 1: Side-limit pinning (capped to prevent imbalance)
    max_per_team = (total + 1) // 2  # ceil(total/2), e.g. 6→3, 7→4
    if data.side_limit > 0:
        # Sort by consecutive same-side streak (longest first = most urgent)
        pinned: list[tuple[int, int]] = []  # (summoner_id, forced_team)
        for sid in fixed_ids:
            forced = _get_forced_team(db, sid, data.side_limit)
            if forced is not None:
                pinned.append((sid, forced))
        # Assign only up to max_per_team per side; excess stays for later phases
        for sid, forced in pinned:
            if forced == 0 and len(blue) < max_per_team:
                blue.append(sid)
            elif forced == 1 and len(red) < max_per_team:
                red.append(sid)

    # Phase 2: Win-rate balance (only for unpinned fixed players)
    remaining_fixed = [sid for sid in fixed_ids if sid not in blue and sid not in red]
    if data.win_rate_balance and remaining_fixed:
        wrs = _get_win_rates(db, fixed_ids)
        remaining_fixed.sort(key=lambda sid: wrs.get(sid, 0.5), reverse=True)
        for sid in remaining_fixed:
            if len(blue) < len(red):
                blue.append(sid)
            elif len(red) < len(blue):
                red.append(sid)
            else:
                blue_total = sum(wrs.get(s, 0.5) for s in blue)
                red_total = sum(wrs.get(s, 0.5) for s in red)
                if blue_total <= red_total:
                    blue.append(sid)
                else:
                    red.append(sid)
        remaining_fixed = []  # 已在 Phase 2 分配完毕

    # Phase 3: Random fill for remaining fixed + all temp players
    random_fill = remaining_fixed + temp_ids
    random.shuffle(random_fill)
    for sid in random_fill:
        if len(blue) <= len(red):
            blue.append(sid)
        else:
            red.append(sid)

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

    # 将分组结果写入待发送队列，由本地 agent 发到自定义房间
    try:
        from .sync import set_pending_chat_message

        blue_names = [
            p.summoner_nickname + (" (临时)" if p.is_temporary else "")
            for p in po_list
            if p.team == 0
        ]
        red_names = [
            p.summoner_nickname + (" (临时)" if p.is_temporary else "")
            for p in po_list
            if p.team == 1
        ]
        msg = (
            f"────────\n"
            f"【内战管理】分组结果\n"
            f"蓝方 ({len(blue_names)}人): {', '.join(blue_names)}\n"
            f"红方 ({len(red_names)}人): {', '.join(red_names)}"
        )
        set_pending_chat_message(msg)
    except Exception:
        pass  # 不阻塞分组结果

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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Summoner
from ..schemas import SummonerCreate, SummonerUpdate, SummonerOut
from ..lcu import LcuManager

router = APIRouter(prefix="/api/summoners", tags=["summoners"])


def get_lcu() -> LcuManager:
    from ..main import lcu_manager
    return lcu_manager


@router.get("", response_model=list[SummonerOut])
def list_summoners(db: Session = Depends(get_db)):
    return db.query(Summoner).order_by(Summoner.created_at.desc()).all()


@router.post("", response_model=SummonerOut)
def create_summoner(
    data: SummonerCreate,
    db: Session = Depends(get_db),
    lcu: LcuManager = Depends(get_lcu),
):
    # 解析 riot_id = "name#tag"
    if "#" not in data.riot_id:
        raise HTTPException(400, "召唤师ID格式错误，需要 name#tag 格式，如 被绑的提莫#56022")
    game_name, tag_line = data.riot_id.split("#", 1)
    game_name = game_name.strip()
    tag_line = tag_line.strip()
    if not game_name or not tag_line:
        raise HTTPException(400, "召唤师ID格式错误")

    # 判重
    existing = (
        db.query(Summoner)
        .filter(Summoner.game_name == game_name, Summoner.tag_line == tag_line)
        .first()
    )
    if existing:
        raise HTTPException(400, "该召唤师已存在")

    # 尝试通过 Riot Client API 解析 PUUID
    puuid = None
    if lcu.connected:
        try:
            puuid = lcu.resolve_puuid(game_name, tag_line)
        except Exception:
            pass

    summoner = Summoner(
        game_name=game_name,
        tag_line=tag_line,
        puuid=puuid,
        nickname=data.nickname,
    )
    db.add(summoner)
    db.commit()
    db.refresh(summoner)
    return summoner


@router.put("/{summoner_id}/puuid", response_model=SummonerOut)
def update_summoner_puuid(
    summoner_id: int,
    data: SummonerUpdate,
    db: Session = Depends(get_db),
):
    """Agent 通过本地 LCU 解析到 PUUID 后调用此接口更新"""
    s = db.query(Summoner).filter(Summoner.id == summoner_id).first()
    if not s:
        raise HTTPException(404, "召唤师不存在")
    if not data.puuid:
        raise HTTPException(400, "puuid 不能为空")
    s.puuid = data.puuid
    db.commit()
    db.refresh(s)
    return s


@router.put("/{summoner_id}", response_model=SummonerOut)
def update_summoner(
    summoner_id: int,
    data: SummonerUpdate,
    db: Session = Depends(get_db),
):
    s = db.query(Summoner).filter(Summoner.id == summoner_id).first()
    if not s:
        raise HTTPException(404, "召唤师不存在")
    if data.nickname is not None:
        s.nickname = data.nickname
    if data.is_active is not None:
        s.is_active = data.is_active
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{summoner_id}")
def delete_summoner(summoner_id: int, db: Session = Depends(get_db)):
    s = db.query(Summoner).filter(Summoner.id == summoner_id).first()
    if not s:
        raise HTTPException(404, "召唤师不存在")
    db.delete(s)
    db.commit()
    return {"ok": True}

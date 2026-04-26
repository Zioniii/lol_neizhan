import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .lcu import LcuManager
from .routers import summoners, matches, sync, stats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局 LCU 管理器
lcu_manager = LcuManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时尝试连接 LCU
    logger.info("正在检测 League Client...")
    if lcu_manager.refresh():
        auth = lcu_manager._auth
        logger.info(f"LCU 已连接 (port={auth.port}, tencent={auth.is_tencent})")
    else:
        logger.info("LCU 未检测到，同步功能将不可用（其他功能不受影响）")
    yield


app = FastAPI(
    title="LOL 内战管理",
    description="召唤师管理 / 内战随机分组 / 战绩同步 / 胜率统计",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(summoners.router)
app.include_router(matches.router)
app.include_router(sync.router)
app.include_router(stats.router)


@app.get("/api/lcu-status")
def lcu_status():
    if not lcu_manager.connected:
        return {"connected": False, "is_tencent": False}
    summoner_name = None
    try:
        data = lcu_manager.get_current_summoner()
        if data:
            summoner_name = f"{data.get('gameName', '')}#{data.get('tagLine', '')}"
    except Exception:
        pass
    return {
        "connected": True,
        "summoner_name": summoner_name,
        "region": lcu_manager._auth.region if lcu_manager._auth else "",
        "is_tencent": lcu_manager.is_tencent,
    }


@app.post("/api/lcu-refresh")
def lcu_refresh():
    ok = lcu_manager.refresh()
    if ok:
        return {"connected": True, "message": "LCU 已连接"}
    return {"connected": False, "message": "未检测到 LCU，请确认 LOL 客户端已启动"}


if __name__ == "__main__":
    import uvicorn
    # 初始化数据库
    Base.metadata.create_all(bind=engine)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8766, reload=False)

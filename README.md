# LoL 内战管理系统

管理英雄联盟内战（自定义组队）的 Web 应用。支持选手管理、自动分组、战绩同步与统计。

## 功能

- **选手管理** — 添加选手、设置活跃状态、自动解析 PUUID
- **随机分组** — 从活跃选手中随机分边，支持连续同边限制和胜率平衡
- **战绩同步** — 本地 Agent 通过 SGP API 拉取对局数据推送至服务器
- **数据统计** — 胜率、KDA 排行、英雄统计、互相战绩
- **对局历史** — 查看已同步的内战历史记录

## 架构

```
backend/    FastAPI + SQLAlchemy + SQLite
frontend/   React + TypeScript + Vite + TailwindCSS
scripts/    sync-agent (CLI) / sync_tray (系统托盘)
```

Server 无 LCU 依赖，仅做 CRUD/分组/统计。每个玩家本地运行 sync-agent，连接 League Client 拉取数据后推送到服务器。

## 快速开始

### 后端

```bash
pip install -r requirements.txt
python -m backend.main
# 启动在 http://localhost:8766
```

### 前端

```bash
cd frontend
npm install
npm run dev
# 启动在 http://localhost:5173，代理 /api 到 :8766
```

### 战绩同步

在本地有 LOL 客户端的机器上运行：

```bash
# 一次性同步
python scripts/sync-agent.py --server http://服务器地址:8766

# 托盘常驻（自动检测 LCU 变化）
python scripts/sync_tray.py
```

或下载编译好的 `LOL-Sync-Agent.exe` 双击运行。

## 部署

```bash
# 构建前端
cd frontend && npm run build

# 上传至服务器，重启服务
systemctl restart lol-neizhan.service
```

详细部署信息见 `CLAUDE.md`。

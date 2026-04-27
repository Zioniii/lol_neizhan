# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LoL内战管理系统 — a hybrid-deployed web app for managing in-house League of Legends matches. Server handles CRUD/grouping/stats (no LCU dependency). Each player runs a local sync agent that connects to their League Client and pushes match data to the server.

## Architecture

```
backend/         — FastAPI server (Python)
  main.py         — App entry, CORS, static mount, LCU lifecycle
  database.py     — SQLAlchemy + SQLite engine/session
  models.py       — ORM: Summoner, Match, MatchParticipant, GameRecord, SyncLog
  schemas.py      — Pydantic request/response models
  champion_map.py — EN→CN champion name mapping dictionary
  routers/        — API routes (summoners, matches, sync, stats)
  lcu/            — League Client integration layer
    lockfile.py   - Process discovery via psutil, parses --app-port/--riotclient flags
    client.py     - LcuManager: manages HTTP connections to LCU & Riot Client APIs
    sgp.py        - SgpClient: Riot SGP API wrapper for cross-region match history queries
frontend/        — React SPA (TypeScript, Vite, TailwindCSS, TanStack Query)
  src/
    api/index.ts — All API calls, request helpers, TypeScript interfaces
    pages/       — 6 pages: Summoners, Pool, Match, Sync, Matches, Stats
    components/  — Layout.tsx (nav header + mobile bottom nav)
scripts/         — Standalone sync tools (no FastAPI dependency)
  sync-agent.py  — CLI: LCU→SGP→server push
  sync_tray.py   — PyInstaller-bundled system tray app with auto-sync
build/           — PyInstaller build output (LOL-Sync-Agent.exe)
```

## Key Design Decisions

- **Hybrid deployment**: Server is stateless (no LCU). Sync agents run on each player's machine and push via `POST /api/sync/push`.
- **国服/全球服 dual support**: Lockfile discovery handles both WeGame (Tencent) and Riot global clients via distinct command-line flags.
- **Cross-region sync**: Uses Riot SGP API with JWT tokens from LCU, queries all 8 Tencent servers to find all games.
- **内战 detection**: A game is classified as "civil war" if both teams have at least one tracked player (by PUUID), and total participants >= 6.
- **SQLite**: Single-file database shared by server and sync agents (no write conflicts since only the server writes after push).
- **Champion names** are stored in Chinese throughout (translated via `champion_map.py` during sync).

## Development Commands

### Backend
```bash
# Run server (reload enabled for dev)
python -m backend.main

# The server starts on port 8766 with SQLite at lol_neizhan.db
```

### Frontend
```bash
cd frontend
npm install      # first time only
npm run dev      # dev server on :5173, proxies /api to :8766
npm run build    # production build → frontend/dist/
```

### Sync Agent
```bash
# One-shot sync (run locally with League Client running)
python scripts/sync-agent.py --server http://localhost:8766

# Watch mode (auto-detect LCU restart/account change)
python scripts/sync-agent.py --server http://localhost:8766 --watch

# Limit to specific summoners and date range
python scripts/sync-agent.py --server http://localhost:8766 --summoner-id 1 2 3 --days 30
```

### PyInstaller Build
```bash
pyinstaller LOL-Sync-Agent.spec
# Outputs to build/LOL-Sync-Agent/
```

## API Routes

| Prefix | Purpose | LCU Required |
|--------|---------|-------------|
| `GET/POST/PUT/DELETE /api/summoners` | Summoner CRUD | No (PUUID resolve optional) |
| `GET/POST/DELETE /api/matches` | Match CRUD + random team division | No |
| `GET /api/matches/history` | Paginated game history from synced GameRecords | No |
| `POST /api/sync` | Server-side sync (uses local LCU) | **Yes** |
| `POST /api/sync/push` | Agent push endpoint | No |
| `GET /api/sync/status\|logs\|pending` | Sync monitoring | No |
| `POST /api/sync/trigger` | Notify agents to sync | No |
| `GET /api/stats/summoners\|head-to-head\|champions` | Statistics | No |
| `GET /api/lcu-status\|POST /api/lcu-refresh` | LCU connection status | **Yes** |

## Important Data Flow

1. **Add summoner**: POST creates Summoner with `game_name#tag_line`, optionally resolves PUUID via LCU
2. **Sync data**: Agent on each machine reads LCU tokens → queries SGP API across all Tencent servers → pushes games with full participant data via `/api/sync/push`
3. **Civil war filter**: Server rejects games with <6 participants or games where either team has zero tracked players
4. **Deduplication**: `(riot_game_id, summoner_id)` unique constraint prevents duplicate GameRecords

const BASE = '/api'

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const msg = await res.json().then((d) => d.detail).catch(() => res.statusText)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── summoners ──

export interface SummonerOut {
  id: number
  game_name: string
  tag_line: string
  puuid: string | null
  nickname: string
  is_active: boolean
  created_at: string
  updated_at: string
  riot_id?: string
}

export function listSummoners() {
  return request<SummonerOut[]>('/summoners')
}

export function createSummoner(riot_id: string, nickname: string) {
  return request<SummonerOut>('/summoners', {
    method: 'POST',
    body: JSON.stringify({ riot_id, nickname }),
  })
}

export function updateSummoner(id: number, data: { nickname?: string; is_active?: boolean }) {
  return request<SummonerOut>(`/summoners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteSummoner(id: number) {
  return request(`/summoners/${id}`, { method: 'DELETE' })
}

// ── matches ──

export interface MatchParticipantOut {
  id: number
  summoner_id: number
  summoner_name: string
  summoner_nickname: string
  team: number
  is_temporary: boolean
}

export interface MatchOut {
  id: number
  name: string | null
  created_at: string
  participants: MatchParticipantOut[]
}

export function listMatches() {
  return request<MatchOut[]>('/matches')
}

export function createMatch(
  summoner_ids: number[],
  temp_players: string[] = [],
  name?: string,
  side_limit: number = 2,
  win_rate_balance: boolean = false,
) {
  return request<MatchOut>('/matches', {
    method: 'POST',
    body: JSON.stringify({ summoner_ids, temp_players, name, side_limit, win_rate_balance }),
  })
}

export function deleteMatch(id: number) {
  return request(`/matches/${id}`, { method: 'DELETE' })
}

// ── sync ──

export interface SyncStatus {
  lcu_connected: boolean
  summoners: Array<{
    summoner_id: number
    riot_id: string
    nickname: string
    puuid: string | null
    total_games_synced: number
    last_sync: string | null
    last_sync_status: string | null
  }>
}

export function getSyncStatus() {
  return request<SyncStatus>('/sync/status')
}

export interface SyncResult {
  total_games_synced: number
  status: string
  error: string | null
}

export function syncMatchHistory(data: {
  summoner_ids?: number[]
  start_date?: string
  end_date?: string
}) {
  return request<SyncResult>('/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── stats ──

export interface SummonerStats {
  summoner_id: number
  riot_id: string
  nickname: string
  total_games: number
  wins: number
  losses: number
  win_rate: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_kda: number
}

export function getSummonerStats() {
  return request<SummonerStats[]>('/stats/summoners')
}

export interface HeadToHeadEntry {
  summoner_id: number
  riot_id: string
  nickname: string
  games_played: number
  wins: number
  losses: number
  win_rate: number
}

export function getHeadToHead() {
  return request<Record<string, HeadToHeadEntry[]>>('/stats/head-to-head')
}

export function getChampionStats() {
  return request<Record<string, Array<{ champion: string; games: number; wins: number; win_rate: number }>>>('/stats/champions')
}

// ── lcu ──

// ── match history ──

export interface MatchHistoryPlayer {
  riot_id: string
  champion: string
  kills: number
  deaths: number
  assists: number
  win: boolean
  summoner_name: string
  nickname: string | null
  in_pool: boolean
}

export interface MatchHistoryEntry {
  riot_game_id: string
  game_creation: string | null
  game_duration: number
  region: string
  blue_win: boolean | null
  red_win: boolean | null
  our_team: string
  our_team_win: boolean | null
  blue_players: MatchHistoryPlayer[]
  red_players: MatchHistoryPlayer[]
}

export function getMatchHistory(page: number = 1) {
  return request<{ matches: MatchHistoryEntry[]; total: number; page: number; page_size: number }>(
    `/matches/history?page=${page}&page_size=10`,
  )
}

// ── sync logs ──

export interface SyncLogEntry {
  id: number
  summoner_id: number
  summoner_nickname: string
  sync_start: string
  sync_end: string | null
  games_fetched: number
  status: string
  error_message: string | null
}

export function getSyncLogs() {
  return request<SyncLogEntry[]>('/sync/logs')
}

export function triggerSync() {
  return request<{ ok: boolean }>('/sync/trigger', { method: 'POST' })
}

// ── lcu ──

export function getLcuStatus() {
  return request<{ connected: boolean; summoner_name: string | null; region: string | null }>('/lcu-status')
}

export function refreshLcu() {
  return request<{ connected: boolean; message: string }>('/lcu-refresh', { method: 'POST' })
}

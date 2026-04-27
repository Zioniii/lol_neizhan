import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMatchHistory, MatchHistoryEntry } from '../api'
import {
  History, ChevronLeft, ChevronRight, Clock, Trophy, Crosshair,
} from 'lucide-react'

export default function MatchesPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['match-history', page],
    queryFn: () => getMatchHistory(page),
    staleTime: 30_000,
  })

  const matches = data?.matches ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 10
  const totalPages = Math.ceil(total / pageSize)

  const groups = useMemo(() => {
    const map = new Map<string, MatchHistoryEntry[]>()
    for (const m of matches) {
      const date = m.game_creation
        ? new Date(m.game_creation).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '未知日期'
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(m)
    }
    return Array.from(map.entries())
  }, [matches])

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display tracking-wider text-slate-100">对局记录</h2>
        <p className="text-slate-400 mt-1.5">已同步的内战历史对局</p>
      </div>

      {matches.length === 0 ? (
        <div className="card rounded-xl">
          <div className="empty-state">
            <History className="empty-state-icon" />
            <p className="empty-state-title">还没有对局记录</p>
            <p className="empty-state-desc">请先到"战绩同步"页面拉取历史对战记录</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(([date, dayMatches]) => (
            <div key={date}>
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
                  <Clock className="w-4 h-4 text-blue-400/80" />
                  <span className="text-sm font-bold text-blue-400/80 tracking-wider">{date}</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-blue-500/15 to-transparent" />
                <span className="text-sm text-slate-500">{dayMatches.length}场</span>
              </div>
              <div className="space-y-2.5">
                {dayMatches.map((m) => (
                  <MatchCard key={m.riot_game_id} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button className="btn-secondary !px-3 !py-2 text-sm rounded" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-slate-600 px-1 text-xs">···</span>}
                <button className={`btn !px-3 !py-2 text-sm rounded font-semibold ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPage(p)}>{p}</button>
              </span>
            ))}
          <button className="btn-secondary !px-3 !py-2 text-sm rounded" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            下一页<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match: m }: { match: MatchHistoryEntry }) {
  const date = m.game_creation
    ? new Date(m.game_creation).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const duration = m.game_duration
    ? `${Math.floor(m.game_duration / 60)}分${m.game_duration % 60}秒`
    : ''
  const isWin = m.our_team_win === true
  const isLoss = m.our_team_win === false

  return (
    <div className={`rounded-xl overflow-hidden bg-[#1E293B] border border-l-4 transition-colors ${
      isWin ? 'border-emerald-500/20 border-l-emerald-500'
        : isLoss ? 'border-rose-500/20 border-l-rose-500'
        : 'border-[#334155] border-l-slate-600'
    }`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between border-b border-[#334155] ${
        isWin ? 'bg-emerald-500/[0.02]' : isLoss ? 'bg-rose-500/[0.02]' : ''
      }`}>
        <div className="flex items-center gap-3 text-xs">
          {isWin !== null && (
            <span className={`font-bold tracking-wider flex items-center gap-1 ${
              isWin ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {isWin ? <Trophy className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
              {isWin ? '胜利' : '失败'}
            </span>
          )}
          <span className="text-slate-500">{date}</span>
          {duration && <span className="text-slate-600">{duration}</span>}
        </div>
        <span className="text-[10px] text-slate-600">{m.region}</span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 divide-x divide-[#334155]">
        <TeamSection players={m.blue_players} win={m.blue_win} side="blue" />
        <TeamSection players={m.red_players} win={m.red_win} side="red" />
      </div>
    </div>
  )
}

function TeamSection({ players, win, side }: {
  players: MatchHistoryEntry['blue_players']; win: boolean | null; side: 'blue' | 'red'
}) {
  const isBlue = side === 'blue'
  return (
    <div className={isBlue ? 'bg-blue-500/[0.015]' : 'bg-red-500/[0.015]'}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#334155]/50">
        <span className={`w-0.5 h-3 rounded ${isBlue ? 'bg-blue-500' : 'bg-red-500'}`} />
        <span className={`text-[10px] font-semibold tracking-wider ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>
          {side === 'blue' ? '蓝方' : '红方'}
        </span>
        {win !== null && (
          <span className={`ml-auto text-[10px] font-medium ${win ? 'text-emerald-400' : 'text-slate-500'}`}>
            {win ? '胜' : '负'}
          </span>
        )}
      </div>
      <div className="divide-y divide-[#334155]/30">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <span className={`font-semibold w-14 truncate shrink-0 ${p.in_pool ? 'text-slate-100' : 'text-slate-500'}`}>
              {p.nickname ?? p.riot_id}
            </span>
            <span className="text-slate-500 w-12 truncate text-[10px]">{p.champion}</span>
            <span className="font-mono shrink-0 ml-auto">
              <span className="text-emerald-400 font-bold">{p.kills}</span>
              <span className="text-slate-600"> / </span>
              <span className="text-rose-400 font-bold">{p.deaths}</span>
              <span className="text-slate-600"> / </span>
              <span className="text-emerald-400 font-bold">{p.assists}</span>
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-slate-600 text-center">空</div>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton h-8 w-28 rounded-lg" />
      <div className="skeleton h-4 w-44 rounded" />
      {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 w-full rounded-xl" />)}
    </div>
  )
}

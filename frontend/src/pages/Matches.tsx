import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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
      {/* Header */}
      <div>
        <h2 className="page-title">对局记录</h2>
        <p className="page-subtitle">已同步的内战历史对局</p>
      </div>

      {matches.length === 0 ? (
        <div className="card rounded-xl">
          <div className="empty-state">
            <History className="w-12 h-12 mb-4 text-text-muted" />
            <p className="text-base font-semibold text-text-secondary mb-1">还没有对局记录</p>
            <p className="text-sm text-text-muted">请先到"战绩同步"页面拉取历史对战记录</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(([date, dayMatches]) => (
            <div key={date}>
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-bg-secondary border border-border-default">
                  <Clock className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-bold text-text-secondary tracking-wider">{date}</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-border-default to-transparent" />
                <span className="text-sm text-text-muted">{dayMatches.length}场</span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button className="btn-secondary !px-3 !py-2 text-sm rounded-lg" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-text-muted px-1 text-xs">···</span>}
                <button className={`btn !px-3 !py-2 text-sm rounded-lg font-semibold ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPage(p)}>{p}</button>
              </span>
            ))}
          <button className="btn-secondary !px-3 !py-2 text-sm rounded-lg" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl overflow-hidden bg-bg-primary border transition-colors ${
        isWin ? 'border-l-4 border-l-text-primary border-border-default'
          : isLoss ? 'border-l-4 border-l-text-muted border-border-default'
          : 'border-border-default'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between border-b border-border-default ${
        isWin ? 'bg-bg-secondary' : isLoss ? 'bg-bg-secondary' : ''
      }`}>
        <div className="flex items-center gap-3 text-xs">
          {isWin !== null && (
            <span className={`font-bold tracking-wider flex items-center gap-1 ${
              isWin ? 'text-text-primary' : 'text-text-muted'
            }`}>
              {isWin ? <Trophy className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
              {isWin ? '胜利' : '失败'}
            </span>
          )}
          <span className="text-text-muted">{date}</span>
          {duration && <span className="text-text-tertiary">{duration}</span>}
        </div>
        <span className="text-[10px] text-text-muted">{m.region}</span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 divide-x divide-border-default">
        <TeamSection players={m.blue_players} win={m.blue_win} side="blue" />
        <TeamSection players={m.red_players} win={m.red_win} side="red" />
      </div>
    </motion.div>
  )
}

function TeamSection({ players, win, side }: {
  players: MatchHistoryEntry['blue_players']; win: boolean | null; side: 'blue' | 'red'
}) {
  const isBlue = side === 'blue'
  return (
    <div className={isBlue ? 'bg-bg-secondary/50' : 'bg-bg-secondary/30'}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-default/50">
        <span className={`w-0.5 h-3 rounded ${isBlue ? 'bg-text-primary' : 'bg-text-tertiary'}`} />
        <span className={`text-[10px] font-semibold tracking-wider ${isBlue ? 'text-text-primary' : 'text-text-tertiary'}`}>
          {side === 'blue' ? '蓝方' : '红方'}
        </span>
        {win !== null && (
          <span className={`ml-auto text-[10px] font-medium ${win ? 'text-text-secondary' : 'text-text-muted'}`}>
            {win ? '胜' : '负'}
          </span>
        )}
      </div>
      <div className="divide-y divide-border-default/30">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <span className={`font-semibold w-14 truncate shrink-0 ${p.in_pool ? 'text-text-primary' : 'text-text-muted'}`}>
              {p.nickname ?? p.riot_id}
            </span>
            <span className="text-text-muted w-12 truncate text-[10px]">{p.champion}</span>
            <span className="font-mono shrink-0 ml-auto">
              <span className="text-text-secondary font-bold">{p.kills}</span>
              <span className="text-text-muted"> / </span>
              <span className="text-text-secondary font-bold">{p.deaths}</span>
              <span className="text-text-muted"> / </span>
              <span className="text-text-secondary font-bold">{p.assists}</span>
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-text-muted text-center">空</div>
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

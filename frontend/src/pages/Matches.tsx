import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMatchHistory, MatchHistoryEntry } from '../api'

export default function MatchesPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['match-history', page],
    queryFn: () => getMatchHistory(page),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <div className="text-center text-gray-400 py-20">加载中...</div>
  }

  const matches = data?.matches ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 10
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">对局记录</h2>
        <p className="text-gray-500 mt-1">已同步的内战历史对局</p>
      </div>

      {matches.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">🎮</p>
          <p className="font-medium">还没有对局记录</p>
          <p className="text-sm mt-1">请先到「战绩同步」页面拉取历史对战记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m) => (
            <MatchCard key={m.riot_game_id} match={m} />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secondary !px-3 !py-1.5 text-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-400 px-1">...</span>}
                <button
                  className={`!px-3 !py-1.5 text-sm rounded-xl font-medium transition-colors ${
                    p === page
                      ? 'bg-accent-blue text-white'
                      : 'btn-secondary'
                  }`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            className="btn-secondary !px-3 !py-1.5 text-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match: m }: { match: MatchHistoryEntry }) {
  const date = m.game_creation
    ? new Date(m.game_creation).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const duration = m.game_duration
    ? `${Math.floor(m.game_duration / 60)}分${m.game_duration % 60}秒`
    : ''

  return (
    <div className="glass-card overflow-hidden">
      {/* 头部 */}
      <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {m.region} · {date}
          </span>
          <span className="text-xs text-gray-400">{duration}</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{m.riot_game_id}</span>
      </div>

      {/* 两队 */}
      <div className="divide-y divide-black/5">
        <TeamRow
          side="蓝方"
          teamId={100}
          players={m.blue_players}
          win={m.blue_win}
        />
        <TeamRow
          side="红方"
          teamId={200}
          players={m.red_players}
          win={m.red_win}
        />
      </div>
    </div>
  )
}

function TeamRow({
  side,
  players,
  win,
}: {
  side: string
  teamId: number
  players: MatchHistoryEntry['blue_players']
  win: boolean | null
}) {
  const bgClass = side === '蓝方' ? 'bg-blue-50/50' : 'bg-red-50/50'
  const colorClass = side === '蓝方' ? 'text-blue-700' : 'text-red-700'
  const barClass = side === '蓝方' ? 'bg-blue-500' : 'bg-red-500'

  return (
    <div className={`px-5 py-3 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-5 rounded-full ${barClass}`} />
        <span className={`text-xs font-bold ${colorClass}`}>
          {side} {win ? '胜' : win === false ? '负' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {players.map((p, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm ${
              p.in_pool ? 'bg-white/80 shadow-sm' : ''
            }`}
          >
            {p.in_pool ? (
              <span className="font-bold text-gray-900">{p.nickname ?? p.riot_id}</span>
            ) : (
              <span className="text-gray-500 truncate max-w-[120px]">
                {p.riot_id}
              </span>
            )}
            <span className="text-gray-300 text-xs">{p.champion}</span>
            <span className="ml-auto font-mono text-xs text-gray-500">
              {p.kills}/{p.deaths}/{p.assists}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

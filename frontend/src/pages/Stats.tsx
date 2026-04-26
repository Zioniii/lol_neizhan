import { useQuery } from '@tanstack/react-query'
import { getSummonerStats, getHeadToHead, getChampionStats } from '../api'

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['summoner-stats'],
    queryFn: getSummonerStats,
    staleTime: 30_000,
  })
  const { data: h2h } = useQuery({
    queryKey: ['head-to-head'],
    queryFn: getHeadToHead,
    staleTime: 30_000,
  })
  const { data: champStats } = useQuery({
    queryKey: ['champion-stats'],
    queryFn: getChampionStats,
    staleTime: 30_000,
  })

  if (isLoading) {
    return <div className="text-center text-gray-400 py-20">加载中...</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">胜率统计</h2>
        <p className="text-gray-500 mt-1">基于同步的内战历史数据</p>
      </div>

      {/* 总览卡片 */}
      {stats && stats.length > 0 && (
        <>
          {/* 排行榜 */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-black/5">
              <h3 className="font-bold">综合排行</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3 w-10">#</th>
                    <th className="px-6 py-3">选手</th>
                    <th className="px-6 py-3 text-right">场次</th>
                    <th className="px-6 py-3 text-right">胜</th>
                    <th className="px-6 py-3 text-right">负</th>
                    <th className="px-6 py-3 text-right">胜率</th>
                    <th className="px-6 py-3 text-right">KDA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {stats.map((s, i) => (
                    <tr key={s.summoner_id} className="hover:bg-black/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <Medal rank={i + 1} />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-bold">{s.nickname}</span>
                        <span className="text-gray-400 text-xs ml-2">{s.riot_id}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium">{s.total_games}</td>
                      <td className="px-6 py-3.5 text-right text-emerald-600 font-medium">{s.wins}</td>
                      <td className="px-6 py-3.5 text-right text-rose-600 font-medium">{s.losses}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span
                          className={`font-bold text-sm px-2.5 py-1 rounded-full ${
                            s.win_rate >= 60
                              ? 'bg-emerald-50 text-emerald-700'
                              : s.win_rate >= 40
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {s.win_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-sm">
                        <span className="text-gray-600">
                          {s.avg_kills}/{s.avg_deaths}/{s.avg_assists}
                        </span>
                        <span className="ml-1.5 font-medium text-gray-500">
                          ({s.avg_kda})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* KDA 对比条 */}
          <div className="glass-card p-5">
            <h3 className="font-bold mb-4">KDA 对比</h3>
            <div className="space-y-3">
              {[...stats]
                .sort((a, b) => b.avg_kda - a.avg_kda)
                .map((s) => (
                  <div key={s.summoner_id} className="flex items-center gap-3">
                    <span className="w-20 text-sm font-medium truncate">{s.nickname}</span>
                    <div className="flex-1 h-6 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-blue flex items-center justify-end pr-2 text-xs text-white font-mono font-medium"
                        style={{
                          width: `${Math.min((s.avg_kda / 5) * 100, 100)}%`,
                        }}
                      >
                        {s.avg_kda}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {stats && stats.length === 0 && (
        <div className="glass-card p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium">还没有统计数据</p>
          <p className="text-sm mt-1">请先到"战绩同步"页面拉取历史对战记录</p>
        </div>
      )}

      {/* 英雄使用统计 */}
      {champStats && Object.keys(champStats).length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold mb-4">英雄使用统计</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(champStats).map(([name, champs]) => (
              <div key={name} className="p-4 rounded-2xl bg-black/[0.02]">
                <p className="font-bold text-sm mb-2">{name.split('#')[0]}</p>
                <div className="space-y-1.5">
                  {champs.slice(0, 5).map((c) => (
                    <div key={c.champion} className="flex items-center justify-between text-sm">
                      <span>{c.champion}</span>
                      <span className="text-gray-500">
                        {c.games}场 {c.win_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 互相战绩 */}
      {h2h && Object.keys(h2h).length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold mb-4">互相战绩</h3>
          <div className="space-y-4">
            {Object.entries(h2h).slice(0, 10).map(([name, opponents]) => (
              <div key={name} className="p-4 rounded-2xl bg-black/[0.02]">
                <p className="font-bold text-sm mb-2">{name.split('#')[0]} 的对局记录</p>
                <div className="flex flex-wrap gap-2">
                  {opponents.slice(0, 8).map((o) => (
                    <span
                      key={o.summoner_id}
                      className={`tag text-xs ${
                        o.win_rate >= 60
                          ? 'border-emerald-200 text-emerald-700'
                          : o.win_rate <= 40
                          ? 'border-rose-200 text-rose-700'
                          : ''
                      }`}
                    >
                      vs {o.nickname}: {o.wins}W{o.losses}L ({o.win_rate}%)
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="text-sm text-gray-400 font-mono">{rank}</span>
}

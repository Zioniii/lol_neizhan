import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSummonerStats, getHeadToHead, getChampionStats } from '../api'
import {
  BarChart3, TrendingUp, Swords, Trophy, Medal, ChevronUp, ChevronDown, Users, Crosshair, Shield,
} from 'lucide-react'

type Tab = 'ranking' | 'champions' | 'h2h'

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>('ranking')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['summoner-stats'], queryFn: getSummonerStats, staleTime: 30_000,
  })
  const { data: h2h } = useQuery({
    queryKey: ['head-to-head'], queryFn: getHeadToHead, staleTime: 30_000,
  })
  const { data: champStats } = useQuery({
    queryKey: ['champion-stats'], queryFn: getChampionStats, staleTime: 30_000,
  })

  if (isLoading) return <LoadingSkeleton />

  const noData = !stats || stats.length === 0

  // Compute dashboard metrics
  const totalGames = stats?.reduce((s, x) => s + x.total_games, 0) ?? 0
  const bestWinRate = stats?.length ? Math.max(...stats.map(s => s.win_rate)) : 0
  const bestWinRatePlayer = stats?.find(s => s.win_rate === bestWinRate)
  const bestKda = stats?.length ? Math.max(...stats.map(s => s.avg_kda)) : 0
  const bestKdaPlayer = stats?.find(s => s.avg_kda === bestKda)

  const TABS: { key: Tab; label: string; icon: typeof Trophy }[] = [
    { key: 'ranking', label: '综合排行', icon: Trophy },
    { key: 'champions', label: '英雄统计', icon: Crosshair },
    { key: 'h2h', label: '互相战绩', icon: Swords },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display tracking-wider text-slate-100">胜率统计</h2>
        <p className="text-slate-400 mt-1.5">基于同步的内战历史数据</p>
      </div>

      {noData ? (
        <div className="card rounded-xl">
          <div className="empty-state">
            <BarChart3 className="empty-state-icon" />
            <p className="empty-state-title">还没有统计数据</p>
            <p className="empty-state-desc">请先到"战绩同步"页面拉取历史对战记录</p>
          </div>
        </div>
      ) : (
        <>
          {/* Dashboard Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/8 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-blue-400/80" />
              </div>
              <div>
                <div className="stat-value text-blue-400/80">{stats?.length ?? 0}</div>
                <div className="stat-label">选手</div>
              </div>
            </div>
            <div className="card rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/8 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6 text-blue-400/80" />
              </div>
              <div>
                <div className="stat-value text-blue-400/80">{totalGames}</div>
                <div className="stat-label">总场次</div>
              </div>
            </div>
            <div className="card rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/8 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-emerald-400/80" />
              </div>
              <div>
                <div className="stat-value text-emerald-400/80">{bestWinRate}%</div>
                <div className="stat-label truncate">最高胜率 {bestWinRatePlayer?.nickname}</div>
              </div>
            </div>
            <div className="card rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/8 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-amber-400/80" />
              </div>
              <div>
                <div className="stat-value text-amber-400/80">{bestKda.toFixed(1)}</div>
                <div className="stat-label truncate">最高 KDA {bestKdaPlayer?.nickname}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#334155]">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  tab === key
                    ? 'text-blue-400 border-blue-500/60'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
                onClick={() => setTab(key)}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === 'ranking' && <RankingTab stats={stats!} />}
          {tab === 'champions' && <ChampionsTab champStats={champStats} />}
          {tab === 'h2h' && <HeadToHeadTab h2h={h2h} />}
        </>
      )}
    </div>
  )
}

/* ── Ranking Tab ── */
function RankingTab({ stats }: { stats: NonNullable<ReturnType<typeof getSummonerStats> extends Promise<infer T> ? T : never> }) {
  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>选手</th>
                <th className="text-right">场次</th>
                <th className="text-right hidden sm:table-cell">胜</th>
                <th className="text-right hidden sm:table-cell">负</th>
                <th className="text-right">胜率</th>
                <th className="text-right hidden md:table-cell">KDA</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.summoner_id}>
                  <td><RankBadge rank={i + 1} /></td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center text-white text-xs font-bold shrink-0">{s.nickname[0]}</div>
                      <div>
                        <span className="font-bold text-slate-100 text-sm">{s.nickname}</span>
                        <span className="text-slate-500 text-xs ml-2 font-mono hidden sm:inline">{s.riot_id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-semibold text-slate-100 text-sm">{s.total_games}</td>
                  <td className="text-right text-emerald-400 font-semibold text-sm hidden sm:table-cell">{s.wins}</td>
                  <td className="text-right text-rose-400/80 font-semibold text-sm hidden sm:table-cell">{s.losses}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-14 h-2.5 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${s.win_rate}%`, background: s.win_rate >= 60 ? '#10B981' : s.win_rate >= 40 ? '#F59E0B' : '#F43F5E' }} />
                      </div>
                      <span className="text-xs font-bold text-slate-100 w-8 text-right">{s.win_rate}%</span>
                    </div>
                  </td>
                  <td className="text-right hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-400">{s.avg_kills}/{s.avg_deaths}/{s.avg_assists}</span>
                    <span className="ml-1.5 font-semibold text-slate-500 text-xs">({s.avg_kda.toFixed(1)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KDA Bar Chart */}
      {stats.length > 1 && (
        <div className="card rounded-xl p-5">
          <h3 className="font-bold text-slate-100 text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />KDA 排行
          </h3>
          <div className="space-y-2.5">
            {[...stats].sort((a, b) => b.avg_kda - a.avg_kda).map((s, i) => {
              const maxKda = Math.max(...stats.map(x => x.avg_kda))
              const width = Math.min((s.avg_kda / (maxKda || 1)) * 100, 100)
              return (
                <div key={s.summoner_id} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-bold text-slate-600 text-right shrink-0">{i + 1}</span>
                  <span className="w-14 text-xs font-semibold text-slate-100 truncate shrink-0">{s.nickname}</span>
                  <div className="flex-1 h-6 bg-[#0F172A] rounded border border-[#334155] overflow-hidden">
                    <div className="h-full rounded flex items-center justify-end pr-2 text-[11px] text-white font-bold font-mono transition-all duration-500"
                      style={{
                        width: `${Math.max(width, 8)}%`,
                        background: width > 80 ? 'linear-gradient(90deg, #3B82F6, #1D4ED8)' : 'linear-gradient(90deg, #2563EB, #1D4ED8)',
                      }}>
                      {s.avg_kda.toFixed(1)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Champions Tab ── */
function ChampionsTab({ champStats }: { champStats: any }) {
  if (!champStats || Object.keys(champStats).length === 0) {
    return <div className="card rounded-xl p-10 text-center text-slate-500 text-sm">暂无英雄数据</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(champStats).map(([name, champs]: [string, any]) => (
        <div key={name} className="card rounded-xl p-4">
          <p className="font-bold text-sm text-slate-100 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400/80" />
            {name.split('#')[0]}
          </p>
          <div className="space-y-1.5">
            {(champs as any[]).slice(0, 5).map((c) => (
              <div key={c.champion} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 text-xs">{c.champion}</span>
                <span className="text-slate-500 text-xs font-mono">
                  {c.games}场
                  <span className="inline-flex items-center gap-1.5">
                    <div className="w-10 h-2 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${c.win_rate}%`, background: c.win_rate >= 60 ? '#10B981' : c.win_rate >= 40 ? '#F59E0B' : '#F43F5E' }} />
                    </div>
                    <span className={`font-semibold text-xs w-6 text-right ${c.win_rate >= 60 ? 'text-emerald-400/80' : c.win_rate >= 40 ? 'text-amber-400/80' : 'text-rose-400/80'}`}>
                      {c.win_rate}%
                    </span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Head to Head Tab ── */
function HeadToHeadTab({ h2h }: { h2h: any }) {
  if (!h2h || Object.keys(h2h).length === 0) {
    return <div className="card rounded-xl p-10 text-center text-slate-500 text-sm">暂无对战数据</div>
  }

  return (
    <div className="space-y-3">
      {Object.entries(h2h).slice(0, 15).map(([name, opponents]: [string, any]) => (
        <div key={name} className="card rounded-xl p-4">
          <p className="font-bold text-sm text-slate-100 mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-blue-400/80" />
            {name.split('#')[0]} 的对局记录
          </p>
          <div className="flex flex-wrap gap-2">
            {(opponents as any[]).slice(0, 10).map((o) => (
              <span key={o.summoner_id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border ${
                  o.win_rate >= 60 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : o.win_rate <= 40 ? 'bg-rose-500/8 text-rose-400/80 border-rose-500/15'
                  : 'bg-[#0F172A] text-slate-400 border-[#334155]'
                }`}>
                <Swords className="w-3 h-3" />
                vs {o.nickname}: {o.wins}W{o.losses}L
                <span className="opacity-70">({o.win_rate}%)</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Shared Components ── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center gap-1 text-amber-400 font-bold"><Medal className="w-4 h-4" /><span className="text-xs">#1</span></span>
  if (rank === 2) return <span className="inline-flex items-center gap-1 text-slate-300 font-bold"><Medal className="w-4 h-4" /><span className="text-xs">#2</span></span>
  if (rank === 3) return <span className="inline-flex items-center gap-1 text-amber-600 font-bold"><Medal className="w-4 h-4" /><span className="text-xs">#3</span></span>
  return <span className="text-xs text-slate-600 font-mono font-semibold">#{rank}</span>
}

function WinRateBadge({ rate }: { rate: number }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded border ${
      rate >= 60 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : rate >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-rose-400/80 bg-rose-500/8 border-rose-500/15'
    }`}>
      {rate >= 60 ? <ChevronUp className="w-3 h-3" /> : rate <= 40 ? <ChevronDown className="w-3 h-3" /> : null}
      {rate}%
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton h-8 w-28 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      <div className="skeleton h-11 w-80 rounded-lg" />
      <div className="skeleton h-64 w-full rounded-xl" />
    </div>
  )
}

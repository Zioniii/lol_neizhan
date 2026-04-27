import { useQuery } from '@tanstack/react-query'
import { listSummoners, type SummonerOut } from '../api'
import { useNavigate } from 'react-router-dom'
import { UserPlus, CheckCircle, Swords } from 'lucide-react'

export default function PoolPage() {
  const { data: summoners, isLoading } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const navigate = useNavigate()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  const active = summoners?.filter((s) => s.is_active) ?? []
  const inactive = summoners?.filter((s) => !s.is_active) ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-display tracking-wider text-slate-100">选手池</h2>
          <p className="text-slate-400 mt-1.5">{active.length} 名选手可用</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => navigate('/match')}>
          <Swords className="w-4 h-4" />开始内战
        </button>
      </div>

      {active.length === 0 && (
        <div className="card rounded-xl">
          <div className="empty-state">
            <UserPlus className="empty-state-icon" />
            <p className="empty-state-title">选手池为空</p>
            <p className="empty-state-desc mb-4">请先到选手管理页面添加选手</p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              <UserPlus className="w-4 h-4" />去添加选手
            </button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {active.map((s) => (
            <SummonerCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition-colors py-2 list-none">
            <span className="w-0.5 h-4 rounded bg-slate-600" />已移出选手池 ({inactive.length})
          </summary>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 opacity-50">
            {inactive.map((s) => (
              <SummonerCard key={s.id} s={s} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function SummonerCard({ s }: { s: SummonerOut }) {
  const colors = [
    'from-blue-600 to-blue-900',
    'from-indigo-600 to-indigo-900',
    'from-cyan-600 to-blue-900',
    'from-sky-600 to-indigo-800',
    'from-blue-700 to-indigo-900',
    'from-indigo-500 to-blue-800',
    'from-sky-700 to-indigo-900',
    'from-cyan-700 to-blue-800',
  ]
  const colorIdx = (s.nickname.charCodeAt(0) || 0) % colors.length

  return (
    <div className="card-hover rounded-xl p-5 text-center group cursor-pointer">
      <div
        className={`w-16 h-16 mx-auto bg-gradient-to-br ${colors[colorIdx]} rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-transform duration-200 group-hover:scale-105`}
      >
        {s.nickname[0]}
      </div>
      <p className="mt-4 font-bold text-slate-100 truncate">{s.nickname}</p>
      <p className="text-sm text-slate-500 truncate mt-1 font-mono">{s.game_name}#{s.tag_line}</p>
      <div className="mt-4">
        {s.puuid ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/8 border border-emerald-500/15">
            <CheckCircle className="w-3.5 h-3.5" />已就绪
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 bg-slate-500/8 border border-slate-500/15">
            待解析
          </span>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-36 rounded-lg" />
          <div className="skeleton h-4 w-36 rounded" />
        </div>
        <div className="skeleton h-11 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

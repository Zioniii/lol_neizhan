import { useQuery } from '@tanstack/react-query'
import { listSummoners, type SummonerOut } from '../api'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="page-title">选手池</h2>
          <p className="page-subtitle">{active.length} 名选手可用</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => navigate('/match')}>
          <Swords className="w-4 h-4" />开始内战
        </button>
      </div>

      {/* Empty State */}
      {active.length === 0 && (
        <div className="card rounded-xl">
          <div className="empty-state">
            <UserPlus className="w-12 h-12 mb-4 text-text-muted" />
            <p className="text-base font-semibold text-text-secondary mb-1">选手池为空</p>
            <p className="text-sm text-text-muted mb-4">请先到选手管理页面添加选手</p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              <UserPlus className="w-4 h-4" />去添加选手
            </button>
          </div>
        </div>
      )}

      {/* Active Players Grid */}
      {active.length > 0 && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {active.map((s) => (
            <motion.div
              key={s.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.3 }}
            >
              <SummonerCard s={s} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Inactive Section */}
      {inactive.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-sm text-text-muted cursor-pointer hover:text-text-secondary transition-colors py-2 list-none">
            <span className="w-0.5 h-4 rounded bg-border-strong" />
            已移出选手池 ({inactive.length})
          </summary>
          <motion.div
            className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 opacity-50"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            {inactive.map((s) => (
              <motion.div
                key={s.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.3 }}
              >
                <SummonerCard s={s} />
              </motion.div>
            ))}
          </motion.div>
        </details>
      )}
    </div>
  )
}

function SummonerCard({ s }: { s: SummonerOut }) {
  const colors = [
    'bg-neutral-800', 'bg-neutral-700', 'bg-stone-800',
    'bg-gray-800', 'bg-slate-800', 'bg-zinc-800',
    'bg-stone-700', 'bg-gray-700',
  ]
  const colorIdx = (s.nickname.charCodeAt(0) || 0) % colors.length

  return (
    <div className="card-hover rounded-xl p-5 text-center group cursor-pointer">
      <div
        className={`w-16 h-16 mx-auto ${colors[colorIdx]} rounded-xl flex items-center justify-center text-white text-2xl font-bold transition-transform duration-200 group-hover:scale-105`}
      >
        {s.nickname[0]}
      </div>
      <p className="mt-4 font-semibold text-text-primary truncate">{s.nickname}</p>
      <p className="text-sm text-text-tertiary truncate mt-1 font-mono">{s.game_name}#{s.tag_line}</p>
      <div className="mt-4">
        {s.puuid ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary bg-bg-secondary border border-border-default">
            <CheckCircle className="w-3.5 h-3.5" />已就绪
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-default">
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

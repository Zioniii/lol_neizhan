import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listSummoners, type SummonerOut } from '../api'
import { useNavigate } from 'react-router-dom'

export default function PoolPage() {
  const { data: summoners, isLoading } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const navigate = useNavigate()

  if (isLoading) {
    return <div className="text-center text-gray-400 py-20">加载中...</div>
  }

  const active = summoners?.filter((s) => s.is_active) ?? []
  const inactive = summoners?.filter((s) => !s.is_active) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">选手池</h2>
        <p className="text-gray-500 mt-1">
          当前 {active.length} 名可用选手，点击"开始内战"进入分组
        </p>
      </div>

      {/* 活跃选手卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {active.map((s) => (
          <SummonerCard key={s.id} s={s} />
        ))}
        {active.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            选手池为空，请先到
            <button
              className="text-accent-blue font-medium mx-1 hover:underline"
              onClick={() => navigate('/')}
            >
              选手管理
            </button>
            添加选手
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <>
          <div className="mt-8">
            <h3 className="text-lg font-bold text-gray-400 mb-3">
              已移出选手池 ({inactive.length}人)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 opacity-50">
            {inactive.map((s) => (
              <SummonerCard key={s.id} s={s} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SummonerCard({ s }: { s: SummonerOut }) {
  // 用昵称首字生成头像色
  const colors = [
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-emerald-400 to-teal-500',
    'from-orange-400 to-rose-500',
    'from-cyan-400 to-blue-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-purple-500',
    'from-teal-400 to-emerald-500',
  ]
  const colorIdx = (s.nickname.charCodeAt(0) || 0) % colors.length

  return (
    <div className="glass-card p-4 text-center group hover:shadow-lift hover:scale-[1.02] transition-all duration-300">
      <div
        className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white text-xl font-bold shadow-soft`}
      >
        {s.nickname[0]}
      </div>
      <p className="mt-3 font-bold text-sm truncate">{s.nickname}</p>
      <p className="text-xs text-gray-400 truncate mt-0.5">
        {s.game_name}#{s.tag_line}
      </p>
      {s.puuid && (
        <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium">
          已解析
        </span>
      )}
    </div>
  )
}

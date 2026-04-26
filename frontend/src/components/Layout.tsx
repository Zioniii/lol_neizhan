import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getLcuStatus } from '../api'

const NAV_ITEMS = [
  { to: '/', label: '选手管理', icon: '👤' },
  { to: '/pool', label: '选手池', icon: '🏊' },
  { to: '/match', label: '内战分组', icon: '⚔️' },
  { to: '/sync', label: '战绩同步', icon: '🔄' },
  { to: '/matches', label: '对局记录', icon: '📋' },
  { to: '/stats', label: '胜率统计', icon: '📊' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { data: lcu } = useQuery({ queryKey: ['lcu-status'], queryFn: getLcuStatus, refetchInterval: 30_000 })

  return (
    <div className="min-h-screen">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="bg-gradient-blue bg-clip-text text-transparent">
                LOL 内战
              </span>
            </h1>
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3.5 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-accent-blue text-white shadow-soft'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                lcu?.connected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  lcu?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {lcu?.connected
                ? (lcu.summoner_name ?? 'LCU 已连接')
                : 'LCU 未连接'}
            </span>
          </div>
        </div>
      </header>

      {/* 移动端底部导航 */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/20">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium rounded-2xl transition-all ${
                  isActive ? 'text-accent-blue' : 'text-gray-500'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {children}
      </main>
    </div>
  )
}

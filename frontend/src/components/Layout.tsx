import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getLcuStatus } from '../api'
import {
  Users, UserCheck, Swords, RefreshCw, History, BarChart3, Shield,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '选手管理', icon: Users },
  { to: '/pool', label: '选手池', icon: UserCheck },
  { to: '/match', label: '内战分组', icon: Swords },
  { to: '/sync', label: '战绩同步', icon: RefreshCw },
  { to: '/matches', label: '对局记录', icon: History },
  { to: '/stats', label: '胜率统计', icon: BarChart3 },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { data: lcu } = useQuery({
    queryKey: ['lcu-status'],
    queryFn: getLcuStatus,
    refetchInterval: 30_000,
  })

  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-[#0B1120]/80 backdrop-blur-xl border-b border-[#334155]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-display tracking-wider text-slate-100 leading-none">
                  LOL<span className="text-blue-400">内战</span>
                </h1>
                <p className="text-[10px] text-slate-600 tracking-wider font-medium leading-none mt-0.5">
                  MANAGEMENT
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* LCU Status */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                lcu?.connected
                  ? 'bg-emerald-500/8 text-emerald-500/80 border-emerald-500/15'
                  : 'bg-slate-500/8 text-slate-500 border-slate-500/15'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                lcu?.connected ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
              {lcu?.connected
                ? (lcu.summoner_name ?? '已连接')
                : 'LCU 离线'}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0B1120]/90 backdrop-blur-xl border-t border-[#334155]">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-500/10' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold tracking-wider">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-28 sm:pb-8">
        {children}
      </main>
    </div>
  )
}

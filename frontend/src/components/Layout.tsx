import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getLcuStatus } from '../api'
import {
  Users, UserCheck, Swords, RefreshCw, History, BarChart3, Shield, Menu, X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: lcu } = useQuery({
    queryKey: ['lcu-status'],
    queryFn: getLcuStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-bg-secondary border-r border-border-default fixed h-full z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-text-primary leading-none">
                LOL内战
              </h1>
              <p className="text-[10px] text-text-muted tracking-wider font-medium leading-none mt-0.5">
                MANAGEMENT
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* LCU Status */}
        <div className="px-4 py-4 border-t border-border-default">
          <div
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors w-full ${
              lcu?.connected
                ? 'bg-bg-primary text-text-secondary border-border-default'
                : 'bg-bg-tertiary text-text-muted border-border-default'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              lcu?.connected ? 'bg-text-secondary' : 'bg-text-muted'
            }`} />
            {lcu?.connected
              ? (lcu.summoner_name ?? '已连接')
              : 'LCU 离线'}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border-default">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-text-primary">LOL内战</h1>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-64 bg-bg-secondary border-r border-border-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 flex items-center px-5 border-b border-border-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <h1 className="text-sm font-bold tracking-tight text-text-primary">LOL内战</h1>
                </div>
              </div>
              <nav className="px-3 py-4 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 items-center justify-between px-8 border-b border-border-default bg-bg-primary/80 backdrop-blur-xl sticky top-0 z-30">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {NAV_ITEMS.find(item => item.to === location.pathname)?.label ?? 'LOL内战'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                lcu?.connected
                  ? 'bg-bg-secondary text-text-secondary border-border-default'
                  : 'bg-bg-tertiary text-text-muted border-border-default'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                lcu?.connected ? 'bg-text-secondary' : 'bg-text-muted'
              }`} />
              {lcu?.connected ? (lcu.summoner_name ?? 'LCU 已连接') : 'LCU 离线'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="pt-14 lg:pt-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-xl border-t border-border-default">
        <div className="flex justify-around py-2 pb-safe">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                  isActive ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-bg-tertiary' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold tracking-wider">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}


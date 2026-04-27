import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getSyncStatus, triggerSync, getMatchHistory } from '../api'
import {
  RefreshCw, Download, Bell, CheckCircle2, XCircle, Clock, AlertCircle, Info, Users, BarChart3, Activity,
} from 'lucide-react'

export default function SyncPage() {
  const qc = useQueryClient()
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: 15_000,
  })

  const { data: matchCount } = useQuery({
    queryKey: ['match-count'],
    queryFn: () => getMatchHistory(1),
    staleTime: 30_000,
  })

  const summoners = status?.summoners ?? []
  const synced = summoners.filter((s) => s.total_games_synced > 0)
  const totalGames = matchCount?.total ?? 0

  const handleTrigger = async () => {
    setTriggering(true)
    setTriggerMsg(null)
    try {
      await triggerSync()
      setTriggerMsg('已通知所有 agent 执行同步')
      qc.invalidateQueries({ queryKey: ['sync-status'] })
    } catch (e: any) {
      setTriggerMsg(`触发失败: ${e.message}`)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="page-title">战绩同步</h2>
        <p className="page-subtitle">各选手的对局数据由本地 sync-agent 自动拉取并推送到服务器</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '选手总数', value: summoners.length, icon: Users },
          { label: '已同步', value: synced.length, icon: CheckCircle2 },
          { label: '总场次', value: totalGames, icon: BarChart3 },
          { label: '上次同步', value: (() => {
            const lastSyncTimes = summoners.map(s => s.last_sync).filter(Boolean) as string[]
            const latest = lastSyncTimes.length ? lastSyncTimes.sort().reverse()[0] : null
            return latest ? new Date(latest).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'
          })(), icon: Activity, isTime: true },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="card-hover rounded-xl p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-bg-tertiary flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-text-secondary" />
              </div>
              <div>
                <div className={`stat-value text-text-primary ${s.isTime ? '!text-2xl' : ''}`}>{s.value}</div>
                <div className="stat-label mt-1">{s.label}</div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Usage Info */}
      <div className="card rounded-xl p-5 border-l-4 border-l-accent">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary text-sm mb-2">使用方式</h3>
            <p className="text-xs text-text-secondary mb-3">
              在有 LOL 客户端的电脑上运行 <strong className="text-text-primary">LOL-Sync-Agent.exe</strong>，常驻系统托盘自动检测并拉取战绩。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleTrigger} disabled={triggering} className="btn-primary text-sm rounded-lg">
                {triggering ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    通知中...
                  </>
                ) : (
                  <><Bell className="w-4 h-4" />手动触发同步</>
                )}
              </button>
              {triggerMsg && (
                <span className={`text-xs flex items-center gap-1 ${triggerMsg.includes('失败') ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  {triggerMsg.includes('失败') ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {triggerMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player Grid */}
      <div>
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-text-tertiary" />
          选手同步状态
          <span className="text-xs text-text-muted font-normal ml-1">({synced.length}/{summoners.length} 已同步)</span>
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
          </div>
        ) : summoners.length === 0 ? (
          <div className="card rounded-xl p-10 text-center text-text-muted text-sm">还没有添加选手</div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            {summoners.map((s) => {
              const isDone = s.last_sync_status === 'done'
              const isFailed = s.last_sync_status && s.last_sync_status !== 'done'
              return (
                <motion.div
                  key={s.summoner_id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.3 }}
                  className="card rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isDone ? 'bg-bg-secondary text-text-secondary' :
                    isFailed ? 'bg-bg-tertiary text-text-muted' :
                    'bg-bg-tertiary text-text-muted'
                  }`}>
                    {s.nickname[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{s.nickname}</p>
                    <p className="text-xs text-text-muted truncate font-mono">{s.riot_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold ${s.total_games_synced > 0 ? 'text-text-secondary' : 'text-text-muted'}`}>
                        {s.total_games_synced}场
                      </span>
                      {isDone && <CheckCircle2 className="w-3 h-3 text-text-secondary" />}
                      {isFailed && <XCircle className="w-3 h-3 text-text-muted" />}
                      {!s.last_sync_status && <Clock className="w-3 h-3 text-text-muted" />}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}

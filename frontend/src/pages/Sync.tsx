import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSyncStatus,
  syncMatchHistory,
  refreshLcu,
  getLcuStatus,
  type SyncResult,
} from '../api'

export default function SyncPage() {
  const qc = useQueryClient()
  const { data: lcu, isLoading: lcuLoading } = useQuery({
    queryKey: ['lcu-status'],
    queryFn: getLcuStatus,
    refetchInterval: 30_000,
  })
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    staleTime: 10_000,
  })

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 2)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const refreshMut = useMutation({
    mutationFn: refreshLcu,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lcu-status'] })
    },
  })

  const startSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
      const result = await syncMatchHistory({
        summoner_ids: ids,
        start_date: startDate,
        end_date: endDate,
      })
      setSyncResult(result)
      qc.invalidateQueries({ queryKey: ['sync-status'] })
      qc.invalidateQueries({ queryKey: ['summoner-stats'] })
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSyncing(false)
    }
  }

  const toggleId = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">战绩同步</h2>
        <p className="text-gray-500 mt-1">
          从 Riot API 拉取各选手的历史对战记录，筛选自定义对局(≥6人)
        </p>
      </div>

      {/* LCU 连接状态 */}
      <div className={`glass-card p-5 ${lcu?.connected ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-rose-400'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">
              {lcu?.connected ? 'LCU 已连接' : 'LCU 未连接'}
            </h3>
            {lcu?.connected && (
              <p className="text-sm text-gray-500 mt-0.5">
                当前登录: {lcu.summoner_name}
              </p>
            )}
          </div>
          <button
            className="btn-secondary"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            {refreshMut.isPending ? '检测中...' : '重新检测'}
          </button>
        </div>
        {!lcu?.connected && (
          <p className="mt-3 text-sm text-rose-600">
            请先启动 LOL 国服客户端并登录，然后点击重新检测。本地未登录时无法拉取战绩。
          </p>
        )}
      </div>

      {/* 同步参数 */}
      <div className="glass-card p-5">
        <h3 className="font-bold mb-4">同步参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">开始日期</label>
            <input
              type="date"
              className="input-glass"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">结束日期</label>
            <input
              type="date"
              className="input-glass"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-primary w-full sm:w-auto"
          disabled={!lcu?.connected || syncing}
          onClick={startSync}
        >
          {syncing ? '🔄 同步中...' : '开始同步'}
        </button>
      </div>

      {/* 同步结果 */}
      {syncResult && (
        <div className="glass-card p-5">
          <h3 className="font-bold mb-3">同步结果</h3>
          {syncResult.status === 'done' ? (
            <p className="text-emerald-600 font-medium text-lg">
              本次同步新增 {syncResult.total_games_synced} 场对局
            </p>
          ) : (
            <p className="text-red-500">
              同步失败：{syncResult.error}
            </p>
          )}
        </div>
      )}

      {/* 选手同步状态 */}
      {status && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h3 className="font-bold">选手同步概览</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">选择</th>
                <th className="px-6 py-3">选手</th>
                <th className="px-6 py-3 hidden sm:table-cell">PUUID</th>
                <th className="px-6 py-3">已同步场次</th>
                <th className="px-6 py-3 hidden sm:table-cell">最后同步</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {status.summoners.map((s) => (
                <tr key={s.summoner_id} className="hover:bg-black/[0.02] transition-colors">
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-accent-blue"
                      checked={selectedIds.has(s.summoner_id)}
                      onChange={() => toggleId(s.summoner_id)}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-medium">{s.nickname}</span>
                    <span className="text-gray-400 text-sm ml-2">{s.riot_id}</span>
                  </td>
                  <td className="px-6 py-3 hidden sm:table-cell">
                    <span className="text-xs text-gray-400 font-mono">
                      {s.puuid ? '已解析' : '未解析'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`font-bold ${s.total_games_synced > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {s.total_games_synced}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400 hidden sm:table-cell">
                    {s.last_sync
                      ? new Date(s.last_sync).toLocaleDateString('zh-CN')
                      : '-'}
                  </td>
                </tr>
              ))}
              {status.summoners.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    还没有添加选手
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-gray-400">
            不勾选则同步所有活跃选手；勾选限定范围选手
          </div>
        </div>
      )}
    </div>
  )
}

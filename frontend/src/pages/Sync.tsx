import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSyncStatus, triggerSync } from '../api'

export default function SyncPage() {
  const queryClient = useQueryClient()
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: 15_000,
  })

  const handleTrigger = async () => {
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const res = await triggerSync()
      setTriggerMsg('已通知 agent 执行同步')
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
    } catch (e: any) {
      setTriggerMsg(`触发失败: ${e.message}`)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">战绩同步</h2>
        <p className="text-gray-500 mt-1">
          各选手的对局数据由本地运行的 sync-agent 自动拉取并推送到服务器
        </p>
      </div>

      {/* 使用说明 + 手动触发 */}
      <div className="glass-card p-5 border-l-4 border-l-blue-400">
        <h3 className="font-bold mb-2">使用方式</h3>
        <p className="text-sm text-gray-600 mb-3">
          在有 LOL 客户端的电脑上运行 <strong>LOL-Sync-Agent.exe</strong>，它会常驻系统托盘，自动检测本地 League
          Client 并定期拉取战绩推送到此服务器。
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-4 space-y-1">
          <p><span className="text-gray-400">1.</span> 打开托盘右键菜单 → 设置服务器地址 → 填入本服务器地址</p>
          <p><span className="text-gray-400">2.</span> 托盘菜单可配置同步间隔（默认 10 分钟自动同步一次）</p>
          <p><span className="text-gray-400">3.</span> 下次登录 LOL 后 agent 会自动检测并开始同步</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {triggering ? '通知中...' : '手动触发同步'}
          </button>
          {triggerMsg && (
            <span className={`text-sm ${triggerMsg.includes('失败') ? 'text-red-500' : 'text-emerald-600'}`}>
              {triggerMsg}
            </span>
          )}
        </div>
      </div>

      {/* 选手同步概览 */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="font-bold">选手同步概览</h3>
          {status && (
            <span className="text-xs text-gray-400">
              已同步 {status.summoners.filter((s) => s.total_games_synced > 0).length}/{status.summoners.length} 位选手
            </span>
          )}
        </div>
        {statusLoading ? (
          <div className="p-6 text-center text-gray-400">加载中...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">选手</th>
                <th className="px-6 py-3 hidden sm:table-cell">Riot ID</th>
                <th className="px-6 py-3">已同步场次</th>
                <th className="px-6 py-3 hidden sm:table-cell">最后同步</th>
                <th className="px-6 py-3 hidden sm:table-cell">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {status?.summoners.map((s) => (
                <tr key={s.summoner_id} className="hover:bg-black/[0.02] transition-colors">
                  <td className="px-6 py-3">
                    <span className="font-medium">{s.nickname}</span>
                  </td>
                  <td className="px-6 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-500 font-mono">{s.riot_id}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`font-bold ${s.total_games_synced > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {s.total_games_synced}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400 hidden sm:table-cell">
                    {s.last_sync
                      ? new Date(s.last_sync).toLocaleString('zh-CN')
                      : '-'}
                  </td>
                  <td className="px-6 py-3 hidden sm:table-cell">
                    {s.last_sync_status === 'done' ? (
                      <span className="text-emerald-600 text-sm">正常</span>
                    ) : s.last_sync_status ? (
                      <span className="text-red-500 text-sm">失败</span>
                    ) : (
                      <span className="text-gray-400 text-sm">未同步</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!status || status.summoners.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    还没有添加选手
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

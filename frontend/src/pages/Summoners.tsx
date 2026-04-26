import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSummoners,
  createSummoner,
  updateSummoner,
  deleteSummoner,
  getLcuStatus,
  type SummonerOut,
} from '../api'

export default function SummonersPage() {
  const qc = useQueryClient()
  const { data: summoners, isLoading } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const { data: lcu } = useQuery({ queryKey: ['lcu-status'], queryFn: getLcuStatus })

  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [riotId, setRiotId] = useState('')
  const [nickname, setNickname] = useState('')
  const [errMsg, setErrMsg] = useState('')

  const createMut = useMutation({
    mutationFn: () => createSummoner(riotId.trim(), nickname.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summoners'] })
      setShowAdd(false)
      setRiotId('')
      setNickname('')
      setErrMsg('')
    },
    onError: (e: Error) => setErrMsg(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: deleteSummoner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summoners'] }),
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      updateSummoner(id, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summoners'] }),
  })

  const editMut = useMutation({
    mutationFn: ({ id, nick }: { id: number; nick: string }) =>
      updateSummoner(id, { nickname: nick }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summoners'] })
      setEditId(null)
    },
  })

  if (isLoading) {
    return <div className="text-center text-gray-400 py-20">加载中...</div>
  }

  const active = summoners?.filter((s) => s.is_active) ?? []
  const inactive = summoners?.filter((s) => !s.is_active) ?? []

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">选手管理</h2>
          <p className="text-gray-500 mt-1">
            添加固定玩家，同步后 {lcu?.connected ? '可以' : '需连接LCU才能'}自动解析 PUUID
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          + 添加选手
        </button>
      </div>

      {/* 添加弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md animate-in">
            <h3 className="text-lg font-bold mb-4">添加选手</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">召唤师 ID</label>
                <input
                  className="input-glass"
                  placeholder="如: 被绑的提莫#56022"
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">昵称</label>
                <input
                  className="input-glass"
                  placeholder="如: 周某人"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()}
                />
              </div>
            </div>
            {errMsg && (
              <p className="mt-2 text-sm text-red-500">{errMsg}</p>
            )}
            {!lcu?.connected && (
              <p className="mt-2 text-xs text-amber-600">
                LCU 未连接，将跳过 PUUID 自动解析（之后可在战绩同步页面重新连接）
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button className="btn-secondary" onClick={() => { setShowAdd(false); setErrMsg('') }}>
                取消
              </button>
              <button
                className="btn-primary"
                disabled={!riotId.trim() || !nickname.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 活跃选手表格 */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="font-bold">
            选手池 ({active.length}人)
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">召唤师</th>
              <th className="px-6 py-3">昵称</th>
              <th className="px-6 py-3 hidden sm:table-cell">PUUID</th>
              <th className="px-6 py-3 hidden sm:table-cell">添加时间</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {active.map((s) => (
              <SummonerRow
                key={s.id}
                s={s}
                editing={editId === s.id}
                onEdit={(nick) => editMut.mutate({ id: s.id, nick })}
                onStartEdit={() => setEditId(s.id)}
                onToggle={() => toggleActiveMut.mutate({ id: s.id, active: !s.is_active })}
                onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }}
              />
            ))}
            {active.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  还没有添加选手，点击右上角开始添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 不活跃选手 */}
      {inactive.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h3 className="font-bold text-gray-500">已移出选手池 ({inactive.length}人)</h3>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-black/5">
              {inactive.map((s) => (
                <SummonerRow
                  key={s.id}
                  s={s}
                  editing={editId === s.id}
                  onEdit={(nick) => editMut.mutate({ id: s.id, nick })}
                  onStartEdit={() => setEditId(s.id)}
                  onToggle={() => toggleActiveMut.mutate({ id: s.id, active: !s.is_active })}
                  onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummonerRow({
  s,
  editing,
  onEdit,
  onStartEdit,
  onToggle,
  onDelete,
}: {
  s: SummonerOut
  editing: boolean
  onEdit: (nick: string) => void
  onStartEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [nickVal, setNickVal] = useState(s.nickname)

  return (
    <tr className="hover:bg-black/[0.02] transition-colors">
      <td className="px-6 py-3.5">
        <span className="font-medium">{s.game_name}#{s.tag_line}</span>
      </td>
      <td className="px-6 py-3.5">
        {editing ? (
          <input
            className="input-glass !py-1.5 !px-2.5 text-sm"
            value={nickVal}
            onChange={(e) => setNickVal(e.target.value)}
            onBlur={() => onEdit(nickVal)}
            onKeyDown={(e) => e.key === 'Enter' && onEdit(nickVal)}
            autoFocus
          />
        ) : (
          <span
            className="font-medium cursor-pointer hover:text-accent-blue transition-colors"
            onClick={onStartEdit}
          >
            {s.nickname}
          </span>
        )}
      </td>
      <td className="px-6 py-3.5 hidden sm:table-cell">
        <span className="text-xs text-gray-400 font-mono">
          {s.puuid ? s.puuid.slice(0, 12) + '...' : '未解析'}
        </span>
      </td>
      <td className="px-6 py-3.5 text-sm text-gray-400 hidden sm:table-cell">
        {new Date(s.created_at).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-6 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={onToggle}>
            {s.is_active ? '移出池' : '加入池'}
          </button>
          <button className="btn-danger !px-3 !py-1.5 text-xs" onClick={onDelete}>
            删除
          </button>
        </div>
      </td>
    </tr>
  )
}

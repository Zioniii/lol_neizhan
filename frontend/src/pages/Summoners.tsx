import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  listSummoners, createSummoner, updateSummoner, deleteSummoner, getLcuStatus,
  type SummonerOut,
} from '../api'
import {
  Plus, UserPlus, UserMinus, Trash2, Pencil, X, AlertTriangle, Search, LayoutGrid, List, CheckCircle, XCircle, Users, Shield,
} from 'lucide-react'

const AVATAR_COLORS = [
  'bg-neutral-800', 'bg-neutral-700', 'bg-stone-800',
  'bg-gray-800', 'bg-slate-800', 'bg-zinc-800',
]

export default function SummonersPage() {
  const qc = useQueryClient()
  const { data: summoners, isLoading } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const { data: lcu } = useQuery({ queryKey: ['lcu-status'], queryFn: getLcuStatus })

  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [riotId, setRiotId] = useState('')
  const [nickname, setNickname] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const createMut = useMutation({
    mutationFn: () => createSummoner(riotId.trim(), nickname.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['summoners'] }); setShowAdd(false); setRiotId(''); setNickname(''); setErrMsg('') },
    onError: (e: Error) => setErrMsg(e.message),
  })
  const deleteMut = useMutation({ mutationFn: deleteSummoner, onSuccess: () => qc.invalidateQueries({ queryKey: ['summoners'] }) })
  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateSummoner(id, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summoners'] }),
  })
  const editMut = useMutation({
    mutationFn: ({ id, nick }: { id: number; nick: string }) => updateSummoner(id, { nickname: nick }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['summoners'] }); setEditId(null) },
  })

  const getColor = (name: string) => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]

  if (isLoading) return <LoadingSkeleton />

  const active = summoners?.filter((s) => s.is_active) ?? []
  const inactive = summoners?.filter((s) => !s.is_active) ?? []
  const filtered = active.filter((s) =>
    !search || s.nickname.toLowerCase().includes(search.toLowerCase()) ||
    s.game_name.toLowerCase().includes(search.toLowerCase())
  )

  const stats = [
    { label: '选手池', value: active.length, icon: Users },
    { label: '已解析', value: active.filter(s => s.puuid).length, icon: CheckCircle },
    { label: '待解析', value: active.filter(s => !s.puuid).length, icon: XCircle },
    { label: '已移出', value: inactive.length, icon: Shield },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="page-title">选手管理</h2>
          <p className="page-subtitle">
            {lcu?.connected ? 'LCU 已连接，可自动解析 PUUID' : 'LCU 未连接，添加选手将跳过 PUUID 解析'}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />添加选手
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s, i) => {
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
                <div className="stat-value text-text-primary">{s.value}</div>
                <div className="stat-label mt-1">{s.label}</div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="input pl-10"
            placeholder="搜索选手..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center border border-border-default rounded-lg overflow-hidden">
          <button
            className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filtered.map((s) => (
            <motion.div
              key={s.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.3 }}
            >
              <SummonerCard
                s={s}
                color={getColor(s.nickname)}
                onToggle={() => toggleActiveMut.mutate({ id: s.id, active: false })}
                onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }}
              />
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full card rounded-xl p-10 text-center text-text-muted">
              {search ? '没有匹配的选手' : '还没有添加选手'}
            </div>
          )}
        </motion.div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>选手</th>
                <th>昵称</th>
                <th className="hidden sm:table-cell">PUUID</th>
                <th className="hidden md:table-cell">添加时间</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-text-muted py-12">
                    {search ? '没有匹配的选手' : '还没有添加选手'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                <SummonerCard
                  s={s}
                  color={getColor(s.nickname)}
                  onToggle={() => toggleActiveMut.mutate({ id: s.id, active: true })}
                  onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }}
                />
              </motion.div>
            ))}
          </motion.div>
        </details>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAdd(false); setErrMsg('') }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-bg-primary border border-border-default rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h3 className="text-lg font-semibold text-text-primary">添加选手</h3>
              <button className="btn-ghost !p-1" onClick={() => { setShowAdd(false); setErrMsg('') }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pb-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">游戏 ID</label>
                <input
                  className="input"
                  placeholder="游戏名#标签 (如: 被绑的提莫#56022)"
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">显示昵称</label>
                <input
                  className="input"
                  placeholder="如: 周某人"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()}
                />
              </div>
              {errMsg && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-bg-tertiary border border-border-default text-text-secondary">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errMsg}
                </div>
              )}
              {!lcu?.connected && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-bg-tertiary border border-border-default text-text-secondary">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  LCU 未连接，将跳过 PUUID 自动解析
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
              <button className="btn-secondary" onClick={() => { setShowAdd(false); setErrMsg('') }}>取消</button>
              <button
                className="btn-primary"
                disabled={!riotId.trim() || !nickname.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? '添加中...' : '确认添加'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function SummonerCard({ s, color, onToggle, onDelete }: {
  s: SummonerOut; color: string; onToggle: () => void; onDelete: () => void
}) {
  return (
    <div className="card-hover rounded-xl p-5 text-center group relative">
      <div className={`w-16 h-16 mx-auto ${color} rounded-xl flex items-center justify-center text-white text-2xl font-bold transition-transform group-hover:scale-105`}>
        {s.nickname[0]}
      </div>
      <p className="mt-4 font-semibold text-text-primary truncate">{s.nickname}</p>
      <p className="text-sm text-text-tertiary truncate mt-1 font-mono">{s.game_name}#{s.tag_line}</p>
      <div className="mt-4 flex items-center justify-center">
        {s.puuid ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary bg-bg-secondary border border-border-default">
            <CheckCircle className="w-3.5 h-3.5" />已解析
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-default">
            <XCircle className="w-3.5 h-3.5" />未解析
          </span>
        )}
      </div>
      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors"
          onClick={onToggle}
          title="移出池"
        >
          <UserMinus className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors"
          onClick={onDelete}
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function SummonerRow({ s, editing, onEdit, onStartEdit, onToggle, onDelete }: {
  s: SummonerOut; editing: boolean; onEdit: (nick: string) => void; onStartEdit: () => void;
  onToggle: () => void; onDelete: () => void
}) {
  const [nickVal, setNickVal] = useState(s.nickname)
  return (
    <tr>
      <td>
        <span className="font-semibold text-text-primary">
          {s.game_name}<span className="text-text-tertiary">#{s.tag_line}</span>
        </span>
      </td>
      <td>
        {editing ? (
          <input
            className="input !py-1.5 !px-2.5 text-sm"
            value={nickVal}
            onChange={(e) => setNickVal(e.target.value)}
            onBlur={() => onEdit(nickVal)}
            onKeyDown={(e) => e.key === 'Enter' && onEdit(nickVal)}
            autoFocus
          />
        ) : (
          <button className="font-semibold text-text-primary hover:text-text-secondary transition-colors" onClick={onStartEdit}>
            {s.nickname} <Pencil className="w-3 h-3 text-text-muted inline" />
          </button>
        )}
      </td>
      <td className="hidden sm:table-cell">
        <span className="text-sm text-text-tertiary font-mono">
          {s.puuid ? `${s.puuid.slice(0, 12)}…` : <span className="text-text-muted">未解析</span>}
        </span>
      </td>
      <td className="hidden md:table-cell">
        <span className="text-sm text-text-tertiary">{new Date(s.created_at).toLocaleDateString('zh-CN')}</span>
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={onToggle}>
            {s.is_active ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{s.is_active ? '移出' : '加入'}</span>
          </button>
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs hover:text-text-primary" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-36 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
        <div className="skeleton h-11 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-11 w-60 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-44 rounded-xl" />)}
      </div>
    </div>
  )
}

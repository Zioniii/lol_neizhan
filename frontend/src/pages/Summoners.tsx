import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSummoners, createSummoner, updateSummoner, deleteSummoner, getLcuStatus,
  type SummonerOut,
} from '../api'
import { Plus, UserPlus, UserMinus, Trash2, Pencil, X, AlertTriangle, Search, LayoutGrid, List, CheckCircle, XCircle, Users, Shield } from 'lucide-react'

const AVATAR_COLORS = [
  'from-blue-600 to-blue-900', 'from-indigo-600 to-indigo-900', 'from-cyan-600 to-blue-900',
  'from-sky-600 to-indigo-800', 'from-blue-700 to-indigo-900', 'from-indigo-500 to-blue-800',
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
    { label: '选手池', value: active.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/8' },
    { label: '已解析', value: active.filter(s => s.puuid).length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
    { label: '待解析', value: active.filter(s => !s.puuid).length, icon: XCircle, color: 'text-amber-400', bg: 'bg-amber-500/8' },
    { label: '已移出', value: inactive.length, icon: Shield, color: 'text-slate-400', bg: 'bg-slate-500/8' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-display tracking-wider text-slate-100">选手管理</h2>
          <p className="text-slate-400 mt-1.5">
            {lcu?.connected ? 'LCU 已连接，可自动解析 PUUID' : 'LCU 未连接，添加选手将跳过 PUUID 解析'}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />添加选手
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="card rounded-xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <div className={`stat-value ${s.color}`}>{s.value}</div>
                <div className="stat-label mt-1">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-10" placeholder="搜索选手..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center border border-[#334155] rounded-lg overflow-hidden">
          <button className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setViewMode('grid')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setViewMode('table')}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((s) => (
            <SummonerCard key={s.id} s={s} color={getColor(s.nickname)}
              onToggle={() => toggleActiveMut.mutate({ id: s.id, active: false })}
              onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full card rounded-xl p-10 text-center text-slate-500">{search ? '没有匹配的选手' : '还没有添加选手'}</div>
          )}
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <table className="table-base">
            <thead>
              <tr><th>选手</th><th>昵称</th><th className="hidden sm:table-cell">PUUID</th><th className="hidden md:table-cell">添加时间</th><th className="text-right">操作</th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <SummonerRow key={s.id} s={s} editing={editId === s.id}
                  onEdit={(nick) => editMut.mutate({ id: s.id, nick })}
                  onStartEdit={() => setEditId(s.id)}
                  onToggle={() => toggleActiveMut.mutate({ id: s.id, active: !s.is_active })}
                  onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }} />
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-12">没有匹配的选手</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {inactive.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition-colors py-2 list-none">
            <span className="w-0.5 h-4 rounded bg-slate-600" />已移出选手池 ({inactive.length})
          </summary>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 opacity-50">
            {inactive.map((s) => (
              <SummonerCard key={s.id} s={s} color={getColor(s.nickname)}
                onToggle={() => toggleActiveMut.mutate({ id: s.id, active: true })}
                onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(s.id) }} />
            ))}
          </div>
        </details>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setErrMsg('') }}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h3 className="text-lg font-display tracking-wider text-slate-100">添加选手</h3>
              <button className="btn-ghost !p-1" onClick={() => { setShowAdd(false); setErrMsg('') }}><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pb-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">游戏 ID</label>
                <input className="input" placeholder="游戏名#标签 (如: 被绑的提莫#56022)" value={riotId}
                  onChange={(e) => setRiotId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">显示昵称</label>
                <input className="input" placeholder="如: 周某人" value={nickname}
                  onChange={(e) => setNickname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && riotId && nickname && createMut.mutate()} />
              </div>
              {errMsg && <div className="alert-error"><AlertTriangle className="w-4 h-4 shrink-0" />{errMsg}</div>}
              {!lcu?.connected && <div className="alert-warn"><AlertTriangle className="w-4 h-4 shrink-0" />LCU 未连接，将跳过 PUUID 自动解析</div>}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
              <button className="btn-secondary" onClick={() => { setShowAdd(false); setErrMsg('') }}>取消</button>
              <button className="btn-primary" disabled={!riotId.trim() || !nickname.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}>{createMut.isPending ? '添加中...' : '确认添加'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummonerCard({ s, color, onToggle, onDelete }: { s: SummonerOut; color: string; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="card-hover rounded-xl p-5 text-center group relative">
      <div className={`w-16 h-16 mx-auto bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-transform group-hover:scale-105`}>
        {s.nickname[0]}
      </div>
      <p className="mt-4 font-bold text-slate-100 truncate">{s.nickname}</p>
      <p className="text-sm text-slate-500 truncate mt-1 font-mono">{s.game_name}#{s.tag_line}</p>
      <div className="mt-4 flex items-center justify-center">
        {s.puuid
          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/8 border border-emerald-500/15"><CheckCircle className="w-3.5 h-3.5" />已解析</span>
          : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/8 border border-amber-500/15"><XCircle className="w-3.5 h-3.5" />未解析</span>}
      </div>
      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-2 rounded-lg bg-[#263348] hover:bg-[#2D3A50] text-slate-400 hover:text-slate-200 transition-colors" onClick={onToggle} title="移出池"><UserMinus className="w-4 h-4" /></button>
        <button className="p-2 rounded-lg bg-[#263348] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors" onClick={onDelete} title="删除"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function SummonerRow({ s, editing, onEdit, onStartEdit, onToggle, onDelete }: {
  s: SummonerOut; editing: boolean; onEdit: (nick: string) => void; onStartEdit: () => void; onToggle: () => void; onDelete: () => void
}) {
  const [nickVal, setNickVal] = useState(s.nickname)
  return (
    <tr className="hover:bg-white/[0.015] transition-colors">
      <td><span className="font-semibold text-slate-100">{s.game_name}<span className="text-slate-500">#{s.tag_line}</span></span></td>
      <td>{editing ? (
        <input className="input !py-1.5 !px-2.5 text-sm" value={nickVal} onChange={(e) => setNickVal(e.target.value)}
          onBlur={() => onEdit(nickVal)} onKeyDown={(e) => e.key === 'Enter' && onEdit(nickVal)} autoFocus />
      ) : (
        <button className="font-semibold text-slate-100 hover:text-blue-400 transition-colors" onClick={onStartEdit}>
          {s.nickname} <Pencil className="w-3 h-3 text-slate-600 inline" />
        </button>
      )}</td>
      <td className="hidden sm:table-cell"><span className="text-sm text-slate-500 font-mono">{s.puuid ? `${s.puuid.slice(0, 12)}…` : <span className="text-amber-500/70">未解析</span>}</span></td>
      <td className="hidden md:table-cell"><span className="text-sm text-slate-500">{new Date(s.created_at).toLocaleDateString('zh-CN')}</span></td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={onToggle}>
            {s.is_active ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{s.is_active ? '移出' : '加入'}</span>
          </button>
          <button className="btn-danger !px-2.5 !py-1.5 text-xs" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between"><div className="skeleton h-8 w-36 rounded-lg" /><div className="skeleton h-11 w-28 rounded-lg" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      <div className="skeleton h-11 w-60 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-44 rounded-xl" />)}</div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSummoners,
  listMatches,
  createMatch,
  deleteMatch,
  type MatchOut,
  type SummonerOut,
} from '../api'
import {
  Swords, Users, UserPlus, Shuffle, Trash2, ChevronDown, X, AlertCircle, Trophy, History, RefreshCw,
} from 'lucide-react'

export default function MatchPage() {
  const qc = useQueryClient()
  const { data: summoners } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: listMatches })
  const active = summoners?.filter((s) => s.is_active) ?? []

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [tempNames, setTempNames] = useState<string[]>([])
  const [tempInput, setTempInput] = useState('')
  const [result, setResult] = useState<MatchOut | null>(null)
  const [spinning, setSpinning] = useState(false)

  const totalCount = selected.size + tempNames.length

  const createMut = useMutation({
    mutationFn: ({ ids, temps }: { ids: number[]; temps: string[] }) => createMatch(ids, temps),
    onSuccess: (data) => {
      setResult(data)
      setSpinning(false)
      qc.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  const addTemp = () => {
    const name = tempInput.trim()
    if (!name || tempNames.includes(name)) return
    setTempNames([...tempNames, name])
    setTempInput('')
  }
  const removeTemp = (name: string) => setTempNames(tempNames.filter((n) => n !== name))

  const roll = () => {
    if (totalCount < 2) return
    setSpinning(true)
    setResult(null)
    setTimeout(() => createMut.mutate({ ids: Array.from(selected), temps: tempNames }), 600)
  }

  const blue = result?.participants.filter((p) => p.team === 0) ?? []
  const red = result?.participants.filter((p) => p.team === 1) ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-display tracking-wider text-slate-100">内战分组</h2>
        <p className="text-slate-400 mt-2">选择选手，随机分边</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Selection Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fixed Players */}
          <div className="card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                固定选手
                <span className="badge">{selected.size}/{active.length}</span>
              </h3>
              <div className="flex gap-1">
                <button className="btn-ghost text-xs" onClick={() => setSelected(new Set(active.map(s => s.id)))}>全选</button>
                <button className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>清空</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto">
              {active.map((s) => {
                const isSel = selected.has(s.id)
                return (
                  <button key={s.id}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all rounded ${isSel
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-surface text-slate-400 border border-[#1E1E28] hover:bg-surface-light hover:text-slate-100'}`}
                    onClick={() => toggle(s.id)}>
                    {s.nickname}
                  </button>
                )
              })}
              {active.length === 0 && <p className="text-slate-600 text-sm py-4">选手池为空</p>}
            </div>
          </div>

          {/* Temp Players */}
          <div className="card rounded-xl p-5">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-slate-500" />
              临时玩家
              {tempNames.length > 0 && <span className="badge">{tempNames.length}人</span>}
            </h3>
            <p className="text-sm text-slate-500 mb-3">不计战绩和胜率</p>
            <div className="flex gap-2 mb-3">
              <input type="text" className="input rounded flex-1" placeholder="输入昵称后回车"
                value={tempInput} onChange={(e) => setTempInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTemp()} />
              <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={addTemp}>添加</button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {tempNames.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3" />{name}
                  <button onClick={() => removeTemp(name)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Roll Button */}
          <button className={`btn-primary w-full text-sm py-3 rounded-lg ${spinning ? 'animate-pulse' : ''}`}
            disabled={totalCount < 2 || createMut.isPending} onClick={roll}>
            {spinning ? <>分边中...</>
              : <><Shuffle className="w-4 h-4" />随机分组 ({totalCount}人)</>}
          </button>
          {totalCount < 2 && <p className="text-xs text-slate-600 text-center">至少选择 2 名选手</p>}
        </div>

        {/* Right: Result Panel */}
        <div className="lg:col-span-3">
          {result ? (
            <div className="space-y-4 animate-slide-up">
              {/* VS Banner */}
              <div className="card rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold text-lg">蓝</span>
                    <span className="text-blue-400 font-bold">{blue.length}人</span>
                  </div>
                  <span className="text-slate-600 text-xs font-bold tracking-[0.2em]">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-bold">{red.length}人</span>
                    <span className="text-red-400 font-bold text-lg">红</span>
                  </div>
                </div>
              </div>

              {/* Teams */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="team-blue rounded-lg p-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-bold mb-3 team-blue-header">
                    <Trophy className="w-3.5 h-3.5" />蓝方
                  </div>
                  <div className="space-y-1.5">
                    {blue.map((p) => (
                      <div key={p.id}
                        className={`py-2 px-3 rounded text-sm font-bold ${p.is_temporary ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-300'}`}>
                        {p.summoner_nickname}
                        {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="team-red rounded-lg p-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-bold mb-3 team-red-header">
                    <Trophy className="w-3.5 h-3.5" />红方
                  </div>
                  <div className="space-y-1.5">
                    {red.map((p) => (
                      <div key={p.id}
                        className={`py-2 px-3 rounded text-sm font-bold ${p.is_temporary ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-300'}`}>
                        {p.summoner_nickname}
                        {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="btn-secondary w-full text-sm" onClick={() => setResult(null)}>
                <RefreshCw className="w-4 h-4" />重新分组
              </button>
            </div>
          ) : (
            <div className="card rounded-lg h-full flex items-center justify-center p-8 min-h-[300px]">
              <div className="text-center">
                <Swords className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">选择选手后点击分组，结果将显示在这里</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {matches && matches.length > 0 && (
        <div className="card rounded-lg overflow-hidden">
          <div className="card-header">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4" />
              历史内战
              <span className="badge text-[10px]">{matches.length}场</span>
            </h3>
          </div>
          <div className="divide-y divide-[#1E1E28]">
            {matches.map((m) => (
              <MatchItem key={m.id} m={m} onDelete={() => {
                deleteMatch(m.id).then(() => qc.invalidateQueries({ queryKey: ['matches'] }))
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MatchItem({ m, onDelete }: { m: MatchOut; onDelete: () => void }) {
  const blue = m.participants.filter((p) => p.team === 0)
  const red = m.participants.filter((p) => p.team === 1)

  return (
    <details className="group">
      <summary className="px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] list-none flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className="w-4 h-4 text-slate-600 shrink-0 transition-transform group-open:rotate-0 -rotate-90" />
          <div className="min-w-0">
            <span className="font-semibold text-slate-100 text-sm">{m.name || `内战 #${m.id}`}</span>
            <span className="text-slate-600 text-xs ml-2">{new Date(m.created_at).toLocaleDateString('zh-CN')}</span>
            <span className="text-slate-600 text-xs ml-1">· {m.participants.length}人</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-blue-400 font-semibold">{blue.length}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-red-400 font-semibold">{red.length}</span>
          </div>
          <button className="btn-ghost !p-1.5" onClick={(e) => { e.preventDefault(); if (confirm('确定删除？')) onDelete() }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </summary>
      <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1"><span className="w-1 h-3 rounded bg-blue-500" />蓝方</p>
          {blue.map((p) => <p key={p.id} className="text-sm text-slate-400 pl-3">{p.summoner_nickname} <span className="text-slate-600 text-xs">({p.summoner_name})</span></p>)}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1"><span className="w-1 h-3 rounded bg-red-500" />红方</p>
          {red.map((p) => <p key={p.id} className="text-sm text-slate-400 pl-3">{p.summoner_nickname} <span className="text-slate-600 text-xs">({p.summoner_name})</span></p>)}
        </div>
      </div>
    </details>
  )
}

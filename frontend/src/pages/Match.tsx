import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  listSummoners,
  listMatches,
  createMatch,
  deleteMatch,
  getSummonerStats,
  sendPendingChat,
  type MatchOut,
  type SummonerOut,
} from '../api'
import {
  Swords, Users, UserPlus, Shuffle, Trash2, ChevronDown, X, AlertCircle, Trophy, History, RefreshCw, Settings, Send,
} from 'lucide-react'

export default function MatchPage() {
  const qc = useQueryClient()
  const { data: summoners } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: listMatches })
  const { data: statsData } = useQuery({ queryKey: ['summoner-stats'], queryFn: getSummonerStats, staleTime: 30_000 })
  const active = summoners?.filter((s) => s.is_active) ?? []

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [tempNames, setTempNames] = useState<string[]>([])
  const [tempInput, setTempInput] = useState('')
  const [result, setResult] = useState<MatchOut | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [sideLimit, setSideLimit] = useState(2)
  const [winRateBalance, setWinRateBalance] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const totalCount = selected.size + tempNames.length

  const createMut = useMutation({
    mutationFn: ({ ids, temps }: { ids: number[]; temps: string[] }) => createMatch(ids, temps, undefined, sideLimit, winRateBalance),
    onSuccess: (data) => {
      setResult(data)
      setSpinning(false)
      qc.invalidateQueries({ queryKey: ['matches'] })
    },
    onSettled: () => setSpinning(false),
  })

  const sendChatMut = useMutation({
    mutationFn: (matchId: number) => sendPendingChat(matchId),
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
  const blueAvgWr = winRateBalance && statsData && blue.length > 0
    ? (blue.reduce((sum, p) => {
        const stat = statsData.find(s => s.summoner_id === p.summoner_id)
        return sum + (stat?.win_rate ?? 50)
      }, 0) / blue.length).toFixed(1)
    : null
  const redAvgWr = winRateBalance && statsData && red.length > 0
    ? (red.reduce((sum, p) => {
        const stat = statsData.find(s => s.summoner_id === p.summoner_id)
        return sum + (stat?.win_rate ?? 50)
      }, 0) / red.length).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="page-title">内战分组</h2>
        <p className="page-subtitle">选择选手，随机分边</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Selection Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fixed Players */}
          <div className="card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-text-tertiary" />
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
                    className={`px-3 py-1.5 text-xs font-semibold transition-all rounded-lg ${isSel
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-bg-secondary text-text-tertiary border border-border-default hover:bg-bg-tertiary hover:text-text-primary'}`}
                    onClick={() => toggle(s.id)}>
                    {s.nickname}
                  </button>
                )
              })}
              {active.length === 0 && <p className="text-text-muted text-sm py-4">选手池为空</p>}
            </div>
          </div>

          {/* Temp Players */}
          <div className="card rounded-xl p-5">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3 text-sm">
              <UserPlus className="w-4 h-4 text-text-tertiary" />
              临时玩家
              {tempNames.length > 0 && <span className="badge">{tempNames.length}人</span>}
            </h3>
            <p className="text-sm text-text-muted mb-3">不计战绩和胜率</p>
            <div className="flex gap-2 mb-3">
              <input type="text" className="input rounded-lg flex-1" placeholder="输入昵称后回车"
                value={tempInput} onChange={(e) => setTempInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTemp()} />
              <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={addTemp}>添加</button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {tempNames.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-bg-tertiary text-text-secondary border border-border-default">
                  <AlertCircle className="w-3 h-3" />{name}
                  <button onClick={() => removeTemp(name)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="card rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-tertiary" />
                分组设置
              </span>
              <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${settingsOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {settingsOpen && (
              <div className="px-5 pb-4 space-y-4 border-t border-border-default pt-3">
                {/* Side Limit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-text-primary">连续同边限制</span>
                    <div className="flex items-center gap-3">
                      <button className="btn-secondary !w-7 !h-7 !p-0 rounded-lg text-sm" onClick={() => setSideLimit(Math.max(0, sideLimit - 1))}>−</button>
                      <span className="w-6 text-center font-bold text-sm text-text-primary font-mono">{sideLimit}</span>
                      <button className="btn-secondary !w-7 !h-7 !p-0 rounded-lg text-sm" onClick={() => setSideLimit(sideLimit + 1)}>+</button>
                    </div>
                  </div>
                  <p className="text-[11px] text-text-muted">每人连续在同一队超过{sideLimit}次则强制换边（0=不限制）</p>
                </div>
                {/* Win Rate Balance */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-text-primary">胜率平衡</span>
                    <button
                      className={`w-10 h-6 rounded-full transition-colors relative ${winRateBalance ? 'bg-accent' : 'bg-bg-tertiary'}`}
                      onClick={() => setWinRateBalance(!winRateBalance)}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${winRateBalance ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">尽量让两队总胜率相近（基于历史战绩）</p>
                </div>
              </div>
            )}
          </div>

          {/* Roll Button */}
          <button className={`btn-primary w-full text-sm py-3 rounded-lg ${spinning ? 'animate-pulse' : ''}`}
            disabled={totalCount < 2 || createMut.isPending} onClick={roll}>
            {spinning ? <>分边中...</>
              : <><Shuffle className="w-4 h-4" />随机分组 ({totalCount}人)</>}
          </button>
          {totalCount < 2 && <p className="text-xs text-text-muted text-center">至少选择 2 名选手</p>}
        </div>

        {/* Right: Result Panel */}
        <div className="lg:col-span-3">
          {result ? (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
            >
              {/* VS Banner */}
              <div className="card rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-bold text-lg">蓝</span>
                    <span className="text-text-secondary font-bold font-mono">{blue.length}人</span>
                  </div>
                  <span className="text-text-muted text-xs font-bold tracking-[0.2em]">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary font-bold font-mono">{red.length}人</span>
                    <span className="text-text-primary font-bold text-lg">红</span>
                  </div>
                </div>
                {blueAvgWr && redAvgWr && (
                  <div className="flex items-center justify-center gap-8 mt-2 text-[11px] font-semibold">
                    <span className={Number(blueAvgWr) >= Number(redAvgWr) ? 'text-text-primary' : 'text-text-muted'}>
                      avg {blueAvgWr}%
                    </span>
                    <span className="text-text-muted text-[10px]">胜率</span>
                    <span className={Number(redAvgWr) >= Number(blueAvgWr) ? 'text-text-primary' : 'text-text-muted'}>
                      avg {redAvgWr}%
                    </span>
                  </div>
                )}
              </div>

              {/* Teams */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card rounded-xl p-4 border-l-4 border-l-text-primary">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold mb-3 bg-bg-secondary">
                    <Trophy className="w-3.5 h-3.5" />蓝方
                  </div>
                  <div className="space-y-1.5">
                    {blue.map((p) => (
                      <div key={p.id}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold ${p.is_temporary ? 'bg-bg-tertiary text-text-muted' : 'bg-bg-secondary text-text-primary'}`}>
                        {p.summoner_nickname}
                        {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card rounded-xl p-4 border-l-4 border-l-text-tertiary">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold mb-3 bg-bg-secondary">
                    <Trophy className="w-3.5 h-3.5" />红方
                  </div>
                  <div className="space-y-1.5">
                    {red.map((p) => (
                      <div key={p.id}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold ${p.is_temporary ? 'bg-bg-tertiary text-text-muted' : 'bg-bg-secondary text-text-primary'}`}>
                        {p.summoner_nickname}
                        {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="btn-secondary flex-1 text-sm" onClick={() => setResult(null)}>
                  <RefreshCw className="w-4 h-4" />重新分组
                </button>
                <button className="btn-primary flex-1 text-sm" disabled={sendChatMut.isPending}
                  onClick={() => result && sendChatMut.mutate(result.id)}>
                  <Send className="w-4 h-4" />发送到房间
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="card rounded-xl h-full flex items-center justify-center p-8 min-h-[300px]">
              <div className="text-center">
                <Swords className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-muted text-sm">选择选手后点击分组，结果将显示在这里</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {matches && matches.length > 0 && (
        <div className="card rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border-default flex items-center justify-between">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 text-sm">
              <History className="w-4 h-4" />
              历史内战
              <span className="badge">{matches.length}场</span>
            </h3>
          </div>
          <div className="divide-y divide-border-default">
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
      <summary className="px-5 py-3.5 cursor-pointer hover:bg-bg-secondary list-none flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0 transition-transform group-open:rotate-0 -rotate-90" />
          <div className="min-w-0">
            <span className="font-semibold text-text-primary text-sm">{m.name || `内战 #${m.id}`}</span>
            <span className="text-text-muted text-xs ml-2">{new Date(m.created_at).toLocaleDateString('zh-CN')}</span>
            <span className="text-text-muted text-xs ml-1">· {m.participants.length}人</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-text-secondary font-semibold">{blue.length}</span>
            <span className="text-text-muted">vs</span>
            <span className="text-text-secondary font-semibold">{red.length}</span>
          </div>
          <button className="btn-ghost !p-1.5" onClick={(e) => { e.preventDefault(); if (confirm('确定删除？')) onDelete() }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </summary>
      <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-text-primary mb-1 flex items-center gap-1"><span className="w-1 h-3 rounded bg-text-primary" />蓝方</p>
          {blue.map((p) => <p key={p.id} className="text-sm text-text-secondary pl-3">{p.summoner_nickname} <span className="text-text-muted text-xs">({p.summoner_name})</span></p>)}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-text-primary mb-1 flex items-center gap-1"><span className="w-1 h-3 rounded bg-text-tertiary" />红方</p>
          {red.map((p) => <p key={p.id} className="text-sm text-text-secondary pl-3">{p.summoner_nickname} <span className="text-text-muted text-xs">({p.summoner_name})</span></p>)}
        </div>
      </div>
    </details>
  )
}

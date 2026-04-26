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

export default function MatchPage() {
  const qc = useQueryClient()
  const { data: summoners } = useQuery({ queryKey: ['summoners'], queryFn: listSummoners })
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: listMatches })

  const active = summoners?.filter((s) => s.is_active) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">内战分组</h2>
        <p className="text-gray-500 mt-1">从选手池中勾选参战选手，随机分边</p>
      </div>

      <GroupingPanel summoners={active} />

      {matches && matches.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h3 className="font-bold">历史内战 ({matches.length}场)</h3>
          </div>
          <div className="divide-y divide-black/5">
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

function GroupingPanel({ summoners }: { summoners: SummonerOut[] }) {
  const qc = useQueryClient()
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
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const addTemp = () => {
    const name = tempInput.trim()
    if (!name || tempNames.includes(name)) return
    setTempNames([...tempNames, name])
    setTempInput('')
  }

  const removeTemp = (name: string) => {
    setTempNames(tempNames.filter((n) => n !== name))
  }

  const roll = () => {
    if (totalCount < 2) return
    setSpinning(true)
    setResult(null)
    setTimeout(() => {
      createMut.mutate({ ids: Array.from(selected), temps: tempNames })
    }, 600)
  }

  const blue = result?.participants.filter((p) => p.team === 0) ?? []
  const red = result?.participants.filter((p) => p.team === 1) ?? []

  return (
    <div className="space-y-4">
      {/* 固定选手选择 */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">
            固定选手 ({selected.size}人)
          </h3>
          <div className="flex gap-2">
            <button
              className="btn-secondary !px-3 !py-1.5 text-xs"
              onClick={() => setSelected(new Set(summoners.map((s) => s.id)))}
            >
              全选
            </button>
            <button
              className="btn-secondary !px-3 !py-1.5 text-xs"
              onClick={() => setSelected(new Set())}
            >
              清空
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {summoners.map((s) => {
            const isSel = selected.has(s.id)
            return (
              <button
                key={s.id}
                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  isSel
                    ? 'bg-gradient-blue text-white shadow-soft scale-105'
                    : 'glass text-gray-600 hover:bg-white/70'
                }`}
                onClick={() => toggle(s.id)}
              >
                {s.nickname}
              </button>
            )
          })}
          {summoners.length === 0 && (
            <p className="text-gray-400 text-sm py-4">选手池为空，请先添加选手</p>
          )}
        </div>
      </div>

      {/* 临时玩家 */}
      <div className="glass-card p-5">
        <h3 className="font-bold mb-3">
          临时玩家 ({tempNames.length}人)
        </h3>
        <p className="text-xs text-gray-400 mb-3">临时玩家只参与分组，不计战绩和胜率</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            className="input-glass flex-1"
            placeholder="输入玩家昵称，按回车添加"
            value={tempInput}
            onChange={(e) => setTempInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTemp()}
          />
          <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={addTemp}>
            添加
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tempNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-800 text-sm font-medium"
            >
              临时·{name}
              <button className="text-amber-400 hover:text-amber-600 ml-1" onClick={() => removeTemp(name)}>×</button>
            </span>
          ))}
        </div>
      </div>

      {/* 开始分组按钮 */}
      <div className="text-center">
        <button
          className={`btn-primary text-lg px-10 py-3 ${
            spinning ? 'animate-pulse' : ''
          }`}
          disabled={totalCount < 2 || createMut.isPending}
          onClick={roll}
        >
          {spinning ? '🎲 分边中...' : '🎲 开始随机分组'}
        </button>
        {totalCount < 2 && (
          <p className="text-xs text-gray-400 mt-2">至少选择 2 名选手</p>
        )}
        {totalCount >= 2 && (
          <p className="text-xs text-gray-400 mt-2">
            共 {totalCount} 人参战
          </p>
        )}
      </div>

      {/* 分组结果 */}
      {result && (
        <div className="grid grid-cols-2 gap-4 animate-in">
          {/* 蓝方 */}
          <div className="glass-card p-5 text-center border-t-4 border-t-blue-500">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-bold mb-4">
              蓝方 ({blue.length}人)
            </div>
            <div className="space-y-2">
              {blue.map((p) => (
                <div
                  key={p.id}
                  className={`py-2 px-4 rounded-2xl font-bold ${
                    p.is_temporary
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-blue-50 text-blue-900'
                  }`}
                >
                  {p.summoner_nickname}
                  {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                </div>
              ))}
            </div>
          </div>
          {/* 红方 */}
          <div className="glass-card p-5 text-center border-t-4 border-t-red-500">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-bold mb-4">
              红方 ({red.length}人)
            </div>
            <div className="space-y-2">
              {red.map((p) => (
                <div
                  key={p.id}
                  className={`py-2 px-4 rounded-2xl font-bold ${
                    p.is_temporary
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-900'
                  }`}
                >
                  {p.summoner_nickname}
                  {p.is_temporary && <span className="text-xs font-normal ml-1 opacity-60">(临时)</span>}
                </div>
              ))}
            </div>
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
      <summary className="px-6 py-4 cursor-pointer hover:bg-black/[0.02] transition-colors list-none flex items-center justify-between">
        <div>
          <span className="font-medium">
            {m.name || `内战 #${m.id}`}
          </span>
          <span className="text-gray-400 text-sm ml-3">
            {new Date(m.created_at).toLocaleDateString('zh-CN')}{' '}
            {new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-gray-400 text-sm ml-2">
            ({m.participants.length}人参战)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-blue-600 font-medium">
              {blue.map((p) => p.summoner_nickname + (p.is_temporary ? '(临时)' : '')).join(', ')}
            </span>
            <span className="mx-2 text-gray-300">vs</span>
            <span className="text-red-600 font-medium">
              {red.map((p) => p.summoner_nickname + (p.is_temporary ? '(临时)' : '')).join(', ')}
            </span>
          </div>
          <button
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            onClick={(e) => { e.preventDefault(); if (confirm('确定删除？')) onDelete() }}
          >
            删除
          </button>
        </div>
      </summary>
      <div className="px-6 pb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-blue-500 mb-2">蓝方阵容</p>
          {blue.map((p) => (
            <p key={p.id} className="text-sm text-gray-600">- {p.summoner_nickname} ({p.summoner_name})</p>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium text-red-500 mb-2">红方阵容</p>
          {red.map((p) => (
            <p key={p.id} className="text-sm text-gray-600">- {p.summoner_nickname} ({p.summoner_name})</p>
          ))}
        </div>
      </div>
    </details>
  )
}

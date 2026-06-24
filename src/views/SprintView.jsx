import { useState } from 'react'
import { Target, Edit3, Check, Calendar, Rocket } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

// Inline first-time setup (replaces the old full-screen popup)
function SprintInlineSetup({ onSave }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(dateUtils.today())
  const [goal, setGoal] = useState('')
  const endDate = dateUtils.sprintEndDate(startDate)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center"><Rocket size={20} className="text-gold-600" /></div>
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Start Your 12-Week Sprint</h1>
            <p className="text-navy-500 text-sm">One focused push. Set it up once.</p>
          </div>
        </div>
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Sprint Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 2026 · Launch Sprint" autoFocus className="w-full input-base px-4 py-3 text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Start Date</label>
            <div className="flex items-center gap-3">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 input-base px-4 py-3 text-sm" />
              {endDate && <span className="text-xs text-navy-400 flex items-center gap-1 flex-shrink-0"><Calendar size={12} /> ends {dateUtils.format(endDate, 'short')}</span>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">12-Week Goal <span className="text-navy-400 normal-case">(optional)</span></label>
            <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="The one thing you're driving toward..." rows={2} className="w-full input-base px-4 py-3 text-sm resize-none" />
          </div>
          {startDate && (
            <div className="bg-surface-100 rounded-xl p-3 border border-surface-300">
              <p className="text-xs text-navy-400 mb-2">Your 12-week window</p>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 12 }, (_, i) => {
                  const ws = dateUtils.weekStartDate(startDate, i + 1)
                  const isCurrent = i + 1 === dateUtils.sprintWeek(startDate)
                  const isPast = ws < dateUtils.today()
                  return <div key={i} className={`h-1.5 rounded-full ${isCurrent ? 'bg-gold-500' : isPast ? 'bg-forest-400' : 'bg-surface-300'}`} />
                })}
              </div>
            </div>
          )}
          <button onClick={() => name.trim() && onSave({ name: name.trim(), startDate, goal: goal.trim(), weeklyGoals: {}, createdAt: new Date().toISOString() })}
            disabled={!name.trim()} className="w-full py-3.5 btn-primary text-sm">Start Sprint</button>
        </div>
      </div>
    </div>
  )
}

export function SprintView({ sprint, currentWeek, progress, tasks, onSaveSprint, onUpdateWeekGoal, onUpdateGoal, onReset }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(sprint?.goal || '')
  const [editingWeek, setEditingWeek] = useState(null)
  const [weekDraft, setWeekDraft] = useState('')

  // First run — inline setup instead of popup
  if (!sprint) return <SprintInlineSetup onSave={onSaveSprint} />

  const getWeekTasks = (n) => {
    const s = dateUtils.weekStartDate(sprint.startDate, n)
    const e = dateUtils.weekStartDate(sprint.startDate, n + 1)
    const all = tasks.filter(t => t.dueDate >= s && t.dueDate < e)
    return { total: all.length, done: all.filter(t => t.status === 'done').length }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4">
        <div className="pt-5 pb-4 flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">{sprint.name}</h1>
            <p className="text-navy-500 text-sm">{dateUtils.format(sprint.startDate, 'short')} — {dateUtils.format(dateUtils.sprintEndDate(sprint.startDate), 'short')}</p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-gold-600">Wk {currentWeek}<span className="text-navy-400 text-sm font-normal">/12</span></p>
            <p className="text-xs text-navy-400">{Math.round(progress * 100)}% through</p>
          </div>
        </div>

        <div className="pb-4 space-y-3">
          {/* Overall progress bar */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-bold text-navy-500 uppercase tracking-wide">Sprint Progress</span>
              <span className="text-xs font-display font-bold text-gold-600">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full progress-glow transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg,#C47D0E,#F4A825,#F7BC55)' }} />
            </div>
          </div>

          {/* 12-Week Goal */}
          <div className="card p-4 border-gold-200 bg-gold-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-display font-bold text-gold-700 uppercase tracking-wide flex items-center gap-1.5"><Target size={12} /> 12-Week Goal</p>
              <button onClick={() => { setEditingGoal(true); setGoalDraft(sprint.goal || '') }} className="p-1 text-gold-600"><Edit3 size={12} /></button>
            </div>
            {editingGoal ? (
              <div>
                <textarea value={goalDraft} onChange={e => setGoalDraft(e.target.value)} rows={2} autoFocus className="w-full bg-white border border-gold-400 rounded-lg px-3 py-2 text-sm text-navy-800 resize-none focus:outline-none mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => { onUpdateGoal(goalDraft); setEditingGoal(false) }} className="flex items-center gap-1 text-xs btn-primary px-3 py-1.5"><Check size={11} />Save</button>
                  <button onClick={() => setEditingGoal(false)} className="text-xs btn-ghost px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-navy-700">{sprint.goal || <span className="italic text-gold-600">Click ✏️ to set your 12-week goal</span>}</p>
            )}
          </div>

          {/* Weekly breakdown */}
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide pt-1">Weekly Goals & Progress</p>
          {Array.from({ length: 12 }, (_, i) => {
            const n = i + 1, wt = getWeekTasks(n), isCurrent = n === currentWeek, isPast = n < currentWeek
            const wg = sprint.weeklyGoals?.[n] || ''
            return (
              <div key={n} className={`card overflow-hidden ${isCurrent ? 'border-gold-400 bg-gold-50' : ''} ${!isCurrent && !isPast ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold flex-shrink-0 ${isCurrent ? 'bg-gold-500 text-navy-900' : isPast ? 'bg-forest-100 text-forest-700' : 'bg-surface-200 text-navy-400'}`}>{n}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-display font-semibold ${isCurrent ? 'text-gold-700' : isPast ? 'text-navy-600' : 'text-navy-400'}`}>{isCurrent ? '← Current' : `Week ${n}`}</span>
                      <span className="text-[11px] text-navy-400">{dateUtils.format(dateUtils.weekStartDate(sprint.startDate, n), 'short')}</span>
                    </div>
                    {wg ? <p className="text-xs text-navy-500 mt-0.5 truncate">{wg}</p>
                      : (isPast || isCurrent) && <button onClick={() => { setEditingWeek(n); setWeekDraft('') }} className="text-[11px] text-navy-400 hover:text-gold-600">+ Set week goal</button>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {wt.total > 0 && <span className={`text-[11px] font-medium ${isPast && wt.done < wt.total ? 'text-red-400' : 'text-navy-400'}`}>{wt.done}/{wt.total}</span>}
                    <button onClick={() => { setEditingWeek(n); setWeekDraft(wg) }} className="p-1 text-navy-400 hover:text-gold-600"><Edit3 size={12} /></button>
                  </div>
                </div>
                {editingWeek === n && (
                  <div className="px-4 pb-3 border-t border-surface-200 pt-3">
                    <input value={weekDraft} onChange={e => setWeekDraft(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') { onUpdateWeekGoal(n, weekDraft); setEditingWeek(null) } if (e.key === 'Escape') setEditingWeek(null) }}
                      placeholder={`Week ${n} focus`} className="w-full input-base px-3 py-2 text-xs mb-2" />
                    <div className="flex gap-2">
                      <button onClick={() => { onUpdateWeekGoal(n, weekDraft); setEditingWeek(null) }} className="flex items-center gap-1 text-xs btn-primary px-2.5 py-1"><Check size={11} />Save</button>
                      <button onClick={() => setEditingWeek(null)} className="text-xs text-navy-400 px-2 py-1">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="pt-2 border-t border-surface-200">
            <button onClick={() => window.confirm('Start a new sprint? This resets your sprint dates and weekly goals (tasks are kept).') && onReset()} className="text-xs text-navy-400 hover:text-red-400 transition-colors">Start a new sprint →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

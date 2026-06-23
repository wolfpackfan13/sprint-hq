import { useState } from 'react'
import { Target, Edit3, Check } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function SprintView({ sprint, currentWeek, progress, tasks, onUpdateWeekGoal, onUpdateGoal, onReset }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(sprint?.goal||'')
  const [editingWeek, setEditingWeek] = useState(null)
  const [weekDraft, setWeekDraft] = useState('')

  const getWeekTasks = (n) => {
    const s = dateUtils.weekStartDate(sprint.startDate, n)
    const e = dateUtils.weekStartDate(sprint.startDate, n+1)
    const all = tasks.filter(t => t.dueDate >= s && t.dueDate < e)
    return { total: all.length, done: all.filter(t => t.status==='done').length }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-4 flex-shrink-0 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">12-Week Sprint</h1>
          <p className="text-navy-500 text-sm">{dateUtils.format(sprint.startDate,'short')} — {dateUtils.format(dateUtils.sprintEndDate(sprint.startDate),'short')}</p>
        </div>
        <div className="text-right">
          <p className="font-display font-bold text-gold-600">Wk {currentWeek}<span className="text-navy-400 text-sm font-normal">/12</span></p>
          <p className="text-xs text-navy-400">{Math.round(progress*100)}% through</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Goal */}
        <div className="card p-4 border-gold-200 bg-gold-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-display font-bold text-gold-700 uppercase tracking-wide flex items-center gap-1.5"><Target size={12}/>12-Week Goal</p>
            <button onClick={() => setEditingGoal(true)} className="p-1 text-gold-600"><Edit3 size={12}/></button>
          </div>
          {editingGoal ? (
            <div>
              <textarea value={goalDraft} onChange={e => setGoalDraft(e.target.value)} rows={2} autoFocus
                className="w-full bg-white border border-gold-400 rounded-lg px-3 py-2 text-sm text-navy-800 resize-none focus:outline-none mb-2"/>
              <div className="flex gap-2">
                <button onClick={() => { onUpdateGoal(goalDraft); setEditingGoal(false) }} className="flex items-center gap-1 text-xs btn-primary px-3 py-1.5"><Check size={11}/>Save</button>
                <button onClick={() => setEditingGoal(false)} className="text-xs btn-ghost px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-700">{sprint.goal || <span className="italic text-gold-600">Click ✏️ to set your 12-week goal</span>}</p>
          )}
        </div>

        {/* Week grid */}
        {Array.from({length:12},(_,i)=>{
          const n = i+1, wt = getWeekTasks(n), isCurrent = n===currentWeek, isPast = n<currentWeek
          const wg = sprint.weeklyGoals?.[n]||''
          return (
            <div key={n} className={`card overflow-hidden ${isCurrent?'border-gold-400 bg-gold-50':''} ${!isCurrent&&!isPast?'opacity-60':''}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold flex-shrink-0 ${isCurrent?'bg-gold-500 text-navy-900':isPast?'bg-forest-100 text-forest-700':'bg-surface-200 text-navy-400'}`}>{n}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-display font-semibold ${isCurrent?'text-gold-700':isPast?'text-navy-600':'text-navy-400'}`}>{isCurrent?'← Current':`Week ${n}`}</span>
                    <span className="text-[11px] text-navy-400">{dateUtils.format(dateUtils.weekStartDate(sprint.startDate,n),'short')}</span>
                  </div>
                  {wg ? <p className="text-xs text-navy-500 mt-0.5 truncate">{wg}</p>
                    : (isPast||isCurrent) && <button onClick={() => { setEditingWeek(n); setWeekDraft('') }} className="text-[11px] text-navy-400 hover:text-gold-600">+ Set week goal</button>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {wt.total>0&&<span className={`text-[11px] font-medium ${isPast&&wt.done<wt.total?'text-red-400':'text-navy-400'}`}>{wt.done}/{wt.total}</span>}
                  {(isCurrent||isPast)&&<button onClick={() => { setEditingWeek(n); setWeekDraft(wg) }} className="p-1 text-navy-400 hover:text-gold-600"><Edit3 size={12}/></button>}
                </div>
              </div>
              {editingWeek===n && (
                <div className="px-4 pb-3 border-t border-surface-200 pt-3">
                  <input type="text" value={weekDraft} onChange={e => setWeekDraft(e.target.value)} autoFocus
                    onKeyDown={e => { if(e.key==='Enter'){onUpdateWeekGoal(n,weekDraft);setEditingWeek(null)} if(e.key==='Escape')setEditingWeek(null) }}
                    placeholder={`Week ${n} focus`} className="w-full input-base px-3 py-2 text-xs mb-2"/>
                  <div className="flex gap-2">
                    <button onClick={() => { onUpdateWeekGoal(n,weekDraft); setEditingWeek(null) }} className="flex items-center gap-1 text-xs btn-primary px-2.5 py-1"><Check size={11}/>Save</button>
                    <button onClick={() => setEditingWeek(null)} className="text-xs text-navy-400 px-2 py-1">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="pt-2 border-t border-surface-200">
          <button onClick={() => window.confirm('Start a new sprint? Sprint data will reset.') && onReset()} className="text-xs text-navy-400 hover:text-red-400 transition-colors">Start a new sprint →</button>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { Plus, CheckCircle2, Zap, Star, AlertCircle, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function DoView({
  todayTasks, top3Tasks, missedTasks, companies, projects,
  onAdd, onComplete, onUncomplete, onEdit, onDelete,
  completedToday, timer, onToggleTimer, onToggleSubtask, onBreakdown, onToggleTop3,
}) {
  const [quickTitle, setQuickTitle] = useState('')
  const [showMissed, setShowMissed] = useState(true)
  const inputRef = useRef(null)
  const today = dateUtils.today()

  const todoTasks = todayTasks.filter(t => t.status === 'todo' && !t.isTop3)
  const doneTasks = todayTasks.filter(t => t.status === 'done')
  const missedTodo = missedTasks.filter(t => t.status === 'todo')

  const handleQuickAdd = (e) => {
    e.preventDefault()
    if (!quickTitle.trim()) return
    onAdd({ title: quickTitle.trim(), dueDate: today, priority: 'medium' })
    setQuickTitle('')
    inputRef.current?.focus()
  }

  const cardProps = { companies, projects, onComplete, onUncomplete, onEdit, onDelete, timer, onToggleTimer, onToggleSubtask, onBreakdown, onToggleTop3 }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Today</h1>
            <p className="text-navy-500 text-sm">{dateUtils.format(today, 'long')}</p>
          </div>
          {completedToday > 0 && (
            <div className="flex items-center gap-1.5 text-forest-600 bg-forest-50 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={14} /><span className="font-display font-bold text-sm">{completedToday} done</span>
            </div>
          )}
        </div>

        <form onSubmit={handleQuickAdd} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-surface-100 border border-surface-300 rounded-xl px-4 py-2.5 focus-within:border-gold-500 focus-within:bg-white transition-all">
            <Zap size={13} className="text-navy-400 flex-shrink-0" />
            <input ref={inputRef} type="text" value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              placeholder="Quick capture — Enter to add"
              className="flex-1 bg-transparent text-sm text-navy-900 placeholder-navy-400 focus:outline-none" />
          </div>
          <button type="button" onClick={() => onAdd({ dueDate: today })} className="px-3 py-2.5 btn-primary"><Plus size={17} strokeWidth={2.5} /></button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        {/* MISSED triage banner */}
        {missedTodo.length > 0 && (
          <div className="card border-red-200 bg-red-50 overflow-hidden">
            <button onClick={() => setShowMissed(s => !s)} className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="font-display font-semibold text-red-700 text-sm">{missedTodo.length} missed — triage these</span>
              </div>
              {showMissed ? <ChevronUp size={16} className="text-red-400" /> : <ChevronDown size={16} className="text-red-400" />}
            </button>
            {showMissed && (
              <div className="px-3 pb-3 space-y-2">
                {missedTodo.map(task => (
                  <div key={task.id}>
                    <TaskCard task={task} {...cardProps} showDate />
                    <div className="flex gap-3 mt-1 pl-8">
                      <button onClick={() => onEdit({ ...task, dueDate: today })} className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-gold-600"><RotateCcw size={10} />Move to today</button>
                      <span className="text-navy-300">·</span>
                      <button onClick={() => onComplete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-forest-500"><CheckCircle2 size={10} />Done</button>
                      <span className="text-navy-300">·</span>
                      <button onClick={() => onDelete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-red-400"><X size={10} />Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOP 3 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} className="text-gold-500" fill="#F4A825" />
            <h2 className="font-display font-bold text-navy-800 text-sm uppercase tracking-wide">Top 3 Today</h2>
            <span className="text-xs text-navy-400">{top3Tasks.length}/3</span>
          </div>
          {top3Tasks.length === 0 ? (
            <div className="card border-dashed border-gold-200 bg-gold-50 px-4 py-4 text-center">
              <p className="text-sm text-navy-600 font-medium">Pick your 3 outcomes for today</p>
              <p className="text-xs text-navy-400 mt-0.5">Tap the ⭐ on any task to promote it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {top3Tasks.map(task => <TaskCard key={task.id} task={task} {...cardProps} large />)}
            </div>
          )}
        </div>

        {/* The rest of today */}
        {todoTasks.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-navy-400 text-xs uppercase tracking-wide mb-2">Also Today</h2>
            <div className="space-y-2">
              {todoTasks.map(task => <TaskCard key={task.id} task={task} {...cardProps} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {todayTasks.length === 0 && top3Tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <CheckCircle2 size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Nothing scheduled today</p>
            <p className="text-navy-400 text-sm mt-1">Capture something above to get going</p>
          </div>
        )}

        {/* Completed */}
        {doneTasks.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-navy-400 text-xs uppercase tracking-wide mb-2">✓ Completed today</h2>
            <div className="space-y-2">
              {doneTasks.map(task => <TaskCard key={task.id} task={task} {...cardProps} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { Plus, CheckCircle2, Zap, Timer } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function Today({ tasks, companies, onAdd, onComplete, onUncomplete, onEdit, onDelete, completedToday, onFocus }) {
  const [quickTitle, setQuickTitle] = useState('')
  const inputRef = useRef(null)
  const today = dateUtils.today()
  const todoTasks = tasks.filter(t => t.status === 'todo')
  const doneTasks = tasks.filter(t => t.status === 'done')

  const handleQuickAdd = (e) => {
    e.preventDefault()
    if (!quickTitle.trim()) return
    onAdd({ title: quickTitle.trim(), dueDate: today, priority: 'medium' })
    setQuickTitle('')
    inputRef.current?.focus()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Today</h1>
            <p className="text-navy-500 text-sm">{dateUtils.format(today, 'long')}</p>
          </div>
          <div className="text-right">
            {completedToday > 0 && (
              <div className="flex items-center gap-1.5 text-forest-600">
                <CheckCircle2 size={14} />
                <span className="font-display font-bold text-sm">{completedToday} done</span>
              </div>
            )}
            {todoTasks.length > 0 && <p className="text-xs text-navy-400">{todoTasks.length} remaining</p>}
          </div>
        </div>

        {/* Quick capture */}
        <form onSubmit={handleQuickAdd} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-surface-100 border border-surface-300 rounded-xl px-4 py-2.5 focus-within:border-gold-500 focus-within:bg-white transition-all">
            <Zap size={13} className="text-navy-400 flex-shrink-0" />
            <input ref={inputRef} type="text" value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              placeholder="Quick capture — Enter to add"
              className="flex-1 bg-transparent text-sm text-navy-900 placeholder-navy-400 focus:outline-none" />
          </div>
          <button type="button" onClick={() => onAdd({ dueDate: today })}
            className="px-3 py-2.5 btn-primary"><Plus size={17} strokeWidth={2.5} /></button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle2 size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Nothing due today</p>
            <p className="text-navy-400 text-sm mt-1">Quick capture above or + for full details</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Todo tasks */}
            {todoTasks.map(task => (
              <div key={task.id} className="group relative">
                <TaskCard task={task} companies={companies} onComplete={onComplete} onUncomplete={onUncomplete} onEdit={onEdit} onDelete={onDelete} />
                {onFocus && (
                  <button onClick={() => onFocus(task)}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-semibold text-navy-400 hover:text-gold-600 bg-surface-100 px-2 py-1 rounded-lg border border-surface-300">
                    <Timer size={10} /> Focus
                  </button>
                )}
              </div>
            ))}
            {/* Done tasks */}
            {doneTasks.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest mb-2">Completed today</p>
                <div className="space-y-2">
                  {doneTasks.map(task => (
                    <TaskCard key={task.id} task={task} companies={companies} onComplete={onComplete} onUncomplete={onUncomplete} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

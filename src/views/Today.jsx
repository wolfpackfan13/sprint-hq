import { useState, useRef } from 'react'
import { Plus, CheckCircle, Zap } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function Today({ tasks, onAdd, onComplete, onUncomplete, onEdit, onDelete, completedToday }) {
  const [quickTitle, setQuickTitle] = useState('')
  const inputRef = useRef(null)

  const today = dateUtils.today()
  const todayLabel = dateUtils.format(today, 'long')
  const todoCount = tasks.filter(t => t.status === 'todo').length

  const handleQuickAdd = (e) => {
    e.preventDefault()
    if (!quickTitle.trim()) return
    onAdd({
      title: quickTitle.trim(),
      dueDate: today,
      priority: 'medium',
    })
    setQuickTitle('')
    inputRef.current?.focus()
  }

  return (
    <div className="h-full flex flex-col">
      {/* View header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-white text-xl">Today</h1>
            <p className="text-navy-400 text-sm mt-0.5">{todayLabel}</p>
          </div>
          <div className="text-right">
            {completedToday > 0 && (
              <div className="flex items-center gap-1.5 text-forest-400">
                <CheckCircle size={14} />
                <span className="text-sm font-display font-semibold">{completedToday} done</span>
              </div>
            )}
            {todoCount > 0 && (
              <p className="text-xs text-navy-400 mt-0.5">{todoCount} remaining</p>
            )}
          </div>
        </div>

        {/* Quick capture bar */}
        <form onSubmit={handleQuickAdd} className="mt-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-navy-800 border border-navy-600 rounded-xl px-4 py-2.5 focus-within:border-gold-500 transition-colors">
              <Zap size={14} className="text-navy-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="Quick capture — hit Enter to add"
                className="flex-1 bg-transparent text-white placeholder-navy-600 text-sm focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => onAdd({ dueDate: today })}
              className="px-3 py-2.5 rounded-xl bg-gold-500 text-navy-900 hover:bg-gold-400 transition-colors"
              aria-label="Add detailed task"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-full bg-navy-800 flex items-center justify-center mb-3">
              <CheckCircle size={24} className="text-navy-600" />
            </div>
            <p className="text-white font-display font-medium">Nothing due today</p>
            <p className="text-navy-500 text-sm mt-1">Quick capture above or use + for full details</p>
          </div>
        ) : (
          <div className="space-y-2 group">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onEdit={onEdit}
                onDelete={onDelete}
                showDate={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

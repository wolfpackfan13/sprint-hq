import { useState } from 'react'
import { Check, Trash2, Pencil, ChevronDown, ChevronUp, Clock, RotateCcw } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F4A825',
  low: '#576282',
}

const PRIORITY_LABELS = { high: 'High', medium: 'Med', low: 'Low' }

export function TaskCard({ task, onComplete, onUncomplete, onEdit, onDelete, showDate = false }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = task.status === 'done'
  const isMissed = dateUtils.isMissed(task)
  const daysOver = isMissed ? dateUtils.daysOverdue(task.dueDate) : 0

  return (
    <div
      className={`card-hover border rounded-xl px-4 py-3 transition-all ${
        isDone
          ? 'bg-navy-900 border-navy-700 opacity-60'
          : isMissed
          ? 'bg-navy-800 border-red-900'
          : 'bg-navy-800 border-navy-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => isDone ? onUncomplete(task.id) : onComplete(task.id)}
          className={`task-check flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
            isDone
              ? 'bg-forest-500 border-forest-500'
              : isMissed
              ? 'border-red-700 hover:border-red-500'
              : 'border-navy-500 hover:border-gold-500'
          }`}
          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
        >
          {isDone && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-medium leading-snug ${
                isDone ? 'line-through text-navy-400' : 'text-white'
              }`}
            >
              {task.title}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.notes && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="p-1 text-navy-400 hover:text-white transition-colors"
                  aria-label="Toggle notes"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
              <button
                onClick={() => onEdit(task)}
                className="p-1 text-navy-400 hover:text-gold-400 transition-colors"
                aria-label="Edit task"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                aria-label="Delete task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {/* Priority dot */}
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
              title={PRIORITY_LABELS[task.priority] + ' priority'}
            />

            {/* Project tag */}
            {task.project && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: task.projectColor ? `${task.projectColor}22` : '#1A2338',
                  color: task.projectColor || '#8B9CC8',
                  border: `1px solid ${task.projectColor ? `${task.projectColor}44` : '#2D3C57'}`,
                }}
              >
                {task.project}
              </span>
            )}

            {/* Date chip */}
            {showDate && task.dueDate && (
              <span className={`flex items-center gap-1 text-[11px] ${
                isMissed ? 'text-red-400' : 'text-navy-400'
              }`}>
                <Clock size={10} />
                {isMissed
                  ? `${daysOver}d overdue`
                  : dateUtils.format(task.dueDate, 'short')
                }
              </span>
            )}

            {/* Uncomplete option when done */}
            {isDone && (
              <button
                onClick={() => onUncomplete(task.id)}
                className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-navy-300 transition-colors"
              >
                <RotateCcw size={10} />
                undo
              </button>
            )}
          </div>

          {/* Expanded notes */}
          {expanded && task.notes && (
            <p className="text-xs text-navy-400 mt-2 leading-relaxed border-t border-navy-700 pt-2">
              {task.notes}
            </p>
          )}
        </div>

        {/* Actions always visible on mobile */}
        <div className="flex md:hidden items-center gap-1 flex-shrink-0">
          {task.notes && (
            <button onClick={() => setExpanded(e => !e)} className="p-1 text-navy-500">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button onClick={() => onEdit(task)} className="p-1 text-navy-500">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 text-navy-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

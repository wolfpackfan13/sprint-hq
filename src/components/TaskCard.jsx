import { useState } from 'react'
import { Check, Trash2, Pencil, ChevronDown, ChevronUp, Clock, RotateCcw } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

const PRIORITY_DOT = { high: '#EF4444', medium: '#F4A825', low: '#9BA5BB' }

export function TaskCard({ task, companies = [], onComplete, onUncomplete, onEdit, onDelete, showDate = false }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = task.status === 'done'
  const isMissed = dateUtils.isMissed(task)
  const daysOver = isMissed ? dateUtils.daysOverdue(task.dueDate) : 0
  const company = companies.find(c => c.id === task.companyId)

  return (
    <div className={`card px-4 py-3 transition-all ${isDone ? 'opacity-55' : isMissed ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => isDone ? onUncomplete(task.id) : onComplete(task.id)}
          className={`task-check flex-shrink-0 w-4.5 h-4.5 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-all ${
            isDone ? 'bg-forest-500 border-forest-500' : isMissed ? 'border-red-400 hover:border-red-500' : 'border-surface-400 hover:border-gold-500'
          }`}
        >
          {isDone && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-navy-400' : 'text-navy-900'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {task.notes && (
                <button onClick={() => setExpanded(e => !e)} className="p-1 text-navy-400 hover:text-navy-700">
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
              <button onClick={() => onEdit(task)} className="p-1 text-navy-400 hover:text-gold-600"><Pencil size={13} /></button>
              <button onClick={() => onDelete(task.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_DOT[task.priority] }} />
            {company && (
              <span className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${company.color}15`, color: company.color, border: `1px solid ${company.color}30` }}>
                {company.emoji} {company.name}
              </span>
            )}
            {showDate && task.dueDate && (
              <span className={`flex items-center gap-1 text-[11px] ${isMissed ? 'text-red-500' : 'text-navy-400'}`}>
                <Clock size={10} />
                {isMissed ? `${daysOver}d overdue` : dateUtils.format(task.dueDate, 'short')}
              </span>
            )}
            {isDone && (
              <button onClick={() => onUncomplete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-600">
                <RotateCcw size={10} /> undo
              </button>
            )}
          </div>
          {expanded && task.notes && (
            <p className="text-xs text-navy-500 mt-2 leading-relaxed border-t border-surface-200 pt-2">{task.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Check, Trash2, Pencil, ChevronDown, ChevronUp, Clock, RotateCcw, Play, Pause, Sparkles, Star, ListChecks } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'
import { ResourceLinks } from './ResourceLinks'

const PRIORITY_DOT = { high: '#EF4444', medium: '#F4A825', low: '#9BA5BB' }

export function TaskCard({
  task, companies = [], projects = [],
  onComplete, onUncomplete, onEdit, onDelete, showDate = false,
  timer, onToggleTimer, onToggleSubtask, onBreakdown, onToggleTop3,
  large = false,
}) {
  const [expanded, setExpanded] = useState(false)
  const isDone = task.status === 'done'
  const isMissed = dateUtils.isMissed(task)
  const daysOver = isMissed ? dateUtils.daysOverdue(task.dueDate) : 0
  const company = companies.find(c => c.id === task.companyId)
  const project = projects.find(p => p.id === task.projectId)
  const subtasks = task.subtasks || []
  const subDone = subtasks.filter(s => s.done).length
  const totalSecs = timeUtils.totalSeconds(task.timeEntries)
  const isTiming = timer?.isRunning(task.id)
  const liveSecs = isTiming ? totalSecs + timer.elapsed : totalSecs

  return (
    <div className={`card transition-all ${large ? 'px-4 py-3.5 border-gold-200' : 'px-4 py-3'} ${isDone ? 'opacity-55' : isMissed ? 'border-red-200 bg-red-50' : ''} ${isTiming ? 'ring-2 ring-gold-300' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => isDone ? onUncomplete(task.id) : onComplete(task.id)}
          className={`task-check flex-shrink-0 ${large ? 'w-5 h-5' : 'w-5 h-5'} rounded border-2 flex items-center justify-center mt-0.5 transition-all ${
            isDone ? 'bg-forest-500 border-forest-500' : isMissed ? 'border-red-400 hover:border-red-500' : 'border-surface-400 hover:border-gold-500'
          }`}>
          {isDone && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Breadcrumb — always on */}
          {(company || project) && (
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              {company && (
                <span className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${company.color}15`, color: company.color }}>
                  {company.emoji} {company.name}
                </span>
              )}
              {project && (
                <>
                  <span className="text-navy-300 text-[10px]">›</span>
                  <span className="text-[10px] font-medium text-navy-500">{project.name}</span>
                </>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <p className={`${large ? 'text-base' : 'text-sm'} font-medium leading-snug ${isDone ? 'line-through text-navy-400' : 'text-navy-900'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onToggleTop3 && !isDone && (
                <button onClick={() => onToggleTop3(task.id)}
                  className={`p-1 transition-colors ${task.isTop3 ? 'text-gold-500' : 'text-navy-300 hover:text-gold-500'}`}
                  title="Mark as Top 3">
                  <Star size={13} fill={task.isTop3 ? '#F4A825' : 'none'} />
                </button>
              )}
              <button onClick={() => onEdit(task)} className="p-1 text-navy-400 hover:text-gold-600"><Pencil size={13} /></button>
              <button onClick={() => onDelete(task.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_DOT[task.priority] }} />

            {showDate && task.dueDate && (
              <span className={`flex items-center gap-1 text-[11px] ${isMissed ? 'text-red-500' : 'text-navy-400'}`}>
                <Clock size={10} /> {isMissed ? `${daysOver}d overdue` : dateUtils.format(task.dueDate, 'short')}
              </span>
            )}

            {/* Subtask progress */}
            {subtasks.length > 0 && (
              <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-navy-700">
                <ListChecks size={11} /> {subDone}/{subtasks.length}
              </button>
            )}

            {/* Timer */}
            {onToggleTimer && !isDone && (
              <button onClick={() => onToggleTimer(task.id)}
                className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded transition-all ${isTiming ? 'bg-gold-100 text-gold-700' : 'text-navy-400 hover:text-gold-600'}`}>
                {isTiming ? <Pause size={10} /> : <Play size={10} />}
                {liveSecs > 0 ? timeUtils.formatClock(liveSecs) : 'Track'}
              </button>
            )}
            {isDone && totalSecs > 0 && (
              <span className="text-[11px] text-navy-400 flex items-center gap-1"><Clock size={10} /> {timeUtils.formatDuration(totalSecs)}</span>
            )}

            {/* AI breakdown */}
            {onBreakdown && !isDone && subtasks.length === 0 && (
              <button onClick={() => onBreakdown(task)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-600 transition-colors">
                <Sparkles size={10} /> Break down
              </button>
            )}

            {isDone && (
              <button onClick={() => onUncomplete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-600">
                <RotateCcw size={10} /> undo
              </button>
            )}

            {(task.notes || subtasks.length > 0 || (task.resources||[]).length > 0) && (
              <button onClick={() => setExpanded(e => !e)} className="ml-auto p-0.5 text-navy-400 hover:text-navy-700">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>

          {/* Expanded: subtasks + notes */}
          {expanded && (
            <div className="mt-2 border-t border-surface-200 pt-2 space-y-2">
              {subtasks.length > 0 && (
                <div className="space-y-1">
                  {subtasks.map(s => (
                    <button key={s.id} onClick={() => onToggleSubtask?.(task.id, s.id)}
                      className="flex items-center gap-2 w-full text-left group">
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-forest-500 border-forest-500' : 'border-surface-400 group-hover:border-gold-500'}`}>
                        {s.done && <Check size={9} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className={`text-xs ${s.done ? 'line-through text-navy-400' : 'text-navy-600'}`}>{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {task.notes && <p className="text-xs text-navy-500 leading-relaxed">{task.notes}</p>}
              {(task.resources||[]).length > 0 && <ResourceLinks resources={task.resources} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

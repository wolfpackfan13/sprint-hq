import { AlertCircle, RotateCcw, CheckCircle2, X } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function Missed({ tasks, onAdd, onComplete, onUncomplete, onEdit, onDelete }) {
  const handleRescheduleToday = (taskId) => {
    onEdit({ id: taskId, reschedule: true, newDate: dateUtils.today() })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/40 border border-red-900 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="font-display font-bold text-white text-xl">Missed</h1>
            <p className="text-navy-400 text-sm mt-0.5">
              {tasks.length === 0
                ? 'No overdue tasks — clean slate'
                : `${tasks.filter(t => t.status === 'todo').length} task${tasks.filter(t => t.status === 'todo').length !== 1 ? 's' : ''} overdue`
              }
            </p>
          </div>
        </div>

        {tasks.filter(t => t.status === 'todo').length > 0 && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-900/50 rounded-xl">
            <p className="text-xs text-red-400 font-medium">
              These tasks missed their deadline. Complete, reschedule, or delete them.
            </p>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-full bg-forest-700/30 border border-forest-700 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-forest-400" />
            </div>
            <p className="text-white font-display font-medium">All caught up</p>
            <p className="text-navy-500 text-sm mt-1">No overdue tasks — keep executing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="relative">
                <TaskCard
                  task={task}
                  onComplete={onComplete}
                  onUncomplete={onUncomplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showDate={true}
                />
                {/* Reschedule to today shortcut */}
                {task.status === 'todo' && (
                  <div className="flex gap-2 mt-1 pl-8">
                    <button
                      onClick={() => {
                        const updated = { ...task, dueDate: dateUtils.today() }
                        onEdit(updated)
                      }}
                      className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-gold-500 transition-colors"
                    >
                      <RotateCcw size={10} />
                      Move to today
                    </button>
                    <span className="text-navy-700">·</span>
                    <button
                      onClick={() => onComplete(task.id)}
                      className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-forest-400 transition-colors"
                    >
                      <CheckCircle2 size={10} />
                      Mark done
                    </button>
                    <span className="text-navy-700">·</span>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

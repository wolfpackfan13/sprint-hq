import { AlertCircle, RotateCcw, CheckCircle2, X } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function Missed({ tasks, companies, onComplete, onUncomplete, onEdit, onDelete }) {
  const todo = tasks.filter(t => t.status === 'todo')
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Missed</h1>
            <p className="text-navy-500 text-sm">{todo.length === 0 ? 'All clear — clean slate' : `${todo.length} task${todo.length!==1?'s':''} overdue`}</p>
          </div>
        </div>
        {todo.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-600 font-medium">Complete, reschedule, or delete these tasks.</p>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle2 size={32} className="text-forest-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">All caught up</p>
            <p className="text-navy-400 text-sm mt-1">No overdue tasks — keep executing</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id}>
                <TaskCard task={task} companies={companies} onComplete={onComplete} onUncomplete={onUncomplete} onEdit={onEdit} onDelete={onDelete} showDate />
                {task.status === 'todo' && (
                  <div className="flex gap-3 mt-1 pl-8">
                    <button onClick={() => onEdit({ ...task, dueDate: dateUtils.today() })} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-600 transition-colors"><RotateCcw size={10}/>Move to today</button>
                    <span className="text-navy-300">·</span>
                    <button onClick={() => onComplete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-forest-500 transition-colors"><CheckCircle2 size={10}/>Mark done</button>
                    <span className="text-navy-300">·</span>
                    <button onClick={() => onDelete(task.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-red-400 transition-colors"><X size={10}/>Delete</button>
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

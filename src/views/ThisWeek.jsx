import { Plus } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function ThisWeek({ tasks, allTasks, onAdd, onComplete, onUncomplete, onEdit, onDelete }) {
  const weekDays = dateUtils.thisWeekDays()

  const getTasksForDate = (dateStr) =>
    allTasks.filter(t => t.dueDate === dateStr)

  const totalTodo = allTasks.filter(t => t.status === 'todo').length
  const totalDone = allTasks.filter(t => t.status === 'done').length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-white text-xl">This Week</h1>
            <p className="text-navy-400 text-sm mt-0.5">
              {dateUtils.format(weekDays[0].date, 'short')} — {dateUtils.format(weekDays[6].date, 'short')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-display font-semibold text-white">
              {totalDone}/{totalDone + totalTodo}
            </p>
            <p className="text-xs text-navy-400 mt-0.5">tasks done</p>
          </div>
        </div>

        {/* Week progress mini bar */}
        <div className="flex gap-1 mt-3">
          {weekDays.map(day => {
            const dayTasks = getTasksForDate(day.date)
            const done = dayTasks.filter(t => t.status === 'done').length
            const total = dayTasks.length
            return (
              <div key={day.date} className="flex-1">
                <div
                  className={`text-[10px] text-center mb-1 font-medium ${
                    day.isToday ? 'text-gold-500' : 'text-navy-500'
                  }`}
                >
                  {day.label}
                </div>
                <div className={`h-1 rounded-full ${
                  day.isToday ? 'bg-gold-500/30' : 'bg-navy-700'
                }`}>
                  {total > 0 && (
                    <div
                      className="h-full rounded-full bg-forest-400"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  )}
                </div>
                {total > 0 && (
                  <div className="text-[9px] text-center mt-0.5 text-navy-500">{total}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Task list grouped by day */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
        {weekDays.map(day => {
          const dayTasks = getTasksForDate(day.date)
          const sortedTasks = [...dayTasks].sort((a, b) => {
            if (a.status === 'done' && b.status !== 'done') return 1
            if (a.status !== 'done' && b.status === 'done') return -1
            const order = { high: 0, medium: 1, low: 2 }
            return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
          })

          return (
            <div key={day.date}>
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-display font-semibold uppercase tracking-wide ${
                    day.isToday ? 'text-gold-500' : 'text-navy-400'
                  }`}>
                    {day.isToday ? 'Today' : day.label}
                  </span>
                  <span className="text-xs text-navy-600">
                    {dateUtils.format(day.date, 'short')}
                  </span>
                  {day.isToday && (
                    <span className="text-[10px] bg-gold-500 text-navy-900 px-1.5 py-0.5 rounded-full font-bold">
                      NOW
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAdd({ dueDate: day.date })}
                  className="p-1 text-navy-600 hover:text-gold-500 transition-colors"
                  aria-label={`Add task for ${day.label}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {sortedTasks.length === 0 ? (
                <button
                  onClick={() => onAdd({ dueDate: day.date })}
                  className={`w-full py-2 text-xs text-navy-600 hover:text-navy-400 border border-dashed rounded-xl transition-colors text-center ${
                    day.isToday ? 'border-gold-900 hover:border-gold-700' : 'border-navy-800 hover:border-navy-600'
                  }`}
                >
                  + Add task
                </button>
              ) : (
                <div className="space-y-2">
                  {sortedTasks.map(task => (
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
          )
        })}
      </div>
    </div>
  )
}

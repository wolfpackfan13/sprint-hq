import { useState, useMemo } from 'react'
import { Plus, ListTodo, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function AllTasks({ tasks, companies, projects, activeClient, onAdd, taskCardProps }) {
  const [showCompleted, setShowCompleted] = useState(false)

  const today = dateUtils.today()
  const tomorrow = dateUtils.addDays(1)
  const weekDays = dateUtils.thisWeekDays()
  const weekEnd = weekDays[6].date

  const visible = useMemo(() =>
    tasks.filter(t => !activeClient || t.companyId === activeClient),
  [tasks, activeClient])

  const open = visible.filter(t => t.status === 'todo')
  const done = visible.filter(t => t.status === 'done')

  const byDate = (a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }

  const groups = useMemo(() => {
    const g = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], someday: [] }
    open.forEach(t => {
      if (!t.dueDate) g.someday.push(t)
      else if (t.dueDate < today) g.overdue.push(t)
      else if (t.dueDate === today) g.today.push(t)
      else if (t.dueDate === tomorrow) g.tomorrow.push(t)
      else if (t.dueDate <= weekEnd) g.thisWeek.push(t)
      else g.later.push(t)
    })
    Object.values(g).forEach(arr => arr.sort(byDate))
    return g
  }, [open, today, tomorrow, weekEnd])

  const sections = [
    { key: 'overdue', label: 'Overdue', color: '#EF4444' },
    { key: 'today', label: 'Today', color: '#F4A825' },
    { key: 'tomorrow', label: 'Tomorrow', color: '#3B82F6' },
    { key: 'thisWeek', label: 'This Week', color: '#2D7A50' },
    { key: 'later', label: 'Later', color: '#6B7280' },
    { key: 'someday', label: 'Someday · No date', color: '#9BA5BB' },
  ]

  const totalOpen = open.length

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl flex items-center gap-2"><ListTodo size={20} className="text-gold-500" /> All Tasks</h1>
            <p className="text-navy-500 text-sm mt-0.5">{totalOpen} open across all dates</p>
          </div>
          <button onClick={() => onAdd({})} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"><Plus size={15} /> New</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 max-w-2xl mx-auto w-full">
        {totalOpen === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle2 size={32} className="text-forest-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Inbox zero</p>
            <p className="text-navy-400 text-sm mt-1">No open tasks anywhere</p>
          </div>
        )}

        {sections.map(sec => {
          const items = groups[sec.key]
          if (items.length === 0) return null
          return (
            <div key={sec.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sec.color }}>{sec.label}</span>
                <span className="text-[10px] text-navy-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)}
              </div>
            </div>
          )
        })}

        {/* Completed, collapsed */}
        {done.length > 0 && (
          <div>
            <button onClick={() => setShowCompleted(s => !s)} className="flex items-center gap-2 mb-2 text-navy-400 hover:text-navy-600">
              {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="text-[10px] font-bold uppercase tracking-widest">Completed</span>
              <span className="text-[10px]">{done.length}</span>
            </button>
            {showCompleted && (
              <div className="space-y-2">
                {done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 30).map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

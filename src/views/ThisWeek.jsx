import { Plus } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'

export function ThisWeek({ allTasks, companies, onAdd, onComplete, onUncomplete, onEdit, onDelete }) {
  const weekDays = dateUtils.thisWeekDays()
  const getDay = (d) => allTasks.filter(t => t.dueDate === d).sort((a,b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    const o = { high:0,medium:1,low:2 }; return (o[a.priority]??1)-(o[b.priority]??1)
  })
  const total = allTasks.length
  const done = allTasks.filter(t => t.status === 'done').length

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">This Week</h1>
            <p className="text-navy-500 text-sm">{dateUtils.format(weekDays[0].date,'short')} — {dateUtils.format(weekDays[6].date,'short')}</p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-navy-900 text-sm">{done}/{total}</p>
            <p className="text-xs text-navy-400">tasks done</p>
          </div>
        </div>
        {/* Day dots */}
        <div className="flex gap-1">
          {weekDays.map(d => {
            const dayT = getDay(d.date)
            const dDone = dayT.filter(t=>t.status==='done').length
            return (
              <div key={d.date} className="flex-1">
                <div className={`text-[10px] text-center mb-1 font-medium ${d.isToday?'text-gold-600':'text-navy-400'}`}>{d.label}</div>
                <div className={`h-1 rounded-full ${d.isToday?'bg-gold-200':'bg-surface-300'}`}>
                  {dayT.length>0&&<div className="h-full rounded-full bg-forest-400 transition-all" style={{width:`${(dDone/dayT.length)*100}%`}}/>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        {weekDays.map(d => {
          const dayTasks = getDay(d.date)
          return (
            <div key={d.date}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-display font-bold uppercase tracking-wide ${d.isToday?'text-gold-600':'text-navy-400'}`}>{d.isToday?'Today':d.label}</span>
                  <span className="text-xs text-navy-400">{dateUtils.format(d.date,'short')}</span>
                  {d.isToday && <span className="text-[9px] bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full font-bold">NOW</span>}
                </div>
                <button onClick={() => onAdd({ dueDate: d.date })} className="p-1 text-navy-400 hover:text-gold-600"><Plus size={14}/></button>
              </div>
              {dayTasks.length === 0
                ? <button onClick={() => onAdd({ dueDate: d.date })} className={`w-full py-2 text-xs text-navy-400 hover:text-navy-600 border border-dashed rounded-xl transition-colors ${d.isToday?'border-gold-200 hover:border-gold-400':'border-surface-300 hover:border-surface-400'}`}>+ Add task</button>
                : <div className="space-y-2">{dayTasks.map(t => <TaskCard key={t.id} task={t} companies={companies} onComplete={onComplete} onUncomplete={onUncomplete} onEdit={onEdit} onDelete={onDelete}/>)}</div>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

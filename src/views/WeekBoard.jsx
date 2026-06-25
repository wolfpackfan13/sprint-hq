import { useState } from 'react'
import { Plus, Check, Clock, FolderKanban } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

const PRIORITY_DOT = { high: '#EF4444', medium: '#F4A825', low: '#9BA5BB' }

// Compact task chip for the board (smaller than full TaskCard)
function BoardTask({ task, companies, projects, onComplete, onEdit, onDragStart, onDragEnd, dragging }) {
  const isDone = task.status === 'done'
  const company = companies.find(c => c.id === task.companyId)
  const project = projects.find(p => p.id === task.projectId)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className={`card px-2.5 py-2 cursor-grab active:cursor-grabbing transition-all ${isDone ? 'opacity-50' : ''} ${dragging ? 'opacity-40 scale-95' : 'hover:shadow-card-hover'}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task.id) }}
          className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-forest-500 border-forest-500' : 'border-surface-400 hover:border-gold-500'}`}>
          {isDone && <Check size={8} className="text-white" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          {company && (
            <span className="text-[9px] font-display font-semibold px-1 py-0.5 rounded inline-block mb-0.5" style={{ backgroundColor: `${company.color}15`, color: company.color }}>
              {company.emoji} {company.name}
            </span>
          )}
          <p className={`text-xs leading-snug ${isDone ? 'line-through text-navy-400' : 'text-navy-800'}`}>{task.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_DOT[task.priority] }} />
            {project && <span className="text-[9px] text-navy-400 truncate">{project.name}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WeekBoard({ allTasks, companies, projects, onAdd, onComplete, onEdit, onReschedule, onOpenProject }) {
  const weekDays = dateUtils.thisWeekDays()
  const [draggingTask, setDraggingTask] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)

  const getDay = (d) => allTasks.filter(t => t.dueDate === d).sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    const o = { high: 0, medium: 1, low: 2 }
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1)
  })

  const projectsDue = (d) => (projects || []).filter(p => p.status === 'active' && p.dueDate === d)

  const onDragStart = (e, task) => { setDraggingTask(task); e.dataTransfer.effectAllowed = 'move' }
  const onDragEnd = () => { setDraggingTask(null); setDragOverDay(null) }
  const onDrop = (e, date) => {
    e.preventDefault()
    if (draggingTask && draggingTask.dueDate !== date) onReschedule(draggingTask.id, date)
    setDraggingTask(null); setDragOverDay(null)
  }

  const total = allTasks.length
  const done = allTasks.filter(t => t.status === 'done').length

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">This Week</h1>
            <p className="text-navy-500 text-sm">{dateUtils.format(weekDays[0].date, 'short')} — {dateUtils.format(weekDays[6].date, 'short')} · drag to reschedule</p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-navy-900 text-sm">{done}/{total}</p>
            <p className="text-xs text-navy-400">done</p>
          </div>
        </div>
      </div>

      {/* Horizontal board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4">
        <div className="flex gap-3 h-full min-w-max md:min-w-0 md:max-w-6xl md:mx-auto">
          {weekDays.map(day => {
            const dayTasks = getDay(day.date)
            const dayDone = dayTasks.filter(t => t.status === 'done').length
            const isOver = dragOverDay === day.date
            return (
              <div
                key={day.date}
                onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.date) }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => onDrop(e, day.date)}
                className={`flex flex-col w-60 md:w-auto md:flex-1 flex-shrink-0 rounded-xl transition-colors ${isOver ? 'bg-gold-50 ring-2 ring-gold-300' : day.isToday ? 'bg-gold-50/40' : 'bg-surface-100/60'}`}
              >
                {/* Day header */}
                <div className={`px-3 py-2.5 flex items-center justify-between border-b ${day.isToday ? 'border-gold-200' : 'border-surface-300'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-display font-bold uppercase ${day.isToday ? 'text-gold-600' : 'text-navy-600'}`}>{day.label}</span>
                    <span className="text-[11px] text-navy-400">{new Date(day.date + 'T12:00:00').getDate()}</span>
                    {day.isToday && <span className="text-[8px] bg-gold-500 text-navy-900 px-1 py-0.5 rounded-full font-bold">NOW</span>}
                  </div>
                  {dayTasks.length > 0 && <span className="text-[10px] text-navy-400 font-medium">{dayDone}/{dayTasks.length}</span>}
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {projectsDue(day.date).map(p => {
                    const co = companies.find(c => c.id === p.companyId)
                    return (
                      <button key={p.id} onClick={() => onOpenProject ? onOpenProject(p) : null}
                        className="w-full text-left rounded-lg px-2 py-1.5 border-l-2 flex items-center gap-1.5"
                        style={{ backgroundColor: co ? `${co.color}12` : '#F0F2F8', borderColor: co?.color || '#9BA5BB' }}>
                        <FolderKanban size={11} style={{ color: co?.color || '#9BA5BB' }} className="flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: co?.color || '#9BA5BB' }}>Project due</p>
                          <p className="text-[11px] font-semibold text-navy-800 truncate">{p.name}</p>
                        </div>
                      </button>
                    )
                  })}
                  {dayTasks.map(task => (
                    <BoardTask key={task.id} task={task} companies={companies} projects={projects}
                      onComplete={onComplete} onEdit={onEdit}
                      onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingTask?.id === task.id} />
                  ))}
                  <button onClick={() => onAdd({ dueDate: day.date })}
                    className="w-full py-1.5 text-[11px] text-navy-400 hover:text-gold-600 border border-dashed border-surface-300 hover:border-gold-300 rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Plus size={11} /> Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

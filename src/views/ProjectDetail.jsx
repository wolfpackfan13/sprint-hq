import { useMemo } from 'react'
import { ArrowLeft, Plus, Calendar, Link2, Clock, CheckCircle2, Pencil, FolderKanban } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { ResourceLinks } from '../components/ResourceLinks'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'

export function ProjectDetail({
  project, company, tasks, goals,
  onBack, onAddTask, onEditProject, onUpdateProject,
  taskCardProps,
}) {
  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === project.id), [tasks, project.id])
  const openTasks = projectTasks.filter(t => t.status === 'todo')
  const doneTasks = projectTasks.filter(t => t.status === 'done')
  const goal = goals.find(g => g.id === project.goalId)

  const today = dateUtils.today()
  const overdue = openTasks.filter(t => t.dueDate && t.dueDate < today)
  const dueToday = openTasks.filter(t => t.dueDate === today)
  const upcoming = openTasks.filter(t => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const noDate = openTasks.filter(t => !t.dueDate)

  const pct = projectTasks.length ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0
  const totalTracked = projectTasks.reduce((s, t) => s + timeUtils.totalSeconds(t.timeEntries), 0)
  const color = company?.color || '#6B7280'

  const dueInfo = project.dueDate ? (() => {
    const overdueP = project.dueDate < today
    return { text: overdueP ? `${dateUtils.daysOverdue(project.dueDate)}d overdue` : dateUtils.format(project.dueDate, 'medium'), overdue: overdueP }
  })() : null

  const addToProject = () => onAddTask({ companyId: project.companyId, projectId: project.id, dueDate: today })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-navy-400 hover:text-navy-700 mb-3"><ArrowLeft size={13} /> Back to projects</button>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}><FolderKanban size={20} style={{ color }} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display font-bold text-navy-900 text-xl">{project.name}</h1>
              <button onClick={() => onEditProject(project)} className="p-1.5 text-navy-400 hover:text-gold-600 flex-shrink-0"><Pencil size={15} /></button>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {company && <span className="text-xs font-display font-semibold" style={{ color }}>{company.emoji} {company.name}</span>}
              {goal && <span className="text-xs text-gold-600">🎯 {goal.title}</span>}
              {dueInfo && <span className={`text-xs flex items-center gap-1 ${dueInfo.overdue ? 'text-red-500 font-medium' : 'text-navy-400'}`}><Calendar size={11} /> {dueInfo.text}</span>}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-navy-500">{doneTasks.length} of {projectTasks.length} tasks done</span>
            <div className="flex items-center gap-2">
              {totalTracked > 0 && <span className="text-xs text-navy-400 flex items-center gap-1"><Clock size={10} /> {timeUtils.formatDuration(totalTracked)}</span>}
              <span className="text-xs font-display font-bold" style={{ color }}>{pct}%</span>
            </div>
          </div>
          <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>

        {/* Add task */}
        <button onClick={addToProject} className="w-full mt-3 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"><Plus size={15} /> Add task to this project</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-2xl mx-auto w-full space-y-5">
        {/* Notes */}
        {project.notes && (
          <div className="card p-3">
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-navy-600 leading-relaxed whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}

        {/* Resources */}
        {(project.resources || []).length > 0 && (
          <div className="card p-3">
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2">Resources</p>
            <ResourceLinks resources={project.resources} onChange={(r) => onUpdateProject(project.id, { resources: r })} />
          </div>
        )}
        {(project.resources || []).length === 0 && (
          <div className="card p-3">
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Link2 size={11} /> Resources</p>
            <ResourceLinks resources={[]} onChange={(r) => onUpdateProject(project.id, { resources: r })} />
          </div>
        )}

        {/* Tasks */}
        {openTasks.length === 0 && doneTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle2 size={26} className="text-surface-400 mb-2" />
            <p className="font-display font-semibold text-navy-700">No tasks yet</p>
            <p className="text-navy-400 text-sm mt-0.5">Add the first task to get this project moving</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && <Section title="Overdue" color="#EF4444" tasks={overdue} taskCardProps={taskCardProps} />}
            {dueToday.length > 0 && <Section title="Due Today" color="#F4A825" tasks={dueToday} taskCardProps={taskCardProps} />}
            {upcoming.length > 0 && <Section title="Upcoming" color="#2D7A50" tasks={upcoming} taskCardProps={taskCardProps} />}
            {noDate.length > 0 && <Section title="No due date" color="#9BA5BB" tasks={noDate} taskCardProps={taskCardProps} />}
            {doneTasks.length > 0 && <Section title="Completed" color="#9BA5BB" tasks={doneTasks} taskCardProps={taskCardProps} dim />}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, color, tasks, taskCardProps, dim }) {
  return (
    <div className={dim ? 'opacity-70' : ''}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{title} ({tasks.length})</p>
      <div className="space-y-2">{tasks.map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)}</div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { ArrowLeft, Plus, FolderKanban, Clipboard, CheckCircle2, Clock, FileText, Calendar, ChevronRight, AlertTriangle, Link2 } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'

// Build a unified, dated activity feed for one client
function buildTimeline(company, { tasks, meetings, projects }) {
  const items = []

  // Completed tasks
  tasks.filter(t => t.companyId === company.id && t.status === 'done' && t.completedAt).forEach(t => {
    items.push({ type: 'task_done', date: t.completedAt.split('T')[0], ts: t.completedAt, title: t.title, projectId: t.projectId })
  })
  // Meetings
  meetings.filter(m => m.companyId === company.id).forEach(m => {
    items.push({ type: 'meeting', date: m.date, ts: m.date + 'T12:00:00', title: m.title, notes: m.notes, actionCount: (m.actionItems || []).length, projectId: m.projectId })
  })
  // Projects created / completed
  projects.filter(p => p.companyId === company.id).forEach(p => {
    if (p.status === 'done') items.push({ type: 'project_done', date: (p.createdAt || dateUtils.today()).split('T')[0], ts: p.createdAt || '', title: p.name })
  })

  return items.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
}

function lastActivityDate(timeline, tasks, company) {
  const dates = []
  if (timeline.length) dates.push(timeline[0].date)
  // also count any recent task creation/edit
  const clientTasks = tasks.filter(t => t.companyId === company.id)
  clientTasks.forEach(t => { if (t.createdAt) dates.push(t.createdAt.split('T')[0]) })
  if (!dates.length) return null
  return dates.sort().reverse()[0]
}

export function ClientCockpit({
  company, tasks, projects, meetings,
  companies, allProjects,
  onBack, onAddTask, onAddProject, onAddMeeting, onOpenProject,
  taskCardProps,
}) {
  const [tab, setTab] = useState('next') // next | timeline | projects | meetings

  const clientTasks = useMemo(() => tasks.filter(t => t.companyId === company.id), [tasks, company.id])
  const openTasks = clientTasks.filter(t => t.status === 'todo')
  const clientProjects = useMemo(() => projects.filter(p => p.companyId === company.id && p.status === 'active'), [projects, company.id])
  const clientMeetings = useMemo(() => meetings.filter(m => m.companyId === company.id).sort((a, b) => b.date.localeCompare(a.date)), [meetings, company.id])
  const timeline = useMemo(() => buildTimeline(company, { tasks, meetings, projects }), [company, tasks, meetings, projects])

  // Open action items from meetings not yet turned into tasks
  const openActionItems = clientMeetings.flatMap(m => (m.actionItems || []).filter(ai => !ai.done && !ai.taskId).map(ai => ({ ...ai, meetingTitle: m.title })))

  const today = dateUtils.today()
  const overdue = openTasks.filter(t => t.dueDate && t.dueDate < today)
  const dueToday = openTasks.filter(t => t.dueDate === today)
  const upcoming = openTasks.filter(t => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const noDate = openTasks.filter(t => !t.dueDate)

  const lastActivity = lastActivityDate(timeline, tasks, company)
  const daysSince = lastActivity ? dateUtils.daysOverdue(lastActivity) : null
  const isStale = daysSince !== null && daysSince > 14

  const totalTracked = clientTasks.reduce((s, t) => s + timeUtils.totalSeconds(t.timeEntries), 0)

  const tabs = [
    { id: 'next', label: "What's Next" },
    { id: 'timeline', label: 'Timeline' },
    { id: 'projects', label: `Projects (${clientProjects.length})` },
    { id: 'meetings', label: `Meetings (${clientMeetings.length})` },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0 max-w-3xl mx-auto w-full">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-navy-400 hover:text-navy-700 mb-3"><ArrowLeft size={13} /> All clients</button>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl" style={{ backgroundColor: `${company.color}18` }}>{company.emoji}</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-navy-900 text-xl" style={{ color: company.color }}>{company.name}</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className={`text-xs ${isStale ? 'text-red-500 font-medium' : 'text-navy-500'}`}>
                {lastActivity ? `Last activity ${daysSince === 0 ? 'today' : `${daysSince}d ago`}` : 'No activity yet'}
                {isStale && ' — needs attention'}
              </span>
              {company.billable && totalTracked > 0 && <span className="text-xs text-navy-400">· {timeUtils.formatDuration(totalTracked)} tracked</span>}
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 card py-2 px-3 text-center">
            <p className="font-display font-bold text-lg text-navy-900">{openTasks.length}</p>
            <p className="text-[10px] text-navy-500">open tasks</p>
          </div>
          <div className="flex-1 card py-2 px-3 text-center">
            <p className="font-display font-bold text-lg" style={{ color: overdue.length ? '#EF4444' : '#0D1526' }}>{overdue.length}</p>
            <p className="text-[10px] text-navy-500">overdue</p>
          </div>
          <div className="flex-1 card py-2 px-3 text-center">
            <p className="font-display font-bold text-lg text-navy-900">{clientProjects.length}</p>
            <p className="text-[10px] text-navy-500">projects</p>
          </div>
          <div className="flex-1 card py-2 px-3 text-center">
            <p className="font-display font-bold text-lg" style={{ color: openActionItems.length ? '#F4A825' : '#0D1526' }}>{openActionItems.length}</p>
            <p className="text-[10px] text-navy-500">action items</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`text-xs font-display font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${tab === t.id ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-surface-100'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-3xl mx-auto w-full">
        {tab === 'next' && (
          <div className="space-y-5">
            {/* Quick add */}
            <div className="flex gap-2">
              <button onClick={() => onAddTask({ companyId: company.id, dueDate: today })} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"><Plus size={14} /> Task</button>
              <button onClick={() => onAddProject({ companyId: company.id })} className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-1.5"><FolderKanban size={14} /> Project</button>
              <button onClick={() => onAddMeeting({ companyId: company.id })} className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-1.5"><Clipboard size={14} /> Meeting</button>
            </div>

            {/* Open action items from meetings */}
            {openActionItems.length > 0 && (
              <div className="card p-3 border-gold-200 bg-gold-50">
                <p className="text-xs font-display font-bold text-gold-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Loose action items</p>
                <div className="space-y-1">
                  {openActionItems.map(ai => (
                    <div key={ai.id} className="flex items-center gap-2 text-sm text-navy-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                      <span className="flex-1">{ai.title}</span>
                      <span className="text-[10px] text-navy-400">{ai.meetingTitle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {overdue.length > 0 && <Section title="Overdue" color="#EF4444" tasks={overdue} taskCardProps={taskCardProps} />}
            {dueToday.length > 0 && <Section title="Due Today" color="#F4A825" tasks={dueToday} taskCardProps={taskCardProps} />}
            {upcoming.length > 0 && <Section title="Upcoming" color="#2D7A50" tasks={upcoming} taskCardProps={taskCardProps} />}
            {noDate.length > 0 && <Section title="No due date" color="#9BA5BB" tasks={noDate} taskCardProps={taskCardProps} />}

            {openTasks.length === 0 && openActionItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <CheckCircle2 size={28} className="text-forest-400 mb-2" />
                <p className="font-display font-semibold text-navy-700">All clear here</p>
                <p className="text-navy-400 text-sm mt-1">No open tasks for {company.name}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div className="space-y-2">
            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <FileText size={28} className="text-surface-400 mb-2" />
                <p className="font-display font-semibold text-navy-700">No history yet</p>
                <p className="text-navy-400 text-sm mt-1">Completed tasks and meetings will show here</p>
              </div>
            ) : timeline.map((item, i) => <TimelineRow key={i} item={item} allProjects={allProjects} />)}
          </div>
        )}

        {tab === 'projects' && (
          <div className="space-y-2">
            <button onClick={() => onAddProject({ companyId: company.id })} className="w-full btn-ghost py-2.5 text-sm flex items-center justify-center gap-1.5"><Plus size={14} /> New project</button>
            {clientProjects.length === 0 ? (
              <p className="text-sm text-navy-400 text-center py-8">No active projects</p>
            ) : clientProjects.map(p => {
              const pt = tasks.filter(t => t.projectId === p.id)
              const done = pt.filter(t => t.status === 'done').length
              const pct = pt.length ? Math.round((done / pt.length) * 100) : 0
              return (
                <button key={p.id} onClick={() => onOpenProject(p)} className="card p-3 w-full text-left card-hover">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.color}15` }}><FolderKanban size={14} style={{ color: company.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-navy-900 text-sm">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: company.color }} /></div>
                        <span className="text-[11px] text-navy-400">{done}/{pt.length}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-navy-300 flex-shrink-0" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {tab === 'meetings' && (
          <div className="space-y-2">
            <button onClick={() => onAddMeeting({ companyId: company.id })} className="w-full btn-ghost py-2.5 text-sm flex items-center justify-center gap-1.5"><Plus size={14} /> Log meeting</button>
            {clientMeetings.length === 0 ? (
              <p className="text-sm text-navy-400 text-center py-8">No meetings logged</p>
            ) : clientMeetings.map(m => (
              <div key={m.id} className="card p-3">
                <div className="flex items-start gap-2">
                  <Clipboard size={14} className="text-navy-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-navy-900 text-sm">{m.title}</p>
                    <p className="text-[11px] text-navy-400">{dateUtils.format(m.date, 'medium')}{(m.actionItems || []).length > 0 && ` · ${m.actionItems.length} action items`}</p>
                    {m.notes && <p className="text-xs text-navy-500 mt-1 line-clamp-2">{m.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, color, tasks, taskCardProps }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{title} ({tasks.length})</p>
      <div className="space-y-2">{tasks.map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)}</div>
    </div>
  )
}

function TimelineRow({ item, allProjects }) {
  const proj = item.projectId ? allProjects.find(p => p.id === item.projectId) : null
  const config = {
    task_done: { icon: CheckCircle2, color: '#2D7A50', label: 'Completed' },
    meeting: { icon: Clipboard, color: '#3B82F6', label: 'Meeting' },
    project_done: { icon: FolderKanban, color: '#8B5CF6', label: 'Project closed' },
  }[item.type] || { icon: FileText, color: '#9BA5BB', label: '' }
  const Icon = config.icon
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}><Icon size={13} style={{ color: config.color }} /></div>
        <div className="w-px flex-1 bg-surface-300 my-1" />
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: config.color }}>{config.label}</span>
          <span className="text-[10px] text-navy-400">{dateUtils.format(item.date, 'medium')}</span>
        </div>
        <p className="text-sm text-navy-700 mt-0.5">{item.title}</p>
        {proj && <p className="text-[11px] text-navy-400">{proj.name}</p>}
        {item.notes && <p className="text-xs text-navy-500 mt-1 line-clamp-2">{item.notes}</p>}
        {item.actionCount > 0 && <p className="text-[11px] text-gold-600 mt-0.5">{item.actionCount} action items</p>}
      </div>
    </div>
  )
}

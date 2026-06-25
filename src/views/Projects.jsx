import { useState } from 'react'
import { Plus, FolderKanban, ChevronDown, ChevronUp, Pencil, Trash2, X, CheckCircle2, Calendar, Link2 } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { ResourceLinks } from '../components/ResourceLinks'
import { dateUtils } from '../utils/dateUtils'

function ProjectForm({ project, companies, goals, defaultCompanyId, onSave, onClose }) {
  const [name, setName] = useState(project?.name || '')
  const [companyId, setCompanyId] = useState(project?.companyId || defaultCompanyId || null)
  const [goalId, setGoalId] = useState(project?.goalId || null)
  const [dueDate, setDueDate] = useState(project?.dueDate || '')
  const [resources, setResources] = useState(project?.resources || [])

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white">
          <h2 className="font-display font-bold text-navy-900">{project?.id ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name *" autoFocus className="w-full input-base px-4 py-2.5 text-sm font-medium" />

          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Client</p>
            <div className="flex flex-wrap gap-2">
              {companies.map(co => (
                <button key={co.id} onClick={() => setCompanyId(co.id)}
                  className="flex items-center gap-1 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all"
                  style={companyId === co.id ? { backgroundColor: co.color, borderColor: co.color, color: '#fff' } : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }}>
                  {co.emoji} {co.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Calendar size={12} /> Target / Due Date</p>
            <div className="flex items-center gap-2">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-base px-3 py-2 text-sm" />
              {dueDate && <button onClick={() => setDueDate('')} className="text-xs text-navy-400 hover:text-red-400">Clear</button>}
            </div>
          </div>

          {goals.filter(g => g.status === 'active').length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Link to Goal (optional)</p>
              <div className="flex flex-wrap gap-2">
                {goals.filter(g => g.status === 'active').map(g => (
                  <button key={g.id} onClick={() => setGoalId(goalId === g.id ? null : g.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${goalId === g.id ? 'bg-gold-500 border-gold-500 text-navy-900' : 'border-surface-300 text-navy-500 hover:border-gold-400'}`}>
                    🎯 {g.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          <div className="border-t border-surface-200 pt-4">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Link2 size={12} /> Links & Resources</p>
            <ResourceLinks resources={resources} onChange={setResources} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
            <button onClick={() => name.trim() && companyId && onSave({ ...(project?.id ? { id: project.id } : {}), name: name.trim(), companyId, goalId, dueDate: dueDate || null, resources })}
              disabled={!name.trim() || !companyId} className="flex-1 py-2.5 btn-primary text-sm">{project?.id ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Projects({
  projects, companies, goals, activeClient, tasksForProject,
  onAddProject, onUpdateProject, onDeleteProject, taskCardProps, onOpenProject,
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [formCompany, setFormCompany] = useState(null)

  const visibleCompanies = activeClient ? companies.filter(c => c.id === activeClient) : companies
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const handleSave = (data) => {
    if (data.id) onUpdateProject(data.id, data)
    else onAddProject(data)
    setShowForm(false); setEditingProject(null); setFormCompany(null)
  }

  const projectProgress = (projectId) => {
    const tasks = tasksForProject(projectId)
    if (tasks.length === 0) return { pct: 0, done: 0, total: 0 }
    const done = tasks.filter(t => t.status === 'done').length
    return { pct: Math.round((done / tasks.length) * 100), done, total: tasks.length }
  }

  const dueLabel = (dueDate) => {
    if (!dueDate) return null
    const days = -dateUtils.daysOverdue(dueDate) || Math.ceil((new Date(dueDate + 'T12:00:00') - new Date()) / 86400000)
    const overdue = dueDate < dateUtils.today()
    return { text: overdue ? `${dateUtils.daysOverdue(dueDate)}d overdue` : dateUtils.format(dueDate, 'short'), overdue }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4">
        <div className="pt-5 pb-3 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Projects</h1>
            <p className="text-navy-500 text-sm mt-0.5">{projects.filter(p => p.status === 'active').length} active</p>
          </div>
          <button onClick={() => { setFormCompany(activeClient); setShowForm(true) }} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"><Plus size={15} /> New</button>
        </div>

        <div className="pb-4 space-y-5">
          {visibleCompanies.map(co => {
            const coProjects = projects.filter(p => p.companyId === co.id && p.status === 'active')
            if (coProjects.length === 0 && !activeClient) return null
            return (
              <div key={co.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: co.color }}>{co.emoji} {co.name}</span>
                  <button onClick={() => { setFormCompany(co.id); setShowForm(true) }} className="text-xs text-navy-400 hover:text-gold-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                </div>
                {coProjects.length === 0 ? (
                  <button onClick={() => { setFormCompany(co.id); setShowForm(true) }} className="w-full py-2.5 text-xs text-navy-400 hover:text-navy-600 border border-dashed border-surface-300 rounded-xl transition-colors">+ First project for {co.name}</button>
                ) : (
                  <div className="space-y-2">
                    {coProjects.map(p => {
                      const prog = projectProgress(p.id)
                      const goal = goals.find(g => g.id === p.goalId)
                      const isOpen = expanded[p.id]
                      const projTasks = tasksForProject(p.id)
                      const due = dueLabel(p.dueDate)
                      return (
                        <div key={p.id} className="card overflow-hidden">
                          <div className="p-3 cursor-pointer card-hover" onClick={() => onOpenProject ? onOpenProject(p) : toggle(p.id)}>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${co.color}15` }}>
                                <FolderKanban size={15} style={{ color: co.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-display font-semibold text-navy-900 text-sm">{p.name}</p>
                                  <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => { setEditingProject(p); setShowForm(true) }} className="p-1 text-navy-400 hover:text-gold-600"><Pencil size={12} /></button>
                                    <button onClick={() => onUpdateProject(p.id, { status: 'done' })} className="p-1 text-navy-400 hover:text-forest-500"><CheckCircle2 size={12} /></button>
                                    <button onClick={() => onDeleteProject(p.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={12} /></button>
                                    <button onClick={() => toggle(p.id)} className="p-1 text-navy-400">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {goal && <span className="text-[11px] text-gold-600">🎯 {goal.title}</span>}
                                  {due && (
                                    <span className={`text-[11px] flex items-center gap-0.5 ${due.overdue ? 'text-red-500' : 'text-navy-400'}`}>
                                      <Calendar size={9} /> {due.text}
                                    </span>
                                  )}
                                  {(p.resources||[]).length > 0 && <span className="text-[11px] text-blue-500 flex items-center gap-0.5"><Link2 size={9} /> {p.resources.length}</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, backgroundColor: co.color }} />
                                  </div>
                                  <span className="text-[11px] font-medium text-navy-400">{prog.done}/{prog.total}</span>
                                </div>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="mt-3 pt-3 border-t border-surface-200 space-y-3" onClick={(e) => e.stopPropagation()}>
                                {p.notes && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Notes</p>
                                    <p className="text-sm text-navy-600 leading-relaxed whitespace-pre-wrap">{p.notes}</p>
                                  </div>
                                )}
                                {(p.resources||[]).length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Resources</p>
                                    <ResourceLinks resources={p.resources} />
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {projTasks.length === 0 ? (
                                    <p className="text-xs text-navy-400 text-center py-2">No tasks yet — add tasks and assign this project</p>
                                  ) : projTasks.map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <ProjectForm project={editingProject} companies={companies} goals={goals} defaultCompanyId={formCompany}
          onSave={handleSave} onClose={() => { setShowForm(false); setEditingProject(null); setFormCompany(null) }} />
      )}
    </div>
  )
}

import { useState } from 'react'
import { Plus, FolderKanban, ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Archive, CheckCircle2 } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'

function ProjectForm({ project, companies, goals, defaultCompanyId, onSave, onClose }) {
  const [name, setName] = useState(project?.name || '')
  const [companyId, setCompanyId] = useState(project?.companyId || defaultCompanyId || null)
  const [goalId, setGoalId] = useState(project?.goalId || null)

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display font-bold text-navy-900">{project?.id ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
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
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
            <button onClick={() => name.trim() && companyId && onSave({ ...(project?.id ? { id: project.id } : {}), name: name.trim(), companyId, goalId })}
              disabled={!name.trim() || !companyId} className="flex-1 py-2.5 btn-primary text-sm">{project?.id ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Projects({
  projects, companies, goals, activeClient, tasksForProject,
  onAddProject, onUpdateProject, onDeleteProject,
  taskCardProps,
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

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">Projects</h1>
          <p className="text-navy-500 text-sm mt-0.5">{projects.filter(p => p.status === 'active').length} active</p>
        </div>
        <button onClick={() => { setFormCompany(activeClient); setShowForm(true) }} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"><Plus size={15} /> New</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        {visibleCompanies.map(co => {
          const coProjects = projects.filter(p => p.companyId === co.id && p.status === 'active')
          if (coProjects.length === 0 && activeClient !== co.id && !activeClient) return null
          return (
            <div key={co.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-display font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: co.color }}>
                  {co.emoji} {co.name}
                </span>
                <button onClick={() => { setFormCompany(co.id); setShowForm(true) }} className="text-xs text-navy-400 hover:text-gold-600 flex items-center gap-1"><Plus size={12} /> Add</button>
              </div>
              {coProjects.length === 0 ? (
                <button onClick={() => { setFormCompany(co.id); setShowForm(true) }} className="w-full py-2.5 text-xs text-navy-400 hover:text-navy-600 border border-dashed border-surface-300 rounded-xl transition-colors">
                  + First project for {co.name}
                </button>
              ) : (
                <div className="space-y-2">
                  {coProjects.map(p => {
                    const prog = projectProgress(p.id)
                    const goal = goals.find(g => g.id === p.goalId)
                    const isOpen = expanded[p.id]
                    const projTasks = tasksForProject(p.id)
                    return (
                      <div key={p.id} className="card overflow-hidden">
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${co.color}15` }}>
                              <FolderKanban size={15} style={{ color: co.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <button onClick={() => toggle(p.id)} className="text-left">
                                  <p className="font-display font-semibold text-navy-900 text-sm">{p.name}</p>
                                </button>
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <button onClick={() => { setEditingProject(p); setShowForm(true) }} className="p-1 text-navy-400 hover:text-gold-600"><Pencil size={12} /></button>
                                  <button onClick={() => onUpdateProject(p.id, { status: 'done' })} className="p-1 text-navy-400 hover:text-forest-500" title="Mark complete"><CheckCircle2 size={12} /></button>
                                  <button onClick={() => onDeleteProject(p.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={12} /></button>
                                  <button onClick={() => toggle(p.id)} className="p-1 text-navy-400">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                                </div>
                              </div>
                              {goal && <p className="text-[11px] text-gold-600 mt-0.5">🎯 {goal.title}</p>}
                              {/* Progress bar */}
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, backgroundColor: co.color }} />
                                </div>
                                <span className="text-[11px] font-medium text-navy-400">{prog.done}/{prog.total}</span>
                              </div>
                            </div>
                          </div>
                          {/* Expanded task list */}
                          {isOpen && (
                            <div className="mt-3 pt-3 border-t border-surface-200 space-y-2">
                              {projTasks.length === 0 ? (
                                <p className="text-xs text-navy-400 text-center py-2">No tasks yet — add tasks and assign this project</p>
                              ) : (
                                projTasks.map(t => <TaskCard key={t.id} task={t} {...taskCardProps} showDate />)
                              )}
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

      {showForm && (
        <ProjectForm project={editingProject} companies={companies} goals={goals} defaultCompanyId={formCompany}
          onSave={handleSave} onClose={() => { setShowForm(false); setEditingProject(null); setFormCompany(null) }} />
      )}
    </div>
  )
}

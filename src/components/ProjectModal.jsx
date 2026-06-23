import { useState } from 'react'
import { X, Calendar, Link2 } from 'lucide-react'
import { ResourceLinks } from './ResourceLinks'

export function ProjectModal({ project, companies, goals, defaultCompanyId, onSave, onClose }) {
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

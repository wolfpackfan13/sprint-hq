import { useState, useEffect, useRef } from 'react'
import { X, Flag, Tag, Calendar, AlignLeft, FolderKanban, ListChecks, Link2, Sparkles } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { SubtaskEditor } from './SubtaskEditor'
import { ResourceLinks } from './ResourceLinks'
import { TimeLogEditor } from './TimeLogEditor'

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'medium', label: 'Medium', color: '#F4A825' },
  { value: 'low', label: 'Low', color: '#9BA5BB' },
]

const SHORTCUTS = [
  { label: 'Today', fn: () => dateUtils.today() },
  { label: 'Tomorrow', fn: () => dateUtils.addDays(1) },
  { label: 'This Fri', fn: () => { const d = new Date(); const diff = (5 - d.getDay() + 7) % 7 || 7; return dateUtils.addDays(diff) } },
]

export function TaskModal({
  task, companies = [], projects = [], onSave, onClose,
  onBreakdown, timeHandlers,
}) {
  const [title, setTitle] = useState(task?.title || '')
  const [notes, setNotes] = useState(task?.notes || '')
  const [dueDate, setDueDate] = useState(task?.dueDate || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [companyId, setCompanyId] = useState(task?.companyId || null)
  const [projectId, setProjectId] = useState(task?.projectId || null)
  const [subtasks, setSubtasksState] = useState(task?.subtasks || [])
  const [resources, setResourcesState] = useState(task?.resources || [])
  const titleRef = useRef(null)
  const isEdit = !!task?.id

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const companyProjects = projects.filter(p => p.companyId === companyId && p.status === 'active')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ ...(task?.id ? { id: task.id } : {}), title: title.trim(), notes: notes.trim(), dueDate: dueDate || null, priority, companyId, projectId, subtasks, resources })
  }

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-modal max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white z-10">
          <h2 className="font-display font-bold text-navy-900">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700 rounded-lg hover:bg-surface-100"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <input ref={titleRef} type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="What needs to get done?" className="w-full input-base px-4 py-3 text-sm font-medium" />
          <div className="relative">
            <AlignLeft size={13} className="absolute left-3.5 top-3 text-navy-400 pointer-events-none" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes or context..." rows={2}
              className="w-full input-base pl-9 pr-4 py-2.5 text-sm resize-none" />
          </div>

          {/* Client */}
          {companies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Tag size={12} /> Client</p>
              <div className="flex flex-wrap gap-2">
                {companies.map(co => (
                  <button key={co.id} onClick={() => { setCompanyId(companyId === co.id ? null : co.id); setProjectId(null) }}
                    className="flex items-center gap-1 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all"
                    style={companyId === co.id ? { backgroundColor: co.color, borderColor: co.color, color: '#fff' } : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }}>
                    {co.emoji} {co.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Project */}
          {companyId && companyProjects.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FolderKanban size={12} /> Project</p>
              <div className="flex flex-wrap gap-2">
                {companyProjects.map(p => (
                  <button key={p.id} onClick={() => setProjectId(projectId === p.id ? null : p.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${projectId === p.id ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500 hover:border-navy-400'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Due date */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Calendar size={12} /> Due Date</p>
            <div className="flex flex-wrap gap-2">
              {SHORTCUTS.map(s => (
                <button key={s.label} onClick={() => setDueDate(s.fn())}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${dueDate === s.fn() ? 'bg-gold-500 border-gold-500 text-navy-900' : 'border-surface-300 text-navy-500 hover:border-gold-400'}`}>
                  {s.label}
                </button>
              ))}
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-base px-2.5 py-1.5 text-xs" />
              {dueDate && <button onClick={() => setDueDate('')} className="text-xs text-navy-400 hover:text-red-400">Clear</button>}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Flag size={12} /> Priority</p>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${priority === p.value ? 'text-white' : 'border-surface-300 text-navy-500 hover:border-surface-400'}`}
                  style={priority === p.value ? { backgroundColor: p.color, borderColor: p.color } : {}}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div className="border-t border-surface-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5"><ListChecks size={12} /> Subtasks</p>
              {onBreakdown && title.trim() && (
                <button onClick={() => onBreakdown({ id: task?.id, title: title.trim(), notes })} className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700">
                  <Sparkles size={11} /> AI break down
                </button>
              )}
            </div>
            <SubtaskEditor subtasks={subtasks} onChange={setSubtasksState} />
          </div>

          {/* Resources */}
          <div className="border-t border-surface-200 pt-4">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Link2 size={12} /> Links & Resources</p>
            <ResourceLinks resources={resources} onChange={setResourcesState} />
          </div>

          {/* Time log — only when editing existing task */}
          {isEdit && timeHandlers && (
            <div className="border-t border-surface-200 pt-4">
              <TimeLogEditor
                timeEntries={task.timeEntries || []}
                onAdd={(secs, date) => timeHandlers.add(task.id, secs, date)}
                onUpdate={(eid, secs) => timeHandlers.update(task.id, eid, secs)}
                onDelete={(eid) => timeHandlers.remove(task.id, eid)}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={!title.trim()} className="flex-1 py-3 btn-primary text-sm">{isEdit ? 'Save' : 'Add Task'}</button>
          </div>
          <p className="text-center text-[10px] text-navy-400">⌘↵ to save · Esc to close</p>
        </div>
      </div>
    </div>
  )
}

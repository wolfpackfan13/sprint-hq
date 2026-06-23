import { useState, useEffect, useRef } from 'react'
import { X, Flag, Tag, Calendar, AlignLeft } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

const PROJECT_PRESETS = [
  { name: 'Refuge Homes', color: '#2D7A50' },
  { name: 'Flip Projects', color: '#F4A825' },
  { name: 'Content/Brand', color: '#3B82F6' },
  { name: 'Personal', color: '#8B5CF6' },
  { name: 'Family', color: '#EC4899' },
  { name: 'Admin', color: '#6B7280' },
]

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'medium', label: 'Medium', color: '#F4A825' },
  { value: 'low', label: 'Low', color: '#576282' },
]

const DATE_SHORTCUTS = [
  { label: 'Today', value: () => dateUtils.today() },
  { label: 'Tomorrow', value: () => dateUtils.addDays(1) },
  { label: 'This Fri', value: () => {
    const d = new Date()
    const diff = (5 - d.getDay() + 7) % 7 || 7
    return dateUtils.addDays(diff)
  }},
]

export function TaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task?.title || '')
  const [notes, setNotes] = useState(task?.notes || '')
  const [dueDate, setDueDate] = useState(task?.dueDate || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [project, setProject] = useState(task?.project || '')
  const [projectColor, setProjectColor] = useState(task?.projectColor || '')
  const [customProject, setCustomProject] = useState('')
  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Keyboard shortcut: Cmd/Ctrl+Enter to save
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [title, notes, dueDate, priority, project, projectColor])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      ...(task?.id ? { id: task.id } : {}),
      title: title.trim(),
      notes: notes.trim(),
      dueDate: dueDate || null,
      priority,
      project: project || null,
      projectColor: projectColor || null,
    })
  }

  const selectProject = (p) => {
    setProject(p.name)
    setProjectColor(p.color)
  }

  const clearProject = () => {
    setProject('')
    setProjectColor('')
  }

  const isEdit = !!task?.id

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-navy-800 border border-navy-600 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display font-semibold text-white text-base">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-white transition-colors rounded-lg hover:bg-navy-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && document.querySelector('[data-notes]')?.focus()}
              placeholder="What needs to get done?"
              className="w-full bg-navy-900 border border-navy-600 rounded-xl px-4 py-3 text-white placeholder-navy-500 text-sm font-medium focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="relative">
            <AlignLeft size={14} className="absolute left-3.5 top-3 text-navy-500 pointer-events-none" />
            <textarea
              data-notes
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes or context..."
              rows={2}
              className="w-full bg-navy-900 border border-navy-600 rounded-xl pl-9 pr-4 py-3 text-white placeholder-navy-500 text-sm focus:outline-none focus:border-gold-500 transition-colors resize-none"
            />
          </div>

          {/* Due date */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-navy-400" />
              <span className="text-xs font-medium text-navy-400 uppercase tracking-wide">Due Date</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DATE_SHORTCUTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => setDueDate(s.value())}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    dueDate === s.value()
                      ? 'bg-gold-500 border-gold-500 text-navy-900'
                      : 'bg-navy-900 border-navy-600 text-navy-300 hover:border-gold-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="text-xs bg-navy-900 border border-navy-600 rounded-lg px-2 py-1.5 text-navy-300 focus:outline-none focus:border-gold-500 transition-colors"
              />
              {dueDate && (
                <button onClick={() => setDueDate('')} className="text-xs text-navy-500 hover:text-red-400 transition-colors px-1">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flag size={13} className="text-navy-400" />
              <span className="text-xs font-medium text-navy-400 uppercase tracking-wide">Priority</span>
            </div>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    priority === p.value
                      ? 'border-transparent text-navy-900'
                      : 'bg-navy-900 border-navy-600 text-navy-300 hover:border-navy-500'
                  }`}
                  style={priority === p.value ? { backgroundColor: p.color, borderColor: p.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-navy-400" />
                <span className="text-xs font-medium text-navy-400 uppercase tracking-wide">Project</span>
              </div>
              {project && (
                <button onClick={clearProject} className="text-xs text-navy-500 hover:text-red-400 transition-colors">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => project === p.name ? clearProject() : selectProject(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    project === p.name ? 'text-white' : 'text-navy-300 hover:text-white'
                  }`}
                  style={project === p.name
                    ? { backgroundColor: `${p.color}33`, borderColor: p.color, color: p.color }
                    : { backgroundColor: '#141B2D', borderColor: '#2D3C57' }
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
            {/* Custom project input */}
            <input
              type="text"
              value={project && !PROJECT_PRESETS.find(p => p.name === project) ? project : customProject}
              onChange={e => {
                setCustomProject(e.target.value)
                setProject(e.target.value)
                setProjectColor('#7B8AB0')
              }}
              placeholder="Or type custom..."
              className="mt-2 w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white placeholder-navy-600 text-xs focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-navy-600 text-navy-300 text-sm font-medium hover:bg-navy-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className={`flex-1 py-3 rounded-xl text-sm font-display font-semibold transition-all ${
                title.trim()
                  ? 'bg-gold-500 text-navy-900 hover:bg-gold-400 active:scale-95'
                  : 'bg-navy-700 text-navy-500 cursor-not-allowed'
              }`}
            >
              {isEdit ? 'Save Changes' : 'Add Task'}
            </button>
          </div>

          <p className="text-center text-[11px] text-navy-600">⌘↵ to save · Esc to close</p>
        </div>
      </div>
    </div>
  )
}

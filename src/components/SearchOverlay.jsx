import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, CheckSquare, FolderKanban, Clipboard, Building2, FileText, CornerDownLeft } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function SearchOverlay({ tasks, projects, meetings, companies, notes, onClose, onGoto }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return null
    const match = (s) => (s || '').toLowerCase().includes(term)

    const co = (id) => companies.find(c => c.id === id)

    return {
      tasks: tasks.filter(t => match(t.title) || match(t.notes)).slice(0, 8),
      projects: projects.filter(p => match(p.name) || match(p.notes)).slice(0, 6),
      meetings: meetings.filter(m => match(m.title) || match(m.notes)).slice(0, 6),
      clients: companies.filter(c => match(c.name)).slice(0, 6),
      notes: (notes || []).filter(n => match(n.content)).slice(0, 6),
      coLookup: co,
    }
  }, [q, tasks, projects, meetings, companies, notes])

  const totalCount = results ? results.tasks.length + results.projects.length + results.meetings.length + results.clients.length + results.notes.length : 0

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-[70] flex items-start justify-center pt-[10vh] px-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[75vh] flex flex-col overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 flex-shrink-0">
          <Search size={18} className="text-navy-400 flex-shrink-0" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks, projects, meetings, clients, notes..."
            className="flex-1 bg-transparent text-sm text-navy-900 placeholder-navy-400 focus:outline-none" />
          <button onClick={onClose} className="p-1 text-navy-400 hover:text-navy-700 flex-shrink-0"><X size={16} /></button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!q.trim() && (
            <div className="px-4 py-10 text-center text-navy-400 text-sm">Type to search across everything</div>
          )}
          {q.trim() && totalCount === 0 && (
            <div className="px-4 py-10 text-center text-navy-400 text-sm">No matches for "{q}"</div>
          )}
          {results && totalCount > 0 && (
            <div className="py-2">
              <Group label="Tasks" icon={CheckSquare} items={results.tasks} render={t => {
                const c = results.coLookup(t.companyId)
                return <><span className={t.status === 'done' ? 'line-through text-navy-400' : ''}>{t.title}</span>{c && <Tag co={c} />}{t.dueDate && <span className="text-[11px] text-navy-400 ml-auto">{dateUtils.format(t.dueDate, 'short')}</span>}</>
              }} onPick={t => onGoto({ type: 'task', item: t })} />

              <Group label="Projects" icon={FolderKanban} items={results.projects} render={p => {
                const c = results.coLookup(p.companyId)
                return <>{p.name}{c && <Tag co={c} />}</>
              }} onPick={p => onGoto({ type: 'project', item: p })} />

              <Group label="Clients & Areas" icon={Building2} items={results.clients} render={c => <>{c.emoji} {c.name}</>} onPick={c => onGoto({ type: 'client', item: c })} />

              <Group label="Meetings" icon={Clipboard} items={results.meetings} render={m => <>{m.title}<span className="text-[11px] text-navy-400 ml-auto">{m.date ? dateUtils.format(m.date, 'short') : ''}</span></>} onPick={m => onGoto({ type: 'meeting', item: m })} />

              <Group label="Notes" icon={FileText} items={results.notes} render={n => <span className="truncate">{n.content}</span>} onPick={n => onGoto({ type: 'note', item: n })} />
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-surface-200 flex items-center gap-2 text-[11px] text-navy-400 flex-shrink-0">
          <CornerDownLeft size={11} /> Click a result to jump to it · Esc to close
        </div>
      </div>
    </div>
  )
}

function Tag({ co }) {
  return <span className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded ml-2" style={{ backgroundColor: `${co.color}15`, color: co.color }}>{co.emoji} {co.name}</span>
}

function Group({ label, icon: Icon, items, render, onPick }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mb-1">
      <div className="px-4 py-1 flex items-center gap-1.5">
        <Icon size={11} className="text-navy-400" />
        <span className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">{label}</span>
      </div>
      {items.map((item, i) => (
        <button key={i} onClick={() => onPick(item)} className="w-full flex items-center gap-1.5 px-4 py-2 text-sm text-navy-700 hover:bg-surface-100 text-left">
          {render(item)}
        </button>
      ))}
    </div>
  )
}

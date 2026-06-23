import { useState, useRef } from 'react'
import { Pin, Trash2, Send, FileText } from 'lucide-react'

function fmt(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), day = Math.floor(diff/86400000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
}

export function Notes({ notes, onAdd, onDelete, onTogglePin }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const submit = (e) => { e?.preventDefault(); if (!text.trim()) return; onAdd(text); setText(''); ref.current?.focus() }
  const pinned = notes.filter(n => n.pinned), unpinned = notes.filter(n => !n.pinned)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <h1 className="font-display font-bold text-navy-900 text-xl">Notes</h1>
        <p className="text-navy-500 text-sm mt-0.5">Brain dump — capture anything</p>
      </div>
      <div className="px-4 pb-3 flex-shrink-0">
        <form onSubmit={submit}>
          <div className="bg-white border border-surface-300 rounded-xl overflow-hidden focus-within:border-gold-400 transition-colors">
            <textarea ref={ref} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => (e.metaKey||e.ctrlKey) && e.key==='Enter' && submit()}
              placeholder="What's on your mind? (⌘↵ to save)" rows={3}
              className="w-full bg-transparent px-4 pt-3 pb-2 text-sm text-navy-900 placeholder-navy-400 focus:outline-none resize-none" />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <span className="text-[11px] text-navy-400">⌘↵ to save</span>
              <button type="submit" disabled={!text.trim()}
                className="flex items-center gap-1.5 text-xs font-display font-semibold px-3 py-1.5 btn-primary disabled:opacity-40">
                <Send size={11}/> Save
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <FileText size={28} className="text-surface-400 mb-3"/>
            <p className="font-display font-semibold text-navy-700">No notes yet</p>
            <p className="text-navy-400 text-sm mt-1">Capture thoughts, ideas, blockers</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gold-600 uppercase tracking-widest mb-2">📌 Pinned</p>
                {pinned.map(n => <NoteCard key={n.id} note={n} onDelete={onDelete} onTogglePin={onTogglePin}/>)}
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length>0 && <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest mb-2">Recent</p>}
                {unpinned.map(n => <NoteCard key={n.id} note={n} onDelete={onDelete} onTogglePin={onTogglePin}/>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onDelete, onTogglePin }) {
  return (
    <div className={`card p-4 mb-2 group ${note.pinned?'border-gold-200 bg-gold-50':''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-navy-800 leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
          <p className="text-[11px] text-navy-400 mt-1.5">{fmt(note.createdAt)}</p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onTogglePin(note.id)} className={`p-1.5 rounded-lg transition-colors ${note.pinned?'text-gold-500':'text-navy-400 hover:text-gold-500'}`}><Pin size={13}/></button>
          <button onClick={() => onDelete(note.id)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
        </div>
      </div>
    </div>
  )
}

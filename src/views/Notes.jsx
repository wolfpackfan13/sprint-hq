import { useState, useRef } from 'react'
import { Pin, Trash2, Send, FileText } from 'lucide-react'

function formatTime(isoStr) {
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function Notes({ notes, onAdd, onDelete, onTogglePin }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(text)
    setText('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  const pinned = notes.filter(n => n.pinned)
  const unpinned = notes.filter(n => !n.pinned)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <h1 className="font-display font-bold text-white text-xl">Notes</h1>
        <p className="text-navy-400 text-sm mt-0.5">Brain dump — capture anything</p>
      </div>

      {/* Capture input */}
      <div className="px-5 pb-4 flex-shrink-0">
        <form onSubmit={handleSubmit}>
          <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden focus-within:border-gold-500 transition-colors">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? (⌘↵ to save)"
              rows={3}
              className="w-full bg-transparent px-4 pt-3.5 pb-2 text-white placeholder-navy-600 text-sm focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-xs text-navy-600">⌘↵ to save</span>
              <button
                type="submit"
                disabled={!text.trim()}
                className={`flex items-center gap-1.5 text-xs font-display font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  text.trim()
                    ? 'bg-gold-500 text-navy-900 hover:bg-gold-400'
                    : 'bg-navy-700 text-navy-500 cursor-not-allowed'
                }`}
              >
                <Send size={12} />
                Save
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-12 h-12 rounded-full bg-navy-800 flex items-center justify-center mb-3">
              <FileText size={24} className="text-navy-600" />
            </div>
            <p className="text-white font-display font-medium">No notes yet</p>
            <p className="text-navy-500 text-sm mt-1">Capture thoughts, ideas, blockers</p>
          </div>
        ) : (
          <>
            {/* Pinned section */}
            {pinned.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gold-500 uppercase tracking-widest mb-2">
                  📌 Pinned
                </p>
                <div className="space-y-2">
                  {pinned.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent */}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <p className="text-[10px] font-medium text-navy-500 uppercase tracking-widest mb-2">Recent</p>
                )}
                <div className="space-y-2">
                  {unpinned.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
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
    <div className={`bg-navy-800 border rounded-xl px-4 py-3 card-hover group ${
      note.pinned ? 'border-gold-800' : 'border-navy-700'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
            {note.content}
          </p>
          <p className="text-[11px] text-navy-600 mt-1.5">
            {formatTime(note.createdAt)}
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin(note.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              note.pinned
                ? 'text-gold-500 hover:text-gold-400'
                : 'text-navy-500 hover:text-gold-500'
            }`}
            aria-label={note.pinned ? 'Unpin' : 'Pin note'}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-lg text-navy-500 hover:text-red-400 transition-colors"
            aria-label="Delete note"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

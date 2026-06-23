import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react'

export function VisionBar({ vision, onSave }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(vision)

  const handleSave = () => {
    onSave(draft)
    setEditing(false)
  }

  if (!vision && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full px-4 py-2 bg-gold-50 border-b border-gold-300 text-left flex items-center gap-2 text-sm text-gold-700 hover:bg-gold-100 transition-colors"
      >
        <Sparkles size={13} />
        <span className="font-display font-medium">Set your Why — what are you building toward?</span>
      </button>
    )
  }

  if (editing) {
    return (
      <div className="bg-gold-50 border-b border-gold-300 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="text-gold-600 mt-2.5 flex-shrink-0" />
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.metaKey && handleSave()}
            placeholder="My Why: I'm building toward..."
            rows={2}
            className="flex-1 bg-white border border-gold-400 rounded-lg px-3 py-2 text-sm text-navy-800 resize-none focus:outline-none focus:border-gold-500"
          />
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={handleSave} className="p-1.5 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors">
              <Check size={13} />
            </button>
            <button onClick={() => { setEditing(false); setDraft(vision) }} className="p-1.5 text-navy-500 hover:text-navy-700 rounded-lg border border-surface-300">
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gold-50 border-b border-gold-200">
      <div className="px-4 py-2 flex items-center gap-2">
        <Sparkles size={13} className="text-gold-600 flex-shrink-0" />
        {!collapsed ? (
          <p className="flex-1 text-sm text-navy-700 leading-snug">
            <span className="font-display font-semibold text-gold-700">My Why: </span>
            {vision}
          </p>
        ) : (
          <p className="flex-1 text-xs font-display font-medium text-gold-700">My Why</p>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 text-gold-600 hover:text-gold-700 transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="p-1 text-gold-500 hover:text-gold-700 transition-colors">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

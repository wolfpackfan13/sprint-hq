import { useState } from 'react'
import { Link2, Plus, X, ExternalLink, Trash2 } from 'lucide-react'

const genId = () => `res_${Date.now()}_${Math.random().toString(36).slice(2,5)}`

// Guess a friendly label from a URL
function autoLabel(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = u.hostname.replace('www.', '')
    if (host.includes('claude.ai')) return 'Claude chat'
    if (host.includes('docs.google')) return 'Google Doc'
    if (host.includes('drive.google')) return 'Drive file'
    if (host.includes('sheets.google')) return 'Google Sheet'
    if (host.includes('notion')) return 'Notion page'
    if (host.includes('github')) return 'GitHub'
    return host
  } catch {
    return 'Link'
  }
}

function normalizeUrl(url) {
  if (!url) return ''
  return url.startsWith('http') ? url : `https://${url}`
}

export function ResourceLinks({ resources = [], onChange, compact = false }) {
  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const add = () => {
    if (!url.trim()) return
    const newRes = { id: genId(), label: label.trim() || autoLabel(url), url: normalizeUrl(url.trim()) }
    onChange([...(resources || []), newRes])
    setLabel(''); setUrl(''); setShowAdd(false)
  }

  const remove = (id) => onChange(resources.filter(r => r.id !== id))

  return (
    <div className="space-y-1.5">
      {resources.length > 0 && (
        <div className="space-y-1">
          {resources.map(r => (
            <div key={r.id} className="flex items-center gap-2 group">
              <a href={r.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline flex-1 min-w-0">
                <Link2 size={11} className="flex-shrink-0" />
                <span className="truncate">{r.label}</span>
                <ExternalLink size={9} className="flex-shrink-0 opacity-50" />
              </a>
              {onChange && (
                <button onClick={() => remove(r.id)} className="p-0.5 text-navy-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onChange && (
        showAdd ? (
          <div className="flex flex-col gap-1.5 bg-surface-100 rounded-lg p-2">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Paste URL (Claude chat, Doc, etc.)" autoFocus className="input-base px-2.5 py-1.5 text-xs" />
            <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Label (optional — auto-filled)" className="input-base px-2.5 py-1.5 text-xs" />
            <div className="flex gap-1.5">
              <button onClick={add} disabled={!url.trim()} className="btn-primary px-2.5 py-1 text-xs flex items-center gap-1"><Plus size={11} /> Add</button>
              <button onClick={() => { setShowAdd(false); setLabel(''); setUrl('') }} className="btn-ghost px-2.5 py-1 text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-navy-400 hover:text-blue-600 transition-colors">
            <Plus size={11} /> Add link
          </button>
        )
      )}
    </div>
  )
}

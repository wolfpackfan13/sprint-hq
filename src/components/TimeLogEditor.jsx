import { useState } from 'react'
import { Plus, Trash2, Clock, Pencil, Check } from 'lucide-react'
import { timeUtils } from '../utils/timeUtils'
import { dateUtils } from '../utils/dateUtils'

export function TimeLogEditor({ timeEntries = [], onAdd, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editH, setEditH] = useState(0)
  const [editM, setEditM] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [addH, setAddH] = useState(0)
  const [addM, setAddM] = useState(30)
  const [addDate, setAddDate] = useState(dateUtils.today())

  const total = timeUtils.totalSeconds(timeEntries)

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditH(Math.floor(entry.seconds / 3600))
    setEditM(Math.floor((entry.seconds % 3600) / 60))
  }

  const saveEdit = (id) => {
    const secs = (editH * 3600) + (editM * 60)
    if (secs > 0) onUpdate(id, secs)
    setEditingId(null)
  }

  const addEntry = () => {
    const secs = (addH * 3600) + (addM * 60)
    if (secs > 0) onAdd(secs, addDate)
    setShowAdd(false); setAddH(0); setAddM(30)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
          <Clock size={12} /> Time Log
        </span>
        <span className="text-xs font-display font-bold text-navy-700">{timeUtils.formatDuration(total)}</span>
      </div>

      {timeEntries.length > 0 && (
        <div className="space-y-1">
          {timeEntries.map(e => (
            <div key={e.id} className="flex items-center gap-2 bg-surface-100 rounded-lg px-2.5 py-1.5 group">
              {editingId === e.id ? (
                <>
                  <input type="number" value={editH} onChange={ev => setEditH(parseInt(ev.target.value)||0)} className="input-base w-12 px-1.5 py-1 text-xs text-center" min="0" />
                  <span className="text-xs text-navy-400">h</span>
                  <input type="number" value={editM} onChange={ev => setEditM(parseInt(ev.target.value)||0)} className="input-base w-12 px-1.5 py-1 text-xs text-center" min="0" max="59" />
                  <span className="text-xs text-navy-400">m</span>
                  <button onClick={() => saveEdit(e.id)} className="ml-auto p-1 text-forest-500"><Check size={13} /></button>
                </>
              ) : (
                <>
                  <span className="text-xs text-navy-600 flex-1">
                    {timeUtils.formatDuration(e.seconds)}
                    {e.manual && <span className="text-navy-400 ml-1">(manual)</span>}
                  </span>
                  <span className="text-[11px] text-navy-400">{e.end ? dateUtils.format(e.end.split('T')[0], 'short') : ''}</span>
                  <button onClick={() => startEdit(e)} className="p-0.5 text-navy-300 hover:text-gold-600 opacity-0 group-hover:opacity-100"><Pencil size={11} /></button>
                  <button onClick={() => onDelete(e.id)} className="p-0.5 text-navy-300 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="bg-surface-100 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <input type="number" value={addH} onChange={e => setAddH(parseInt(e.target.value)||0)} className="input-base w-14 px-2 py-1.5 text-sm text-center" min="0" />
            <span className="text-xs text-navy-400">hrs</span>
            <input type="number" value={addM} onChange={e => setAddM(parseInt(e.target.value)||0)} className="input-base w-14 px-2 py-1.5 text-sm text-center" min="0" max="59" />
            <span className="text-xs text-navy-400">min</span>
          </div>
          <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="input-base px-2.5 py-1.5 text-xs w-full" />
          <div className="flex gap-2">
            <button onClick={addEntry} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Plus size={12} /> Add Entry</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-navy-400 hover:text-gold-600 transition-colors">
          <Plus size={12} /> Add time manually
        </button>
      )}
    </div>
  )
}

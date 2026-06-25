import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ClientForm } from './ClientForm'

export function ManageClients({ companies, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleSave = (data) => {
    if (data.id) onUpdate(data.id, data)
    else onAdd(data)
    setShowForm(false); setEditing(null)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><span className="text-base">🏢</span></div>
          <div>
            <p className="font-display font-semibold text-navy-900">Clients & Companies</p>
            <p className="text-xs text-navy-500">{companies.length} total</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Plus size={13} /> Add</button>
      </div>

      <div className="space-y-2">
        {companies.map(co => (
          <div key={co.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-200">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${co.color}15` }}>
              <span className="text-sm">{co.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800">{co.name}</p>
              {co.billable && <p className="text-[11px] text-forest-600">${co.hourlyRate}/hr billable</p>}
            </div>
            <button onClick={() => { setEditing(co); setShowForm(true) }} className="p-1.5 text-navy-400 hover:text-gold-600"><Pencil size={13} /></button>
            <button onClick={() => window.confirm(`Delete ${co.name}? Tasks keep their data but lose this label.`) && onDelete(co.id)} className="p-1.5 text-navy-400 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {showForm && <ClientForm client={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}

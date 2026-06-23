import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, DollarSign } from 'lucide-react'

const COLOR_OPTIONS = ['#2D7A50','#F59E0B','#3B82F6','#EC4899','#8B5CF6','#6B7280','#EF4444','#0EA5E9','#14B8A6','#F97316']
const EMOJI_OPTIONS = ['🏠','🔨','📱','🎣','⚡','📋','💼','🏢','🚀','💰','📊','🎯','🌱','⛪','🏗️']

function ClientForm({ client, onSave, onClose }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    color: client?.color || COLOR_OPTIONS[0],
    emoji: client?.emoji || EMOJI_OPTIONS[0],
    billable: client?.billable || false,
    hourlyRate: client?.hourlyRate || 0,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[60] p-0 md:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display font-bold text-navy-900">{client?.id ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Client / Company name" autoFocus className="w-full input-base px-4 py-2.5 text-sm font-medium" />

          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => set('emoji', e)} className={`w-9 h-9 rounded-lg text-base flex items-center justify-center border transition-all ${form.emoji === e ? 'border-gold-500 bg-gold-50' : 'border-surface-300 hover:border-surface-400'}`}>{e}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => set('color', c)} className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-navy-400' : ''}`} style={{ backgroundColor: c }}>
                  {form.color === c && <Check size={14} className="text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Billable toggle */}
          <div className="bg-surface-100 rounded-xl p-3">
            <button onClick={() => set('billable', !form.billable)} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-navy-700">Billable client</span>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${form.billable ? 'bg-forest-500' : 'bg-surface-400'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.billable ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
            {form.billable && (
              <div className="mt-3 flex items-center gap-2">
                <DollarSign size={14} className="text-navy-400" />
                <input type="number" value={form.hourlyRate} onChange={e => set('hourlyRate', parseFloat(e.target.value) || 0)} placeholder="Hourly rate" className="flex-1 input-base px-3 py-2 text-sm" />
                <span className="text-xs text-navy-400">/hour</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
            <button onClick={() => form.name.trim() && onSave({ ...(client?.id ? { id: client.id } : {}), ...form })} disabled={!form.name.trim()} className="flex-1 py-2.5 btn-primary text-sm">{client?.id ? 'Save' : 'Add Client'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

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

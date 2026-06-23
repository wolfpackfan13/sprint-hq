import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail, Phone, X, Check } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

function ContactCard({ contact, company, onEdit, onDelete, onTouch }) {
  const daysAgo = contact.lastContactDate
    ? Math.floor((Date.now() - new Date(contact.lastContactDate + 'T12:00:00')) / 86400000)
    : null

  const freshness = daysAgo === null ? 'new'
    : daysAgo <= 7 ? 'fresh'
    : daysAgo <= 30 ? 'ok'
    : 'stale'

  const freshnessColor = { fresh: '#2D7A50', ok: '#F4A825', stale: '#EF4444', new: '#9BA5BB' }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-display font-bold text-sm"
          style={{ backgroundColor: company?.color || '#9BA5BB' }}
        >
          {(contact.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-semibold text-navy-900 text-sm">{contact.name}</p>
              {contact.role && <p className="text-xs text-navy-500">{contact.role}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onEdit(contact)} className="p-1 text-navy-400 hover:text-gold-600 transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(contact.id)} className="p-1 text-navy-400 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {company && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${company.color}15`, color: company.color }}>
                {company.emoji} {company.name}
              </span>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-0.5 text-[11px] text-navy-400 hover:text-navy-700">
                <Mail size={10} /> {contact.email}
              </a>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px]" style={{ color: freshnessColor[freshness] }}>
              {freshness === 'new' ? 'New contact' : `Last contact: ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`}`}
            </span>
            <button onClick={() => onTouch(contact.id)} className="text-[10px] font-medium text-gold-600 hover:text-gold-700">
              Mark contacted
            </button>
          </div>
          {contact.notes && (
            <p className="text-xs text-navy-500 mt-1.5 line-clamp-2">{contact.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactForm({ contact, companies, onSave, onClose }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    role: contact?.role || '',
    companyId: contact?.companyId || null,
    email: contact?.email || '',
    phone: contact?.phone || '',
    notes: contact?.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-display font-bold text-navy-900">{contact?.id ? 'Edit Contact' : 'New Contact'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700 rounded-lg hover:bg-surface-200"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name *" className="w-full input-base px-4 py-2.5 text-sm" autoFocus />
          <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Role / Title" className="w-full input-base px-4 py-2.5 text-sm" />
          <div className="flex flex-wrap gap-2">
            {companies.map(co => (
              <button key={co.id} onClick={() => set('companyId', form.companyId === co.id ? null : co.id)}
                className="text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all"
                style={form.companyId === co.id
                  ? { backgroundColor: co.color, borderColor: co.color, color: '#fff' }
                  : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }}>
                {co.emoji} {co.name}
              </button>
            ))}
          </div>
          <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" type="email" className="w-full input-base px-4 py-2.5 text-sm" />
          <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone" className="w-full input-base px-4 py-2.5 text-sm" />
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes about this person..." rows={2} className="w-full input-base px-4 py-2.5 text-sm resize-none" />
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
            <button onClick={() => form.name.trim() && onSave({ ...(contact?.id ? { id: contact.id } : {}), ...form })}
              disabled={!form.name.trim()} className="flex-1 py-2.5 btn-primary text-sm">
              {contact?.id ? 'Save' : 'Add Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Relationships({ contacts, companies, activeClient, onAdd, onUpdate, onDelete, onTouch }) {
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = contacts
    .filter(c => !activeClient || c.companyId === activeClient)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.role || '').toLowerCase().includes(search.toLowerCase()))

  const handleSave = (data) => {
    if (data.id) onUpdate(data.id, data)
    else onAdd(data)
    setShowForm(false)
    setEditingContact(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">Relationships</h1>
          <p className="text-navy-500 text-sm mt-0.5">{contacts.length} contacts</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="px-4 pb-3 flex-shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full input-base px-4 py-2.5 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-display font-semibold text-navy-700">No contacts yet</p>
            <p className="text-navy-400 text-sm mt-1">Track your key relationships here</p>
          </div>
        ) : (
          filtered.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              company={companies.find(co => co.id === c.companyId)}
              onEdit={c => { setEditingContact(c); setShowForm(true) }}
              onDelete={onDelete}
              onTouch={onTouch}
            />
          ))
        )}
      </div>

      {(showForm || editingContact) && (
        <ContactForm
          contact={editingContact}
          companies={companies}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingContact(null) }}
        />
      )}
    </div>
  )
}

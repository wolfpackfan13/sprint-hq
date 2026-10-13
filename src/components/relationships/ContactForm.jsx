import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from './bits'
import { STAGES, STAGE_ORDER, NETWORK_LABELS, SOURCES, REFERRAL_STAGES, stageOf, referralStageOf, emailsOf, lower } from '../../utils/relationships'
import { calUtils } from '../../utils/dateUtils'

const field = 'w-full input-base px-4 py-2.5 text-sm'
const labelCls = 'block text-xs font-semibold text-navy-600 mb-1.5'

export function ContactForm({ contact, defaultStage = 'nurturing', companies, contacts, allContacts, demoMode, onSave, onDelete, onClose }) {
  const isEdit = !!contact?.id
  const startStage = isEdit ? stageOf(contact) : defaultStage
  const [form, setForm] = useState({
    name: contact?.name || '',
    role: contact?.role || '',
    company: contact?.company || '',
    companyId: contact?.companyId || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    stage: startStage,
    networkLabel: contact?.networkLabel || '',
    source: contact?.source || '',
    referredBy: contact?.referredBy || '',
    notes: contact?.notes || '',
    referralStage: referralStageOf(contact) || '',
    otherEmails: (contact?.otherEmails || []).join(', '),
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Demo mode: the profile box starts blank and the saved notes stay as
  // they are unless something new is typed.
  const [notesTouched, setNotesTouched] = useState(!demoMode)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // One contact per email: Supabase enforces it for the main address, and
  // a rejected write would stall every sync behind it. Other addresses are
  // checked here too, so Gmail and Circleback never match two people.
  const parsedOthers = [...new Set(form.otherEmails.split(/[\s,;]+/).map(lower).filter(e => e.includes('@')))]
    .filter(e => e !== lower(form.email))
  const everyone = (allContacts || contacts).filter(c => c.id !== contact?.id)
  const emailKey = lower(form.email)
  const duplicate = emailKey ? everyone.find(c => emailsOf(c).includes(emailKey)) : null
  const otherDuplicate = parsedOthers.map(e => ({ e, c: everyone.find(c => emailsOf(c).includes(e)) })).find(x => x.c) || null

  const setStage = (stage) => setForm(f => ({
    ...f,
    stage,
    networkLabel: stage === 'network' ? f.networkLabel : '',
  }))

  const save = () => {
    if (!form.name.trim() || duplicate || otherDuplicate) return
    const today = calUtils.localToday()
    const data = {
      ...form,
      notes: notesTouched ? form.notes : (contact?.notes || ''),
      name: form.name.trim(),
      email: form.email.trim(),
      otherEmails: parsedOthers,
      companyId: form.companyId || null,
      networkLabel: form.stage === 'network' ? (form.networkLabel || null) : null,
      source: form.source || null,
      referredBy: form.referredBy || null,
      referralStage: form.referralStage || null,
    }
    if (form.stage === 'client' && !contact?.becameClientOn) data.becameClientOn = today
    if (form.referralStage === 'partner' && !contact?.partnerSince) data.partnerSince = today
    if (form.referralStage === 'invited' && !contact?.invitedOn) data.invitedOn = today
    onSave(isEdit ? { id: contact.id, ...data } : data)
  }

  const others = contacts.filter(c => c.id !== contact?.id && stageOf(c) !== 'needs_review')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <Sheet
      title={isEdit ? 'Edit contact' : 'New contact'} onClose={onClose} labelId="contact-form-title" wide
      footer={
        <div className="flex gap-2 items-center">
          {isEdit && onDelete && (
            confirmDelete
              ? <button onClick={() => onDelete(contact.id)} className="px-3 py-2.5 rounded-[10px] text-sm font-semibold bg-red-600 text-white">Delete for good</button>
              : <button onClick={() => setConfirmDelete(true)} aria-label="Delete contact" className="p-2.5 btn-ghost text-red-600"><Trash2 size={16} /></button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || !!duplicate || !!otherDuplicate} className="flex-1 py-2.5 btn-primary text-sm">{isEdit ? 'Save' : 'Add contact'}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="cf-name" className={labelCls}>Full name</label>
          <input id="cf-name" value={form.name} onChange={e => set('name', e.target.value)} className={field} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-role" className={labelCls}>Role</label>
            <input id="cf-role" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Owner" className={field} />
          </div>
          <div>
            <label htmlFor="cf-company" className={labelCls}>Company</label>
            <input id="cf-company" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Their business" className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-stage" className={labelCls}>Business stage</label>
            <select id="cf-stage" value={form.stage} onChange={e => setStage(e.target.value)} className={field}>
              {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGES[s].label}</option>)}
            </select>
          </div>
          {form.stage === 'network' ? (
            <div>
              <label htmlFor="cf-label" className={labelCls}>Network label</label>
              <select id="cf-label" value={form.networkLabel} onChange={e => set('networkLabel', e.target.value)} className={field}>
                <option value="">None</option>
                {Object.entries(NETWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="cf-area" className={labelCls}>Client / Area</label>
              <select id="cf-area" value={form.companyId} onChange={e => set('companyId', e.target.value)} className={field}>
                <option value="">None</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {form.stage === 'network' && (
          <div>
            <label htmlFor="cf-area-n" className={labelCls}>Client / Area</label>
            <select id="cf-area-n" value={form.companyId} onChange={e => set('companyId', e.target.value)} className={field}>
              <option value="">None</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="cf-ref-stage" className={labelCls}>Referral partner</label>
          <select id="cf-ref-stage" value={form.referralStage} onChange={e => set('referralStage', e.target.value)} className={field}>
            <option value="">Not a partner</option>
            {Object.entries(REFERRAL_STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-email" className={labelCls}>Email</label>
            <input id="cf-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} aria-invalid={!!duplicate} aria-describedby={duplicate ? 'cf-email-dup' : undefined} className={`${field} ${duplicate ? 'border-red-400' : ''}`} />
            {duplicate && <p id="cf-email-dup" className="text-xs text-red-700 mt-1">Already used by {duplicate.name || 'another contact'}.</p>}
          </div>
          <div>
            <label htmlFor="cf-phone" className={labelCls}>Phone</label>
            <input id="cf-phone" value={form.phone} onChange={e => set('phone', e.target.value)} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-source" className={labelCls}>Source</label>
            <select id="cf-source" value={form.source} onChange={e => set('source', e.target.value)} className={field}>
              <option value="">Not set</option>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cf-ref" className={labelCls}>Referred by</label>
            <select id="cf-ref" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} className={field}>
              <option value="">Nobody</option>
              {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="cf-other-emails" className={labelCls}>Other emails <span className="font-normal text-navy-500">· optional</span></label>
          <input id="cf-other-emails" value={form.otherEmails} onChange={e => set('otherEmails', e.target.value)} placeholder="work@example.com, personal@example.com"
            aria-invalid={!!otherDuplicate} aria-describedby={otherDuplicate ? 'cf-other-dup' : undefined} className={`${field} ${otherDuplicate ? 'border-red-400' : ''}`} />
          {otherDuplicate
            ? <p id="cf-other-dup" className="text-xs text-red-700 mt-1">{otherDuplicate.e} belongs to {otherDuplicate.c.name || 'another contact'}. Merge them from the contact page instead.</p>
            : <p className="text-xs text-navy-500 mt-1">Gmail sync and Circleback match any of these.</p>}
        </div>

        <div>
          <label htmlFor="cf-notes" className={labelCls}>Profile</label>
          <textarea id="cf-notes" value={notesTouched ? form.notes : ''} onChange={e => { setNotesTouched(true); set('notes', e.target.value) }} rows={3}
            placeholder={notesTouched ? 'Who they are and what matters to them' : 'Hidden in demo mode. Typing here replaces the saved profile.'} className={`${field} resize-none`} />
        </div>
      </div>
    </Sheet>
  )
}

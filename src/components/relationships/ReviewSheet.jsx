import { useState } from 'react'
import { Sheet, Avatar } from './bits'
import { STAGES, LEAD_STAGES, NETWORK_LABELS, defaultNextTouch, meetingsForContact, meetingBlurb, DEMO_MASK } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'

function suggestStage(contact, companies) {
  const record = companies.find(c => c.id === contact.companyId)
  if (record?.billable) return 'client'
  return ''
}

function ReviewCard({ contact, companies, meetings, demoMode, total, onSave, onSkip, onIgnore, onClose }) {
  const suggested = suggestStage(contact, companies)
  const [stage, setStageState] = useState(suggested)
  const [networkLabel, setNetworkLabel] = useState(contact.networkLabel || '')
  const [company, setCompany] = useState(contact.company || '')
  const [companyId, setCompanyId] = useState(contact.companyId || '')
  const [nextTouchOn, setNextTouchOn] = useState(contact.nextTouchOn || defaultNextTouch(suggested))
  const maskedReason = !!demoMode && !!contact.nextTouchReason
  const [nextTouchReason, setNextTouchReason] = useState(maskedReason ? '' : (contact.nextTouchReason || ''))
  const [reasonTouched, setReasonTouched] = useState(!maskedReason)
  const [confirmIgnore, setConfirmIgnore] = useState(false)
  const meeting = meetingsForContact(contact, meetings)[0]

  const setStage = (s, label = '') => {
    setStageState(s)
    setNetworkLabel(label)
    if (!contact.nextTouchOn) setNextTouchOn(defaultNextTouch(s))
  }

  const save = () => {
    if (!stage) return
    onSave(contact.id, {
      stage,
      networkLabel: stage === 'network' ? (networkLabel || null) : null,
      company: company.trim(),
      companyId: companyId || null,
      nextTouchOn,
      nextTouchReason: reasonTouched ? nextTouchReason.trim() : (contact.nextTouchReason || ''),
      ...(stage === 'client' && !contact.becameClientOn ? { becameClientOn: dateUtils.today() } : {}),
    })
  }

  const chip = (active) => `min-h-[38px] px-3 rounded-full border text-[13px] transition-all ${active ? 'border-navy-700 bg-[#EEF1F7] text-navy-900 font-semibold' : 'border-surface-300 text-navy-700 font-medium hover:bg-surface-100'}`

  return (
    <Sheet
      title="Sort new people" subtitle={total === 1 ? 'Last one to sort' : `${total} left to sort`} onClose={onClose} labelId="review-title"
      footer={
        <div className="flex gap-2 items-center">
          {confirmIgnore
            ? <button onClick={() => onIgnore(contact)} className="px-3 py-3 rounded-[10px] text-sm font-semibold bg-red-600 text-white">Delete {(contact.name || '').split(' ')[0] || 'them'}</button>
            : <button onClick={() => setConfirmIgnore(true)} className="px-2 py-3 text-sm font-semibold text-red-700">Not a contact</button>}
          <button onClick={onSkip} className="px-4 py-3 btn-ghost text-sm">Skip</button>
          <button onClick={save} disabled={!stage} className="flex-1 py-3 btn-primary text-sm">Save and next</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar contact={{ ...contact, stage: 'needs_review' }} size={44} />
          <div className="min-w-0">
            <p className="font-display font-bold text-navy-900 text-lg leading-tight">{contact.name || contact.email}</p>
            {contact.email && <p className="text-sm text-navy-600 truncate">{contact.email}</p>}
          </div>
        </div>

        {meeting && (
          <div className="rounded-xl bg-surface-100 px-3.5 py-3">
            <p className="text-xs text-navy-600">From <span className="font-semibold text-navy-800">{meeting.title || 'a meeting'}</span> · {dateUtils.format(meeting.date, 'short')}</p>
            {meetingBlurb(meeting) && <p className="text-sm text-navy-700 mt-1 leading-relaxed">{demoMode ? DEMO_MASK : meetingBlurb(meeting)}</p>}
          </div>
        )}

        <div>
          <label htmlFor="rv-company" className="block text-xs font-semibold text-navy-600 mb-1.5">Company</label>
          <input id="rv-company" value={company} onChange={e => setCompany(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-navy-600 mb-2">Stage</legend>
          <p className="font-display font-bold text-[11px] uppercase tracking-wider text-navy-600 mb-1.5">Lead</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {LEAD_STAGES.map(s => (
              <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)} className={chip(stage === s)}>
                {STAGES[s].label}{suggested === s && <span className="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white text-navy-600">Suggested</span>}
              </button>
            ))}
          </div>
          <p className="font-display font-bold text-[11px] uppercase tracking-wider text-navy-600 mb-1.5">Client or network</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={stage === 'client'} onClick={() => setStage('client')} className={chip(stage === 'client')}>
              Client{suggested === 'client' && <span className="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white text-navy-600">Suggested</span>}
            </button>
            <button type="button" aria-pressed={stage === 'past_client'} onClick={() => setStage('past_client')} className={chip(stage === 'past_client')}>Past client</button>
            {Object.entries(NETWORK_LABELS).map(([k, v]) => (
              <button key={k} type="button" aria-pressed={stage === 'network' && networkLabel === k} onClick={() => setStage('network', k)} className={chip(stage === 'network' && networkLabel === k)}>{v}</button>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-3">
          <div className="w-40 flex-shrink-0">
            <label htmlFor="rv-next" className="block text-xs font-semibold text-navy-600 mb-1.5">Next touch</label>
            <input id="rv-next" type="date" value={nextTouchOn} onChange={e => setNextTouchOn(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="rv-reason" className="block text-xs font-semibold text-navy-600 mb-1.5">Reason</label>
            <input id="rv-reason" value={nextTouchReason} onChange={e => { setReasonTouched(true); setNextTouchReason(e.target.value) }} placeholder={reasonTouched ? 'Optional' : 'Hidden in demo mode'} className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
        </div>

        <div>
          <label htmlFor="rv-area" className="block text-xs font-semibold text-navy-600 mb-1.5">Client / Area</label>
          <select id="rv-area" value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm">
            <option value="">None</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </Sheet>
  )
}

export function ReviewSheet({ queue, companies, meetings, demoMode, onSave, onIgnore, onClose }) {
  // Skipped people go to the back of this session's queue.
  const [skipped, setSkipped] = useState([])
  const ordered = [...queue.filter(c => !skipped.includes(c.id)), ...queue.filter(c => skipped.includes(c.id))]
  const current = ordered[0]
  const total = queue.length

  if (!current) {
    return (
      <Sheet title="All sorted" subtitle="Nobody is waiting for review." onClose={onClose} labelId="review-done-title"
        footer={<button onClick={onClose} className="w-full py-3 btn-primary text-sm">Done</button>}>
        <p className="text-sm text-navy-600">New people from meetings will show up here as they arrive.</p>
      </Sheet>
    )
  }

  return (
    <ReviewCard
      key={current.id}
      contact={current} companies={companies} meetings={meetings} demoMode={demoMode}
      total={total}
      onSave={onSave}
      onSkip={() => setSkipped(s => [...s.filter(id => id !== current.id), current.id])}
      onIgnore={onIgnore}
      onClose={onClose}
    />
  )
}

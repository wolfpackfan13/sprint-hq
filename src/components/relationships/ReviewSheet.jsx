import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Trash2, Users } from 'lucide-react'
import { Sheet, Avatar } from './bits'
import { STAGES, meetingsForContact, meetingBlurb, DEMO_MASK, duplicatesOf, emailsOf, lower, stageOf } from '../../utils/relationships'
import { dateUtils, calUtils } from '../../utils/dateUtils'

// Value in the stage picker → the fields it sets.
const CHOICES = [
  ['nurturing', 'Lead · Nurturing'],
  ['in_conversation', 'Lead · In conversation'],
  ['proposal_out', 'Lead · Proposal out'],
  ['client', 'Client'],
  ['past_client', 'Past client'],
  ['network', 'Network'],
  ['network:collaborator', 'Network · Collaborator'],
  ['network:personal', 'Personal'],
]
const choicePatch = (v) => {
  if (!v) return null
  const [stage, label] = v.split(':')
  return { stage, networkLabel: stage === 'network' ? (label || null) : null }
}

// The call's suggestion wins when the Circleback processor left one;
// otherwise a contact linked to a billable Client/Area reads as a client.
function suggestChoice(contact, companies) {
  const s = contact.suggestedStage
  if (s && STAGES[s] && s !== 'needs_review') {
    if (s === 'network' && ['collaborator', 'personal'].includes(contact.networkLabel)) return `network:${contact.networkLabel}`
    return s
  }
  const record = companies.find(c => c.id === contact.companyId)
  if (record?.billable) return 'client'
  return ''
}

// The Gmail thread a new person came from, if any.
const threadOf = (contact, threads) => {
  const m = /^gmail:(.+)$/.exec(contact.sourceRef || '')
  return m ? threads.find(t => t.id === m[1]) : null
}

// Who probably introduced them: someone you already know on the thread
// they came from.
function introFrom(contact, thread, known, selfEmails) {
  if (!thread) return null
  const mine = emailsOf(contact)
  const others = (thread.participants || []).map(lower).filter(e => !mine.includes(e) && !selfEmails.includes(e))
  const people = known.filter(k => k.id !== contact.id && stageOf(k) !== 'needs_review' && emailsOf(k).some(e => others.includes(e)))
  return people.length === 1 ? people[0] : null
}

function ReviewRow({ contact, row, onRow, meeting, thread, intro, duplicate, demoMode, companies, onMerge, onNotSame }) {
  const [open, setOpen] = useState(false)
  const source = meeting
    ? { line: `From ${meeting.title || 'a meeting'} · ${dateUtils.format(meeting.date, 'short')}`, blurb: meetingBlurb(meeting) }
    : thread
      ? { line: `From email · ${dateUtils.format((thread.lastMessageAt || '').split('T')[0], 'short')}`, blurb: thread.subject }
      : null
  return (
    <li className={`py-3 ${row.selected ? 'bg-gold-50 -mx-5 px-5' : ''}`}>
      <div className="flex gap-3 items-start">
        <input type="checkbox" checked={row.selected} onChange={e => onRow({ selected: e.target.checked })} aria-label={`Select ${contact.name || contact.email}`}
          className="mt-2.5 w-[18px] h-[18px] accent-[#A86800] flex-shrink-0" />
        <Avatar contact={contact} size={36} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full text-left flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy-900 truncate">{contact.name || contact.email}</span>
              {contact.email && contact.name && <span className="block text-xs text-navy-600 truncate">{contact.email}</span>}
            </span>
            {open ? <ChevronUp size={15} className="text-navy-500 mt-0.5 flex-shrink-0" /> : <ChevronDown size={15} className="text-navy-500 mt-0.5 flex-shrink-0" />}
          </button>
          {source && (
            <p className="text-xs text-navy-600">
              {source.line}{source.blurb ? <> · <span className="text-navy-700">{demoMode ? DEMO_MASK : source.blurb}</span></> : null}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 items-center">
            <label htmlFor={`rv-stage-${contact.id}`} className="sr-only">Stage for {contact.name}</label>
            <select id={`rv-stage-${contact.id}`} value={row.choice} onChange={e => onRow({ choice: e.target.value })}
              className={`input-base px-2.5 py-1.5 text-[13px] min-h-[36px] ${row.choice ? '' : 'border-[#F5D9A0] text-[#7A4E00]'}`}>
              <option value="">Pick a stage</option>
              {CHOICES.map(([v, l]) => <option key={v} value={v}>{l}{v === row.suggested ? ' (suggested)' : ''}</option>)}
            </select>
            {intro && (
              <label className="flex items-center gap-1.5 text-xs text-[#5B21B6] bg-[#F7F5FE] border border-[#E6DEFB] rounded-full px-2.5 min-h-[32px]">
                <input type="checkbox" checked={row.useIntro} onChange={e => onRow({ useIntro: e.target.checked })} className="w-3.5 h-3.5 accent-[#5B21B6]" />
                Intro from {intro.name}
              </label>
            )}
          </div>
          {duplicate && (
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-navy-700">
              <span className="flex items-center gap-1"><Users size={12} className="text-blue-700" /> Same person as {duplicate.name || duplicate.email}?</span>
              <button onClick={() => onMerge(contact, duplicate)} className="font-semibold text-blue-700 min-h-[32px]">Merge</button>
              <button onClick={() => onNotSame(contact.id, duplicate.id)} className="text-navy-600 min-h-[32px]">Not the same</button>
            </div>
          )}
          {open && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor={`rv-co-${contact.id}`} className="block text-[11px] font-semibold text-navy-600 mb-1">Company</label>
                <input id={`rv-co-${contact.id}`} value={row.company} onChange={e => onRow({ company: e.target.value })} className="w-full input-base px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label htmlFor={`rv-area-${contact.id}`} className="block text-[11px] font-semibold text-navy-600 mb-1">Client / Area</label>
                <select id={`rv-area-${contact.id}`} value={row.companyId} onChange={e => onRow({ companyId: e.target.value })} className="w-full input-base px-2.5 py-1.5 text-sm">
                  <option value="">None</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// Everyone waiting in Needs review, on one list. Tick several and approve
// them together (each with its own stage) or delete them together.
export function ReviewSheet({
  queue, companies, meetings, emailThreads = [], contacts = [], selfEmails = [], notSame = [], demoMode,
  onApprove, onDelete, onMerge, onNotSame, onClose,
}) {
  const defaultRow = (c) => {
    const suggested = suggestChoice(c, companies)
    return { selected: false, choice: suggested, suggested, company: c.company || '', companyId: c.companyId || '', useIntro: true }
  }
  const [rows, setRows] = useState(() => Object.fromEntries(queue.map(c => [c.id, defaultRow(c)])))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState('')

  // People who arrive while the sheet is open get their row on first use.
  const rowOf = (c) => rows[c.id] || defaultRow(c)
  const setRow = (c, patch) => {
    setRows(r => ({ ...r, [c.id]: { ...(r[c.id] || defaultRow(c)), ...patch } }))
    setConfirmDelete(false); setNote('')
  }

  const details = useMemo(() => Object.fromEntries(queue.map(c => {
    const thread = threadOf(c, emailThreads)
    return [c.id, {
      meeting: meetingsForContact(c, meetings)[0],
      thread,
      intro: introFrom(c, thread, contacts, selfEmails.map(lower)),
      duplicate: duplicatesOf(c, contacts, { notSame })[0] || null,
    }]
  })), [queue, meetings, emailThreads, contacts, selfEmails, notSame])

  const selected = queue.filter(c => rowOf(c).selected)
  const allSelected = queue.length > 0 && selected.length === queue.length
  const ready = selected.filter(c => rowOf(c).choice)
  const missing = selected.length - ready.length

  const approve = () => {
    if (!ready.length) { setNote('Pick a stage for the people you ticked.'); return }
    onApprove(ready.map(c => {
      const row = rowOf(c)
      const d = details[c.id]
      const patch = { id: c.id, ...choicePatch(row.choice), company: row.company.trim(), companyId: row.companyId || null }
      if (patch.stage === 'client' && !c.becameClientOn) patch.becameClientOn = calUtils.localToday()
      if (d.intro && row.useIntro && !c.referredBy) { patch.referredBy = d.intro.id; patch.source = 'referral' }
      return patch
    }))
    setNote(missing ? `${missing} still ${missing === 1 ? 'needs' : 'need'} a stage.` : '')
    setRows(r => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, { ...v, selected: false }])))
  }

  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete(selected)
    setConfirmDelete(false)
  }

  if (queue.length === 0) {
    return (
      <Sheet title="All sorted" subtitle="Nobody is waiting for review." onClose={onClose} labelId="review-done-title"
        footer={<button onClick={onClose} className="w-full py-3 btn-primary text-sm">Done</button>}>
        <p className="text-sm text-navy-600">New people from meetings and email show up here as they arrive.</p>
      </Sheet>
    )
  }

  return (
    <Sheet
      title="Sort new people" subtitle={`${queue.length} waiting · tick people to approve or delete them together`}
      onClose={onClose} labelId="review-title" wide
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-navy-700 min-h-[44px] pr-2">
              <input type="checkbox" checked={allSelected} onChange={e => setRows(r => ({ ...r, ...Object.fromEntries(queue.map(c => [c.id, { ...(r[c.id] || defaultRow(c)), selected: e.target.checked }])) }))}
                className="w-[18px] h-[18px] accent-[#A86800]" />
              All
            </label>
            <button onClick={remove} disabled={!selected.length}
              className={`px-3 min-h-[44px] rounded-[10px] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 ${confirmDelete ? 'bg-red-600 text-white' : 'border border-[#F3C4C4] text-red-700'}`}>
              <Trash2 size={14} /> {confirmDelete ? `Delete ${selected.length} for good` : `Delete${selected.length ? ` ${selected.length}` : ''}`}
            </button>
            <button onClick={approve} disabled={!selected.length} className="flex-1 min-h-[44px] btn-primary text-sm">
              Approve{ready.length ? ` ${ready.length}` : ''}
            </button>
          </div>
          {(note || confirmDelete) && (
            <p className="text-xs text-navy-600">{confirmDelete ? 'Deleted people are also ignored, so Gmail, Circleback and Fathom don\'t add them back.' : note}</p>
          )}
        </div>
      }
    >
      <ul className="divide-y divide-surface-200">
        {queue.map(c => (
          <ReviewRow key={c.id} contact={c} row={rowOf(c)} onRow={(patch) => setRow(c, patch)}
            meeting={details[c.id].meeting} thread={details[c.id].thread} intro={details[c.id].intro} duplicate={details[c.id].duplicate}
            demoMode={demoMode} companies={companies} onMerge={onMerge} onNotSame={onNotSame} />
        ))}
      </ul>
    </Sheet>
  )
}

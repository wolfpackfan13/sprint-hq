import { useState, useEffect, useMemo } from 'react'
import { Link2, Loader2, Check, X, AlertCircle, Search } from 'lucide-react'
import { Sheet, Avatar } from './bits'
import { defaultNextTouch, shortDay } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'
import {
  fetchCirclebackMeeting, draftFromCircleback, matchAttendees, looksLikeCirclebackLink,
  looksLikeMarkdown, circlebackNotesToText, circlebackSummary, firstName,
} from '../../utils/circleback'

const label = 'block text-xs font-semibold text-navy-600 mb-1.5'

// Log a meeting with one or more people.
//
// Opened from a contact, that person is always on it. Opened from the
// Relationships header, you pick people, or paste a Circleback link and the
// people on the call are picked for you. Either way the link fills in the
// title, date, summary and action items, and the full notes come along.
export function LogConversationModal({
  contact, contacts = [], allContacts = [], meetings = [], userEmail, ignore = [],
  onSave, onClose,
}) {
  const today = dateUtils.today()
  const selfEmails = useMemo(() => [userEmail, 'sam.blinson@gmail.com'].filter(Boolean), [userEmail])

  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState(null)
  const [newPeople, setNewPeople] = useState([])

  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState(contact ? [contact.id] : [])
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts])
  const existing = draft ? meetings.find(m => m.externalId && m.externalId === draft.externalId) : null
  const addingNew = newPeople.filter(p => p.add)

  // Next touch belongs to one person: the contact this was opened from, or
  // the only person picked. With several people, their dates stay as they are.
  const primary = contact || (selected.length === 1 && addingNew.length === 0 ? byId.get(selected[0]) : null)
  const [nextTouchOn, setNextTouchOn] = useState('')
  const [nextTouchReason, setNextTouchReason] = useState('')
  useEffect(() => {
    if (!primary) return
    const keep = primary.nextTouchOn && primary.nextTouchOn > today
    setNextTouchOn(keep ? primary.nextTouchOn : defaultNextTouch(primary.stage, today))
    setNextTouchReason(keep ? primary.nextTouchReason || '' : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary?.id])

  const load = async (value) => {
    const text = (value ?? link).trim()
    if (!text || loading) return
    setLoading(true); setLoadError('')
    const res = await fetchCirclebackMeeting(text)
    setLoading(false)
    if (res.error) { setLoadError(res.error); return }

    const cb = res.meeting
    const d = draftFromCircleback(cb, { selfEmails })
    setDraft(d)
    setTitle(d.title)
    setDate(d.date && d.date <= today ? d.date : today)
    setNotes(d.summary || d.notes)

    const { matchedIds, newPeople: unknown } = matchAttendees(cb.attendees, allContacts.length ? allContacts : contacts, { selfEmails, ignore })
    setSelected(prev => [...new Set([...prev, ...matchedIds.filter(id => byId.has(id))])])
    // A one-on-one with someone new: tick them, since that is why you are here.
    const solo = !contact && matchedIds.length === 0 && unknown.length === 1
    setNewPeople(unknown.map(p => ({ ...p, add: solo })))
  }

  const onPasteLink = (e) => {
    const text = e.clipboardData?.getData('text') || ''
    if (looksLikeCirclebackLink(text)) {
      e.preventDefault()
      setLink(text.trim())
      load(text)
    }
  }

  const clearDraft = () => {
    setDraft(null); setNewPeople([]); setLink(''); setLoadError('')
    setTitle(''); setNotes(''); setDate(today)
    setSelected(contact ? [contact.id] : [])
  }

  const toggleNew = (email) => setNewPeople(list => list.map(p => p.email === email ? { ...p, add: !p.add } : p))
  const remove = (id) => setSelected(ids => ids.filter(x => x !== id))
  const add = (id) => { setSelected(ids => ids.includes(id) ? ids : [...ids, id]); setQuery('') }

  const q = query.trim().toLowerCase()
  const results = q
    ? contacts.filter(c => !selected.includes(c.id) && [c.name, c.company, c.email].some(v => (v || '').toLowerCase().includes(q))).slice(0, 5)
    : []

  const canSave = selected.length + addingNew.length > 0

  const save = () => {
    if (!canSave) return
    let summary = ''
    let body = notes.trim()
    if (draft) {
      summary = body
      body = draft.notes || body
    } else if (looksLikeMarkdown(body)) {
      // Notes copied out of Circleback by hand: clean them up the same way.
      summary = circlebackSummary(body)
      body = circlebackNotesToText(body)
    }
    onSave({
      existingMeetingId: existing?.id || null,
      meeting: {
        title: title.trim() || (draft ? draft.title : 'Conversation'),
        date: date || today,
        time: draft?.time || '',
        summary,
        notes: body,
        attendees: draft?.attendees || '',
        actionItems: draft?.actionItems || [],
        externalId: draft?.externalId || null,
        recordingUrl: draft?.recordingUrl || '',
        source: draft ? 'circleback' : 'manual',
      },
      contactIds: selected,
      newPeople: addingNew.map(({ name, email }) => ({ name, email })),
      nextTouch: primary ? { contactId: primary.id, nextTouchOn, nextTouchReason: nextTouchReason.trim() } : null,
    })
  }

  const noteWords = draft?.notes ? draft.notes.split(/\s+/).filter(Boolean).length : 0
  const openItems = draft ? draft.actionItems.filter(ai => !ai.done).length : 0

  return (
    <Sheet
      title={contact ? 'Log a conversation' : 'Log a meeting'}
      subtitle={contact ? contact.name : 'Paste a Circleback link, or write it up yourself.'}
      onClose={onClose} labelId="log-conversation-title" wide
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
          <button onClick={save} disabled={!canSave} className="flex-[2] py-2.5 btn-primary text-sm">
            {existing ? 'Update meeting' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Circleback link */}
        {!draft ? (
          <div>
            <label htmlFor="log-link" className={label}>Circleback link <span className="font-normal text-navy-500">· optional</span></label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500 pointer-events-none" aria-hidden="true" />
                <input id="log-link" type="url" inputMode="url" autoComplete="off" value={link}
                  onChange={e => { setLink(e.target.value); setLoadError('') }} onPaste={onPasteLink}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); load() } }}
                  placeholder="circleback.ai/meetings/…" className="w-full input-base pl-9 pr-3 py-2.5 text-sm" />
              </div>
              <button type="button" onClick={() => load()} disabled={!link.trim() || loading}
                className="btn-ghost px-4 text-sm font-display font-semibold min-h-[44px] flex items-center gap-1.5 disabled:opacity-50">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Loading</> : 'Load'}
              </button>
            </div>
            {loadError ? (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-red-700 mt-1.5"><AlertCircle size={13} className="mt-px flex-shrink-0" />{loadError}</p>
            ) : (
              <p className="text-xs text-navy-500 mt-1.5">Fills in the notes, action items, and who was there.</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[#B7E4C7] bg-forest-50 px-3 py-2.5 flex items-start gap-2.5">
            <Check size={15} className="text-forest-700 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <div className="flex-1 min-w-0 text-[13px] text-navy-700">
              <p className="font-semibold text-navy-900">Loaded from Circleback</p>
              <p>
                {[noteWords ? `${noteWords.toLocaleString()} words of notes` : '', draft.actionItems.length ? `${draft.actionItems.length} action item${draft.actionItems.length === 1 ? '' : 's'}${openItems && openItems !== draft.actionItems.length ? `, ${openItems} open` : ''}` : ''].filter(Boolean).join(' · ') || 'No notes yet'}
              </p>
              {existing && (
                <p className="mt-1 text-[#7A4E00]">Already saved on {shortDay(existing.date)}. Saving adds the people below to it.</p>
              )}
            </div>
            <button onClick={clearDraft} className="text-[13px] font-medium text-navy-600 hover:text-navy-900 flex-shrink-0">Clear</button>
          </div>
        )}

        <div className="flex gap-3">
          <div className="w-40 flex-shrink-0">
            <label htmlFor="log-date" className={label}>Date</label>
            <input id="log-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="log-title" className={label}>What was it</label>
            <input id="log-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Coffee, downtown" className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
        </div>

        {/* People */}
        <div>
          <p className={label} id="log-people-label">Who was there</p>
          {selected.length > 0 && (
            <ul aria-labelledby="log-people-label" className="flex flex-wrap gap-1.5 mb-2">
              {selected.map(id => {
                const c = byId.get(id)
                if (!c) return null
                const fixed = contact && id === contact.id
                return (
                  <li key={id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg border border-surface-300 bg-white text-[13px] text-navy-800">
                    <Avatar contact={c} size={20} />
                    <span className="max-w-[160px] truncate">{c.name || c.email}</span>
                    {!fixed && (
                      <button onClick={() => remove(id)} aria-label={`Remove ${c.name || c.email}`} className="w-6 h-6 -my-1 flex items-center justify-center text-navy-500 hover:text-navy-900 rounded">
                        <X size={13} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500 pointer-events-none" aria-hidden="true" />
            <label htmlFor="log-people" className="sr-only">Add someone</label>
            <input id="log-people" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off"
              placeholder={selected.length ? 'Add someone else' : 'Add someone'} className="w-full input-base pl-9 pr-3 py-2.5 text-sm" />
          </div>
          {results.length > 0 && (
            <ul className="mt-1 rounded-xl border border-surface-300 bg-white overflow-hidden">
              {results.map(c => (
                <li key={c.id}>
                  <button onClick={() => add(c.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-100 min-h-[44px]">
                    <Avatar contact={c} size={24} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-navy-900 truncate">{c.name || c.email}</span>
                      {(c.company || c.email) && <span className="block text-xs text-navy-600 truncate">{c.company || c.email}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && results.length === 0 && (
            <p className="text-xs text-navy-500 mt-1.5">Nobody matches. Add them from the Relationships page first.</p>
          )}
        </div>

        {/* Attendees who aren't contacts yet */}
        {newPeople.length > 0 && (
          <fieldset>
            <legend className={label}>Not in your contacts yet</legend>
            <div className="space-y-1">
              {newPeople.map(p => (
                <label key={p.email} className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] border border-surface-300 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={p.add} onChange={() => toggleNew(p.email)} className="w-4 h-4 accent-[#A86800] flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-navy-900 truncate">{p.name || p.email}</span>
                    {p.name && <span className="block text-xs text-navy-600 truncate">{p.email}</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-navy-500 mt-1.5">Ticked people are added to Needs review with this meeting attached.</p>
          </fieldset>
        )}

        <div>
          <label htmlFor="log-notes" className={label}>{draft ? 'Summary' : 'Notes'}</label>
          <textarea id="log-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={draft ? 6 : 4}
            placeholder="What you talked about and anything you promised" className="w-full input-base px-3 py-2.5 text-sm resize-none" />
          {draft?.notes && draft.notes !== notes.trim() && (
            <p className="text-xs text-navy-500 mt-1">The full Circleback notes are saved with the meeting too.</p>
          )}
        </div>

        {primary ? (
          <div className="flex gap-3">
            <div className="w-40 flex-shrink-0">
              <label htmlFor="log-next" className={label}>Next touch{contact ? '' : ` · ${firstName(primary.name) || 'them'}`}</label>
              <input id="log-next" type="date" value={nextTouchOn} min={today} onChange={e => setNextTouchOn(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="log-reason" className={label}>Reason</label>
              <input id="log-reason" value={nextTouchReason} onChange={e => setNextTouchReason(e.target.value)} placeholder="Optional" className="w-full input-base px-3 py-2.5 text-sm" />
            </div>
          </div>
        ) : selected.length + addingNew.length > 1 ? (
          <p className="text-xs text-navy-500">Everyone's next touch date stays as it is. Set them from each person's page.</p>
        ) : null}

        {!canSave && <p className="text-xs text-navy-600">Pick at least one person to save this to.</p>}
      </div>
    </Sheet>
  )
}

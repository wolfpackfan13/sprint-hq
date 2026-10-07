import { useState } from 'react'
import { Sheet } from './bits'
import { defaultNextTouch } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'

// For the coffee, phone call, or lunch that Circleback never recorded.
export function LogConversationModal({ contact, onSave, onClose }) {
  const today = dateUtils.today()
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [nextTouchOn, setNextTouchOn] = useState(defaultNextTouch(contact.stage, today))
  const [nextTouchReason, setNextTouchReason] = useState('')

  const save = () => onSave({
    date: date || today,
    title: title.trim() || 'Conversation',
    notes: notes.trim(),
    nextTouchOn,
    nextTouchReason: nextTouchReason.trim(),
  })

  return (
    <Sheet
      title="Log a conversation" subtitle={contact.name} onClose={onClose} labelId="log-conversation-title"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 btn-primary text-sm">Save</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="w-40 flex-shrink-0">
            <label htmlFor="log-date" className="block text-xs font-semibold text-navy-600 mb-1.5">Date</label>
            <input id="log-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="log-title" className="block text-xs font-semibold text-navy-600 mb-1.5">What was it</label>
            <input id="log-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Coffee, downtown" className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="log-notes" className="block text-xs font-semibold text-navy-600 mb-1.5">Notes</label>
          <textarea id="log-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="What you talked about and anything you promised" className="w-full input-base px-3 py-2.5 text-sm resize-none" />
        </div>
        <div className="flex gap-3">
          <div className="w-40 flex-shrink-0">
            <label htmlFor="log-next" className="block text-xs font-semibold text-navy-600 mb-1.5">Next touch</label>
            <input id="log-next" type="date" value={nextTouchOn} min={today} onChange={e => setNextTouchOn(e.target.value)} className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="log-reason" className="block text-xs font-semibold text-navy-600 mb-1.5">Reason</label>
            <input id="log-reason" value={nextTouchReason} onChange={e => setNextTouchReason(e.target.value)} placeholder="Optional" className="w-full input-base px-3 py-2.5 text-sm" />
          </div>
        </div>
      </div>
    </Sheet>
  )
}

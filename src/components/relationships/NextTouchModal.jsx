import { useState } from 'react'
import { Sheet } from './bits'
import { STAGES, defaultNextTouch, shortDay } from '../../utils/relationships'
import { dateUtils, calUtils } from '../../utils/dateUtils'

// One small dialog for every way a next touch gets set: Done, Snooze,
// and a stage change (which proposes the new stage's default).
export function NextTouchModal({ mode, contact, stage, demoMode, onSave, onClose }) {
  const today = dateUtils.today()
  const targetStage = stage || contact.stage
  const stageDefault = defaultNextTouch(targetStage, today)

  const initialDate = mode === 'snooze'
    ? (contact.nextTouchOn && contact.nextTouchOn > today ? contact.nextTouchOn : calUtils.addDays(today, 7))
    : (stageDefault || '')
  const initialReason = mode === 'done' ? '' : (contact.nextTouchReason || '')

  const [date, setDate] = useState(initialDate)
  // Demo mode: don't show the saved reason, and keep it unless something new is typed.
  const masked = !!demoMode && !!initialReason
  const [reason, setReason] = useState(masked ? '' : initialReason)
  const [reasonTouched, setReasonTouched] = useState(!masked)
  const finalReason = reasonTouched ? reason.trim() : initialReason

  const picks = [
    { label: '3 days', value: calUtils.addDays(today, 3) },
    { label: '1 week', value: calUtils.addDays(today, 7) },
    { label: '2 weeks', value: calUtils.addDays(today, 14) },
  ]
  if (stageDefault && !picks.some(p => p.value === stageDefault)) {
    picks.push({ label: `${STAGES[targetStage].label} default`, value: stageDefault })
  }

  const firstName = (contact.name || '').trim().split(' ')[0] || 'them'
  const title = mode === 'done' ? `Contact logged with ${firstName}`
    : mode === 'snooze' ? 'Snooze until'
    : mode === 'stage' ? `Moving to ${STAGES[targetStage].label}`
    : 'Next touch'
  const subtitle = mode === 'done' ? 'When should you reach out next?'
    : mode === 'stage' ? 'Here is the next touch that stage suggests.'
    : null

  return (
    <Sheet
      title={title} subtitle={subtitle} onClose={onClose} labelId="next-touch-title"
      footer={
        <div className="flex gap-2">
          <button onClick={() => onSave({ nextTouchOn: '', nextTouchReason: '' })} className="px-4 py-2.5 btn-ghost text-sm">No date</button>
          <button onClick={() => onSave({ nextTouchOn: date, nextTouchReason: finalReason })} className="flex-1 py-2.5 btn-primary text-sm">
            {date ? `Save · ${shortDay(date)}` : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <button key={p.label} onClick={() => setDate(p.value)}
              className={`text-sm px-3 py-2 rounded-full border font-medium transition-all ${date === p.value ? 'bg-gold-50 border-gold-500 text-[#8A5500]' : 'border-surface-300 text-navy-700 hover:bg-surface-100'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="next-touch-date" className="block text-xs font-semibold text-navy-600 mb-1.5">Date</label>
          <input id="next-touch-date" type="date" value={date} min={today} onChange={e => setDate(e.target.value)} className="w-full input-base px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label htmlFor="next-touch-reason" className="block text-xs font-semibold text-navy-600 mb-1.5">Reason <span className="font-normal text-navy-500">(optional)</span></label>
          <input id="next-touch-reason" value={reason} onChange={e => { setReasonTouched(true); setReason(e.target.value) }} placeholder={reasonTouched ? 'Send the diagnostic outline' : 'Hidden in demo mode'} className="w-full input-base px-4 py-2.5 text-sm" />
        </div>
      </div>
    </Sheet>
  )
}

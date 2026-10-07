import { useState } from 'react'
import { Avatar, StageChip } from './bits'
import { NextTouchModal } from './NextTouchModal'
import { NETWORK_LABELS, DEMO_MASK, stageOf, touchStatus } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'

const MAX_SHOWN = 5

// Today's "Reach out" card: next touches due today or overdue.
// Renders nothing when nobody is due.
export function ReachOutCard({ due, companies, demoMode, onCompleteTouch, onSnooze, onOpenContact, onOpenAll }) {
  const [touch, setTouch] = useState(null) // { mode, contact }
  if (!due.length && !touch) return null

  const shown = due.slice(0, MAX_SHOWN)
  const more = due.length - shown.length

  const save = ({ nextTouchOn, nextTouchReason }) => {
    if (touch.mode === 'done') onCompleteTouch(touch.contact.id, { nextTouchOn, nextTouchReason })
    else onSnooze(touch.contact.id, { nextTouchOn, nextTouchReason })
    setTouch(null)
  }

  return (
    <section aria-labelledby="reach-out-title" className="card border-[#FBE3B4] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="reach-out-title" className="font-display font-bold text-navy-900 text-sm uppercase tracking-wide">Reach out · {due.length}</h2>
        <button onClick={onOpenAll} className="text-[13px] font-medium text-blue-700">All relationships</button>
      </div>
      <div className="divide-y divide-surface-200">
        {shown.map(c => {
          const overdue = touchStatus(c.nextTouchOn) === 'overdue'
          const stage = stageOf(c)
          return (
            <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 space-y-2">
              <button onClick={() => onOpenContact(c.id)} className="w-full flex gap-2.5 items-center text-left">
                <Avatar contact={c} company={companies.find(co => co.id === c.companyId)} size={32} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-navy-900">{c.name}</span>
                    {stage === 'network' && c.networkLabel
                      ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-[#F1ECFD] text-[#5B21B6] border-[#DDD0FA]">{NETWORK_LABELS[c.networkLabel]}</span>
                      : <StageChip stage={stage} />}
                  </span>
                  <span className="block text-[13px] text-navy-600 truncate">
                    <span className={overdue ? 'text-red-700 font-semibold' : 'text-[#8A5500] font-semibold'}>
                      {overdue ? `Overdue · ${dateUtils.format(c.nextTouchOn, 'short')}` : 'Today'}
                    </span>
                    {c.nextTouchReason ? ` · ${demoMode ? DEMO_MASK : c.nextTouchReason}` : ''}
                  </span>
                </span>
              </button>
              <div className="flex gap-2 pl-[42px]">
                <button onClick={() => setTouch({ mode: 'done', contact: c })} className="flex-1 btn-primary min-h-[40px] text-sm">Done</button>
                <button onClick={() => setTouch({ mode: 'snooze', contact: c })} className="flex-1 btn-ghost min-h-[40px] text-sm font-display font-semibold">Snooze</button>
              </div>
            </div>
          )
        })}
      </div>
      {more > 0 && (
        <button onClick={onOpenAll} className="mt-3 text-[13px] font-medium text-blue-700">and {more} more</button>
      )}
      {touch && (
        <NextTouchModal mode={touch.mode} contact={touch.contact} demoMode={demoMode} onSave={save} onClose={() => setTouch(null)} />
      )}
    </section>
  )
}

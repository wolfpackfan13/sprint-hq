import { CalendarPlus, PenLine, X } from 'lucide-react'
import { Avatar, StageChip } from './bits'
import { REFERRAL_STAGES, referralStageOf, stageOf, firstNameOf } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'

const MAX_SHOWN = 5

const whenLabel = (item) => {
  const d = new Date(item.start)
  const day = dateUtils.format(item.day, 'weekday')
  const date = dateUtils.format(item.day, 'short')
  return `${day}, ${date} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

// Today, top of the list: meetings the calendar found with a lead, client
// or partner that have no notes yet. Renders nothing when there are none.
export function ToLogCard({ items, contactsById, companies, onLog, onDismiss, onOpenContact }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="to-log-title" className="rounded-xl border border-[#FBE3B4] bg-gold-50 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <PenLine size={16} className="text-[#A86800]" />
        <h2 id="to-log-title" className="font-display font-bold text-navy-900 text-[15px]">To log · {items.length}</h2>
        <span className="text-xs text-[#6B4300]">Meetings with no notes yet</span>
      </div>
      {items.map(item => {
        const people = item.contactIds.map(id => contactsById[id]).filter(Boolean)
        const lead = people[0]
        if (!lead) return null
        return (
          <div key={item.eventId} className="flex items-center gap-2 rounded-[10px] bg-white border border-[#FBE3B4] pl-2.5 pr-1.5 py-1.5">
            <button onClick={() => onOpenContact(lead.id)} className="flex-1 min-w-0 flex gap-2.5 items-center text-left min-h-[44px]">
              <Avatar contact={lead} company={companies.find(co => co.id === lead.companyId)} size={32} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-navy-900 truncate">{item.title || `Meeting with ${firstNameOf(lead)}`}</span>
                <span className="block text-xs text-navy-600 truncate">
                  {whenLabel(item)} · {people.map(p => p.name || p.email).slice(0, 2).join(', ')}{people.length > 2 ? ` +${people.length - 2}` : ''}
                </span>
              </span>
            </button>
            <button onClick={() => onLog(item)} className="btn-primary min-h-[40px] px-3.5 text-sm">Log</button>
            <button onClick={() => onDismiss(item.eventId)} aria-label={`Nothing to log for ${item.title || 'this meeting'}`}
              className="w-9 h-9 flex items-center justify-center text-navy-500 hover:text-navy-900 rounded-lg"><X size={15} /></button>
          </div>
        )
      })}
    </section>
  )
}

// Today: people with nothing on your calendar who are past the gap their
// stage allows. One tap opens the Schedule sheet on their page.
export function ReachOutCard({ due, companies, onSchedule, onOpenContact, onOpenAll }) {
  if (!due.length) return null
  const shown = due.slice(0, MAX_SHOWN)
  const more = due.length - shown.length
  return (
    <section aria-labelledby="reach-out-title" className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 id="reach-out-title" className="font-display font-bold text-navy-900 text-sm uppercase tracking-wide">Reach out · {due.length}</h2>
        <button onClick={onOpenAll} className="text-[13px] font-medium text-blue-700">All relationships</button>
      </div>
      <div className="divide-y divide-surface-200">
        {shown.map(({ contact: c, since, last }) => {
          const ref = referralStageOf(c)
          const stage = stageOf(c)
          return (
            <div key={c.id} className="py-2.5 first:pt-1 last:pb-0 flex items-center gap-2.5">
              <button onClick={() => onOpenContact(c.id)} className="flex-1 min-w-0 flex gap-2.5 items-center text-left">
                <Avatar contact={c} company={companies.find(co => co.id === c.companyId)} size={32} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-navy-900">{c.name}</span>
                    {stage !== 'network'
                      ? <StageChip stage={stage} />
                      : ref && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${REFERRAL_STAGES[ref].chip}`}>{REFERRAL_STAGES[ref].label}</span>}
                  </span>
                  <span className="block text-[13px] text-navy-600 truncate">
                    Nothing booked · {last ? `last contact ${dateUtils.format(last, 'short')} (${since} days)` : 'no contact logged yet'}
                  </span>
                </span>
              </button>
              <button onClick={() => onSchedule(c.id)} className="btn-ghost min-h-[40px] px-3 text-sm font-display font-semibold flex items-center gap-1.5 flex-shrink-0">
                <CalendarPlus size={14} /> Schedule
              </button>
            </div>
          )
        })}
      </div>
      {more > 0 && (
        <button onClick={onOpenAll} className="mt-2 text-[13px] font-medium text-blue-700">and {more} more</button>
      )}
    </section>
  )
}

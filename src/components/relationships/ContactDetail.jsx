import { useState } from 'react'
import { ChevronLeft, Mail, Phone, Pencil, Check, PlayCircle, Plus, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Avatar, SectionLabel } from './bits'
import {
  STAGES, STAGE_ORDER, NETWORK_LABELS, SOURCES, DEMO_MASK,
  stageOf, segmentOf, touchStatus, touchLabel, meetingBlurb, lastContactDate,
  localDateOf, emailedForTouch, gmailThreadUrl,
} from '../../utils/relationships'
import { isCirclebackUrl } from '../../utils/circleback'
import { safeUrl } from '../../utils/safeUrl'
import { dateUtils, calUtils } from '../../utils/dateUtils'

const card = 'bg-white border border-surface-300 rounded-xl p-4 md:p-5'

function MeetingSourceTag({ meeting }) {
  if (meeting.source === 'circleback') {
    return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#FDECE6] text-[#A3360F]">Circleback</span>
  }
  if (meeting.source === 'manual' && !meeting.recordingUrl) {
    return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-200 text-navy-600">Logged</span>
  }
  if (meeting.source === 'notion_import') {
    return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-200 text-navy-600">From Notion</span>
  }
  return null
}

// The Notion import stores the person's People Directory page id (32 hex
// characters) as source_ref. Circleback and Gmail store their own ids there,
// which never match this shape.
const notionPageUrl = (ref) => (/^[0-9a-f]{32}$/.test(ref || '') ? `https://www.notion.so/${ref}` : null)

// Circleback imports link to the meeting page (notes, transcript, recording);
// anything else is a recording.
function MeetingLink({ url }) {
  const href = safeUrl(url)
  if (!url || href === '#') return null
  const circleback = isCirclebackUrl(url)
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 flex-shrink-0">
      {circleback ? <><ExternalLink size={13} /> Circleback</> : <><PlayCircle size={14} /> Recording</>}
    </a>
  )
}

// The summary shows by default; a Circleback import also carries the full
// notes, one tap away.
function FullNotes({ meeting, demoMode }) {
  const [open, setOpen] = useState(false)
  const summary = (meeting.summary || '').trim()
  let notes = (meeting.notes || '').trim()
  // Circleback notes open with the overview the summary already shows.
  const at = summary ? notes.indexOf(summary) : -1
  if (at >= 0 && at < 40) notes = notes.slice(at + summary.length).trim()
  if (!summary || !notes || notes === summary) return null
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-[13px] font-medium text-navy-600 hover:text-navy-900">
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? 'Hide full notes' : 'Full notes'}
      </button>
      {open && (
        <p className="mt-2 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap border-l-2 border-surface-300 pl-3">{demoMode ? DEMO_MASK : notes}</p>
      )}
    </div>
  )
}

function HistoryRow({ meeting, demoMode }) {
  const [open, setOpen] = useState(false)
  const blurb = meetingBlurb(meeting)
  const body = (meeting.summary || meeting.notes || '').trim()
  return (
    <div className="border-b border-surface-200 last:border-0">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex gap-3 py-3 text-left items-start">
        <span className="w-14 flex-shrink-0 text-[13px] text-navy-600 pt-px">{dateUtils.format(meeting.date, 'short')}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-navy-900">{meeting.title || 'Conversation'}</span>
            <MeetingSourceTag meeting={meeting} />
          </span>
          {!open && blurb && <span className="block text-[13px] text-navy-600 truncate">{demoMode ? DEMO_MASK : blurb}</span>}
        </span>
        {body && (open ? <ChevronUp size={15} className="text-navy-500 mt-0.5" /> : <ChevronDown size={15} className="text-navy-500 mt-0.5" />)}
      </button>
      {open && body && (
        <div className="pb-3 pl-[68px] pr-2">
          <p className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap">{demoMode ? DEMO_MASK : body}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <FullNotes meeting={meeting} demoMode={demoMode} />
            <MeetingLink url={meeting.recordingUrl} />
          </div>
        </div>
      )}
    </div>
  )
}

// One Gmail thread: when, subject, who wrote last. Headers only; the
// message itself opens in Gmail.
function EmailRow({ thread, firstName, account, demoMode }) {
  const day = localDateOf(thread.lastMessageAt)
  const who = thread.lastDirection === 'out' ? 'You wrote last' : `${firstName || 'They'} wrote last`
  const count = thread.messageCount > 1 ? ` · ${thread.messageCount} messages` : ''
  return (
    <div className="flex gap-3 py-3 border-b border-surface-200 last:border-0 items-start">
      <span className="w-14 flex-shrink-0 text-[13px] text-navy-600 pt-px">{dateUtils.format(day, 'short')}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-navy-900 truncate">{demoMode ? DEMO_MASK : (thread.subject || '(no subject)')}</span>
        <span className="block text-[13px] text-navy-600">{who}{count}</span>
      </span>
      <a href={gmailThreadUrl(thread.id, account)} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 flex-shrink-0 min-h-[32px]">
        <ExternalLink size={13} /> Gmail
      </a>
    </div>
  )
}

const EMAIL_SHOWN = 5

export function ContactDetail({
  contact, companies, contacts, linkedMeetings, linkedThreads = [], gmailAccount, openTasks, demoMode,
  onBack, onEdit, onStageChange, onConvert, onDone, onSnooze, onLog,
  onCompleteTask, onEditTask, onOpenContact, onOpenClient,
}) {
  const stage = stageOf(contact)
  const segment = segmentOf(contact)
  const company = companies.find(c => c.id === contact.companyId)
  const today = dateUtils.today()
  const status = touchStatus(contact.nextTouchOn, today)
  const last = linkedMeetings[0]
  const history = linkedMeetings.slice(1)
  const referrer = contacts.find(c => c.id === contact.referredBy)
  const referred = contacts.filter(c => c.referredBy === contact.id)
  const mask = (text) => (demoMode && text ? DEMO_MASK : text)
  const [allEmail, setAllEmail] = useState(false)
  const firstName = (contact.name || '').split(' ')[0]
  const emailedOn = emailedForTouch(contact, linkedThreads)
  const localToday = calUtils.localToday()
  const emailedLabel = emailedOn === localToday ? 'today' : emailedOn === calUtils.addDays(localToday, -1) ? 'yesterday' : `on ${dateUtils.format(emailedOn, 'short')}`
  const shownThreads = allEmail ? linkedThreads : linkedThreads.slice(0, EMAIL_SHOWN)
  const lastDate = lastContactDate(contact, linkedMeetings, linkedThreads)
  const subtitle = [contact.role, contact.company || (segment === 'clients' ? company?.name : '')].filter(Boolean).join(' · ')

  return (
    <div className="h-full overflow-y-auto">
      {onBack && (
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-surface-300 flex items-center justify-between px-2 py-1">
          <button onClick={onBack} className="flex items-center gap-0.5 px-2 min-h-[44px] font-display font-semibold text-navy-700">
            <ChevronLeft size={20} /> Back
          </button>
          <button onClick={onEdit} aria-label="Edit contact" className="w-11 h-11 flex items-center justify-center text-navy-600"><Pencil size={17} /></button>
        </div>
      )}

      <div className="px-4 md:px-8 py-5 md:py-6 space-y-4 max-w-3xl">
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex gap-3.5 items-center min-w-0">
            <Avatar contact={contact} company={company} size={52} />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-navy-900 text-[22px] md:text-2xl leading-tight">{contact.name}</h2>
              {subtitle && <p className="text-sm text-navy-600 mt-0.5">{subtitle}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <label htmlFor="detail-stage" className="sr-only">Stage</label>
                <select id="detail-stage" value={stage} onChange={e => onStageChange(e.target.value)}
                  className={`text-xs font-semibold pl-2.5 pr-7 py-1.5 rounded-full border appearance-none cursor-pointer bg-no-repeat bg-[right_8px_center] ${STAGES[stage].chip}`}
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
                  {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGES[s].label}</option>)}
                </select>
                {contact.networkLabel && <span className="text-xs text-navy-600">{NETWORK_LABELS[contact.networkLabel]}</span>}
                {segment === 'clients' && contact.becameClientOn && (
                  <span className="text-xs text-navy-600">Client since {dateUtils.format(contact.becameClientOn)}</span>
                )}
                {segment !== 'clients' && company && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${company.color}18`, color: company.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: company.color }} />{company.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {segment === 'leads' && (
              <button onClick={onConvert} className="btn-ghost px-3.5 py-2 text-sm font-display font-semibold min-h-[40px]">Convert to client</button>
            )}
            {segment === 'clients' && company && (
              <button onClick={() => onOpenClient(company)} className="btn-ghost px-3.5 py-2 text-sm font-display font-semibold min-h-[40px] flex items-center gap-1.5">
                <Building2 size={15} /> Open {company.name}
              </button>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`} className="btn-ghost w-10 h-10 flex items-center justify-center"><Mail size={16} /></a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="btn-ghost w-10 h-10 flex items-center justify-center"><Phone size={16} /></a>
            )}
            <button onClick={onEdit} aria-label="Edit contact" className="hidden md:flex btn-ghost w-10 h-10 items-center justify-center"><Pencil size={16} /></button>
          </div>
        </div>

        {/* Next touch */}
        <div className={`${card} ${status === 'overdue' ? 'border-[#F3C4C4]' : ''}`}>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0 flex-1 basis-56">
              <SectionLabel>Next touch</SectionLabel>
              <p className={`text-[13px] font-semibold mt-1 ${status === 'overdue' ? 'text-red-700' : 'text-navy-700'}`}>
                {status === 'overdue'
                  ? <span className="px-2 py-0.5 rounded-md bg-red-50">{touchLabel(contact.nextTouchOn, today)}</span>
                  : touchLabel(contact.nextTouchOn, today)}
              </p>
              {contact.nextTouchReason && <p className="text-[15px] font-medium text-navy-900 mt-1">{mask(contact.nextTouchReason)}</p>}
            </div>
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <button onClick={onDone} className="flex-1 sm:flex-none btn-primary px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 min-h-[44px]"><Check size={15} strokeWidth={2.5} /> Done</button>
              <button onClick={onSnooze} className="flex-1 sm:flex-none btn-ghost px-4 py-2.5 text-sm font-display font-semibold min-h-[44px]">{contact.nextTouchOn ? 'Snooze' : 'Set date'}</button>
            </div>
          </div>
          {emailedOn && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[10px] bg-forest-50 border border-[#B7E4C7] px-3 py-2">
              <p className="text-[13px] text-navy-800 flex items-center gap-1.5">
                <Mail size={13} className="text-forest-600 flex-shrink-0" /> You emailed {firstName || 'them'} {emailedLabel}. Was that this touch?
              </p>
              <button onClick={() => onDone(emailedOn)} className="text-[13px] font-semibold text-forest-700 min-h-[36px] px-1">Mark done</button>
            </div>
          )}
          <button onClick={onLog} className="mt-3 w-full min-h-[40px] rounded-[10px] border border-dashed border-surface-400 text-sm font-medium text-navy-600 hover:bg-surface-100 flex items-center justify-center gap-1.5">
            <Plus size={14} /> Log a conversation
          </button>
        </div>

        {/* Last conversation */}
        <div className={card}>
          <div className="flex justify-between items-baseline gap-3">
            <SectionLabel>Last conversation</SectionLabel>
            <MeetingLink url={last?.recordingUrl} />
          </div>
          {last ? (
            <div className="mt-2 space-y-2.5">
              <div>
                <p className="font-display font-semibold text-navy-900 text-[17px]">{last.title || 'Conversation'}</p>
                <p className="text-[13px] text-navy-600 mt-0.5">
                  {dateUtils.format(last.date, 'long')}
                  {last.source === 'circleback' ? ' · from Circleback' : last.source === 'manual' && !last.recordingUrl ? ' · logged' : ''}
                </p>
              </div>
              {(last.summary || last.notes) && (
                <p className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap">{mask((last.summary || last.notes).trim())}</p>
              )}
              <FullNotes key={last.id} meeting={last} demoMode={demoMode} />
              {(last.actionItems || []).length > 0 && (
                <div className="border-t border-surface-200 pt-2.5 space-y-1.5">
                  <p className="text-xs font-semibold text-navy-600">Action items</p>
                  {last.actionItems.map(ai => (
                    <p key={ai.id} className={`text-sm flex items-center gap-2 ${ai.done ? 'text-navy-500 line-through' : 'text-navy-800'}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${ai.done ? 'bg-gold-500 border-gold-500' : 'border-surface-400'}`}>{ai.done && <Check size={11} className="text-navy-900" strokeWidth={3} />}</span>
                      {demoMode ? DEMO_MASK : ai.title}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-navy-600 mt-2">No meetings yet. Log a conversation above, or paste a Circleback link there, to start the history.</p>
          )}
        </div>

        {/* Email, from the hourly Gmail sync */}
        {linkedThreads.length > 0 && (
          <div className={card}>
            <div className="flex justify-between items-baseline gap-3">
              <SectionLabel>Email · {linkedThreads.length}</SectionLabel>
              <span className="text-xs text-navy-500">From Gmail, every hour</span>
            </div>
            <div className="mt-1">
              {shownThreads.map(t => <EmailRow key={t.id} thread={t} firstName={firstName} account={gmailAccount} demoMode={demoMode} />)}
            </div>
            {linkedThreads.length > EMAIL_SHOWN && (
              <button onClick={() => setAllEmail(v => !v)} aria-expanded={allEmail}
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-navy-600 hover:text-navy-900 min-h-[32px]">
                {allEmail ? <><ChevronUp size={14} /> Show fewer</> : <><ChevronDown size={14} /> Show all {linkedThreads.length}</>}
              </button>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Profile */}
          <div className={card}>
            <div className="flex justify-between items-center">
              <SectionLabel>Profile</SectionLabel>
              <button onClick={onEdit} className="text-[13px] font-medium text-navy-600 hover:text-navy-900">Edit</button>
            </div>
            <p className="text-sm text-navy-700 leading-relaxed mt-2 whitespace-pre-wrap">
              {contact.notes ? mask(contact.notes) : <span className="text-navy-500">Who they are and what matters to them. Add it from Edit.</span>}
            </p>
          </div>

          {/* Open tasks */}
          <div className={card}>
            <SectionLabel>Open tasks · {openTasks.length}</SectionLabel>
            {openTasks.length === 0 ? (
              <p className="text-sm text-navy-500 mt-2">Nothing open from your meetings with {(contact.name || '').split(' ')[0] || 'them'}.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {openTasks.map(t => {
                  const overdue = t.dueDate && t.dueDate < today
                  return (
                    <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-[10px] border border-surface-300">
                      <button onClick={() => onCompleteTask(t.id)} aria-label={demoMode ? 'Complete task' : `Complete ${t.title}`} className="w-[18px] h-[18px] mt-0.5 rounded-full border-2 border-surface-400 hover:border-forest-500 flex-shrink-0" />
                      <button onClick={() => onEditTask(t)} className="text-left min-w-0">
                        <span className="block text-sm font-medium text-navy-900">{demoMode ? DEMO_MASK : t.title}</span>
                        {t.dueDate && <span className={`block text-xs ${overdue ? 'text-red-700 font-semibold' : 'text-navy-600'}`}>Due {dateUtils.format(t.dueDate, 'short')}</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Meeting history */}
        {history.length > 0 && (
          <div className={card}>
            <SectionLabel className="mb-1">Earlier conversations · {history.length}</SectionLabel>
            {history.map(m => <HistoryRow key={m.id} meeting={m} demoMode={demoMode} />)}
          </div>
        )}

        {/* Details */}
        <div className={card}>
          <SectionLabel className="mb-3">Details</SectionLabel>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {contact.email && <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-navy-600">Email</dt><dd className="truncate"><a href={`mailto:${contact.email}`} className="text-blue-700">{contact.email}</a></dd></div>}
            {contact.phone && <div><dt className="text-xs text-navy-600">Phone</dt><dd>{contact.phone}</dd></div>}
            <div><dt className="text-xs text-navy-600">Last contact</dt><dd>{lastDate ? dateUtils.format(lastDate) : 'Not yet'}</dd></div>
            {contact.source && <div><dt className="text-xs text-navy-600">Source</dt><dd>{SOURCES[contact.source] || contact.source}</dd></div>}
            {referrer && <div><dt className="text-xs text-navy-600">Referred by</dt><dd><button onClick={() => onOpenContact(referrer.id)} className="text-blue-700">{referrer.name}</button></dd></div>}
            {company && <div><dt className="text-xs text-navy-600">Client / Area</dt><dd>{company.name}</dd></div>}
            {contact.createdAt && <div><dt className="text-xs text-navy-600">Added</dt><dd>{dateUtils.format(contact.createdAt.split('T')[0])}</dd></div>}
            {notionPageUrl(contact.sourceRef) && (
              <div><dt className="text-xs text-navy-600">Notion page</dt>
                <dd><a href={notionPageUrl(contact.sourceRef)} target="_blank" rel="noreferrer" className="text-blue-700">Open archive</a></dd>
              </div>
            )}
            {referred.length > 0 && (
              <div className="col-span-2"><dt className="text-xs text-navy-600">Introduced you to</dt>
                <dd className="flex flex-wrap gap-x-3">{referred.map(r => <button key={r.id} onClick={() => onOpenContact(r.id)} className="text-blue-700">{r.name}</button>)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}

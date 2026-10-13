import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft, Mail, Phone, MoreHorizontal, Check, PlayCircle, Plus, Building2, ChevronDown, ChevronUp,
  ExternalLink, Sparkles, RefreshCw, CalendarPlus, CalendarDays, PenLine, MessageSquare, Gift, Loader2, AlertCircle, Users, StickyNote, X,
} from 'lucide-react'
import { Avatar } from './bits'
import {
  STAGES, BUSINESS_STAGES, REFERRAL_STAGES, NETWORK_LABELS, SOURCES, DEMO_MASK,
  stageOf, segmentOf, referralStageOf, isPartner, meetingBlurb, lastContactDate, localDateOf, firstNameOf,
  gmailThreadUrl, gmailComposeUrl, historyItems, whoWroteLast, clientHistoryLabel, rewardsOwed, hasSigned,
  money, timeRange, fallbackStep, fallbackSummary, lastTouch, emailsOf, shortDay, lower, sameTaskTitle, notesOf, daysBetween,
} from '../../utils/relationships'
import { isCirclebackUrl } from '../../utils/circleback'
import { safeUrl } from '../../utils/safeUrl'
import { dateUtils, calUtils } from '../../utils/dateUtils'
import { genId } from '../../utils/ids'

const card = 'bg-white border border-surface-300 rounded-[14px]'
const chipSelect = 'text-xs font-semibold pl-2.5 pr-7 py-1.5 rounded-full border appearance-none cursor-pointer bg-no-repeat bg-[right_8px_center] min-h-[32px]'
const caret = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }

// ── small pieces ─────────────────────────────────────────────

function SourceTag({ kind, meeting }) {
  if (kind === 'email') return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#E8F0FE] text-[#1D4ED8]">Email</span>
  if (meeting?.source === 'circleback') return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#FDECE6] text-[#A3360F]">Circleback</span>
  return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-200 text-navy-600">Logged</span>
}

// Circleback imports link to the meeting page (notes, transcript, recording);
// anything else is a recording.
function MeetingLink({ url }) {
  const href = safeUrl(url)
  if (!url || href === '#') return null
  const circleback = isCirclebackUrl(url)
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 flex-shrink-0 min-h-[32px]">
      {circleback ? <><ExternalLink size={13} /> Circleback</> : <><PlayCircle size={14} /> Recording</>}
    </a>
  )
}

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
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-[13px] font-medium text-navy-600 hover:text-navy-900 min-h-[32px]">
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? 'Hide full notes' : 'Full notes'}
      </button>
      {open && (
        <p className="mt-2 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap border-l-2 border-surface-300 pl-3">{demoMode ? DEMO_MASK : notes}</p>
      )}
    </div>
  )
}

function HistoryMeeting({ meeting, demoMode }) {
  const [open, setOpen] = useState(false)
  const blurb = meetingBlurb(meeting)
  const body = (meeting.summary || meeting.notes || '').trim()
  return (
    <div className="border-b border-surface-200 last:border-0">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex gap-3 py-3 text-left items-start">
        <span className="w-12 flex-shrink-0 text-[13px] text-navy-600 pt-px">{dateUtils.format(meeting.date, 'short')}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-navy-900">{meeting.title || 'Conversation'}</span>
            <SourceTag kind="meeting" meeting={meeting} />
          </span>
          {!open && blurb && <span className="block text-[13px] text-navy-600 truncate">{demoMode ? DEMO_MASK : blurb}</span>}
        </span>
        {body && (open ? <ChevronUp size={15} className="text-navy-500 mt-0.5" /> : <ChevronDown size={15} className="text-navy-500 mt-0.5" />)}
      </button>
      {open && body && (
        <div className="pb-3 pl-[60px] pr-2">
          <p className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap">{demoMode ? DEMO_MASK : body}</p>
          {(meeting.actionItems || []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {meeting.actionItems.map(ai => (
                <li key={ai.id} className={`text-[13px] flex items-center gap-2 ${ai.done ? 'text-navy-500 line-through' : 'text-navy-800'}`}>
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${ai.done ? 'bg-gold-500 border-gold-500' : 'border-surface-400'}`}>{ai.done && <Check size={10} className="text-navy-900" strokeWidth={3} />}</span>
                  {demoMode ? DEMO_MASK : ai.title}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <FullNotes meeting={meeting} demoMode={demoMode} />
            <MeetingLink url={meeting.recordingUrl} />
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryEmail({ thread, firstName, account, demoMode }) {
  const day = localDateOf(thread.lastMessageAt)
  const count = thread.messageCount > 1 ? ` · ${thread.messageCount} messages` : ''
  return (
    <a href={gmailThreadUrl(thread.id, account)} target="_blank" rel="noreferrer" className="flex gap-3 py-3 border-b border-surface-200 last:border-0 items-start text-navy-900 no-underline">
      <span className="w-12 flex-shrink-0 text-[13px] text-navy-600 pt-px">{dateUtils.format(day, 'short')}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-navy-900">{demoMode ? DEMO_MASK : (thread.subject || '(no subject)')}</span>
          <SourceTag kind="email" />
        </span>
        <span className="block text-[13px] text-navy-600">{whoWroteLast(thread, firstName)}{count}</span>
      </span>
      <ExternalLink size={13} className="text-blue-700 mt-1 flex-shrink-0" aria-label="Opens in Gmail" />
    </a>
  )
}

// A collapsed row with a one-line preview. Children show when open.
function Fold({ id, title, count, countTone = 'neutral', preview, open, onToggle, children, last }) {
  return (
    <div className={last ? '' : 'border-b border-surface-200'}>
      <button onClick={() => onToggle(id)} aria-expanded={open} aria-controls={`fold-${id}`}
        className="w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left min-h-[60px]">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy-900">{title}</span>
            {count != null && (
              <span className={`text-xs font-semibold px-[7px] rounded-full ${countTone === 'referral' ? 'bg-[#F1ECFD] text-[#5B21B6]' : 'bg-surface-200 text-navy-600'}`}>{count}</span>
            )}
          </span>
          {!open && preview && <span className="block text-[13px] text-navy-600 truncate">{preview}</span>}
        </span>
        {open ? <ChevronUp size={16} className="text-navy-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-navy-500 flex-shrink-0" />}
      </button>
      {open && <div id={`fold-${id}`} className="px-4 md:px-5 pb-4">{children}</div>}
    </div>
  )
}

function MoreMenu({ items, label = 'More actions', buttonClass = 'btn-ghost w-10 h-10 flex items-center justify-center' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label}
        className={buttonClass}><MoreHorizontal size={17} /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-56 bg-white border border-surface-300 rounded-xl shadow-modal py-1">
          {items.filter(Boolean).map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick() }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-navy-800 hover:bg-surface-100 min-h-[44px]">
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DateTile({ start }) {
  const d = new Date(start && start.includes('T') ? start : `${start}T12:00:00`)
  return (
    <div className="w-12 h-[54px] flex-shrink-0 rounded-[10px] border border-[#FBE3B4] bg-white flex flex-col items-center justify-center" aria-hidden="true">
      <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#8A5500]">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      <span className="font-display text-xl font-bold text-navy-900 leading-none mt-0.5">{d.getDate()}</span>
    </div>
  )
}

// ── Referrals ───────────────────────────────────────────────

function RewardControl({ referral, partner, demoMode, onSetReward, onMarkPaid }) {
  const [amount, setAmount] = useState('')
  if (!hasSigned(referral)) {
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-surface-200 text-navy-600">{STAGES[stageOf(referral)]?.label || 'Not sorted'}</span>
  }
  if (!isPartner(partner)) {
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-forest-100 text-forest-700">Signed</span>
  }
  if (referral.rewardPaidOn) {
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-forest-100 text-forest-700">Paid {dateUtils.format(referral.rewardPaidOn, 'short')}</span>
  }
  if (referral.rewardAmount == null || referral.rewardAmount === '') {
    return (
      <form onSubmit={e => { e.preventDefault(); if (Number(amount) > 0) onSetReward(referral.id, Number(amount)) }} className="flex items-center gap-1.5">
        <label htmlFor={`rw-${referral.id}`} className="sr-only">Reward for {referral.name}</label>
        <input id={`rw-${referral.id}`} inputMode="decimal" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$ owed"
          className="w-24 input-base px-2.5 py-1.5 text-sm" />
        <button type="submit" disabled={!(Number(amount) > 0)} className="btn-ghost px-3 min-h-[36px] text-[13px] font-semibold disabled:opacity-50">Save</button>
      </form>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#FEF6E4] text-[#7A4E00]">{demoMode ? 'Owed' : `${money(referral.rewardAmount)} owed`}</span>
      <button onClick={() => onMarkPaid(referral.id)} className="text-[13px] font-semibold text-forest-700 min-h-[36px] px-1">Mark paid</button>
    </span>
  )
}

function ReferralsBody({ contact, referrals, demoMode, onUpdate, onSetReward, onMarkPaid, onOpenContact, onInvite }) {
  const [editing, setEditing] = useState(false)
  const [terms, setTerms] = useState(contact.referralTerms || '')
  const ref = referralStageOf(contact)
  const signed = referrals.filter(hasSigned)
  const owed = signed.filter(r => isPartner(contact) && !r.rewardPaidOn)
  const owedTotal = owed.reduce((n, r) => n + (Number(r.rewardAmount) || 0), 0)
  const paidTotal = signed.filter(r => r.rewardPaidOn).reduce((n, r) => n + (Number(r.rewardAmount) || 0), 0)
  return (
    <div className="space-y-3">
      {ref ? (
        <div className="rounded-[10px] border border-[#E6DEFB] bg-[#F7F5FE] px-3 py-2.5 space-y-1">
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-semibold text-[#5B21B6]">
              {ref === 'partner'
                ? (contact.partnerSince ? `Partner since ${dateUtils.format(contact.partnerSince)}` : 'Referral partner')
                : (contact.invitedOn ? `Invited ${dateUtils.format(contact.invitedOn)}` : 'Invited')}
            </span>
            {!editing && <button onClick={() => { setTerms(contact.referralTerms || ''); setEditing(true) }} className="text-xs font-medium text-blue-700 min-h-[32px]">{contact.referralTerms ? 'Edit terms' : 'Add terms'}</button>}
          </div>
          {editing ? (
            <div className="space-y-2">
              <label htmlFor={`terms-${contact.id}`} className="sr-only">Reward terms</label>
              <textarea id={`terms-${contact.id}`} value={terms} onChange={e => setTerms(e.target.value)} rows={2} placeholder="10% of the first engagement, paid when they sign"
                className="w-full input-base px-3 py-2 text-sm resize-none bg-white" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="btn-ghost px-3 min-h-[36px] text-[13px]">Cancel</button>
                <button onClick={() => { onUpdate({ referralTerms: terms.trim() }); setEditing(false) }} className="btn-primary px-3 min-h-[36px] text-[13px]">Save terms</button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-navy-800">{contact.referralTerms ? (demoMode ? DEMO_MASK : `Reward: ${contact.referralTerms}`) : 'No reward terms yet.'}</p>
          )}
          <p className="text-[13px] text-navy-600">
            {referrals.length} sent · {signed.length} signed
            {isPartner(contact) && !demoMode && (owedTotal > 0 || paidTotal > 0) ? ` · ${money(owedTotal)} owed · ${money(paidTotal)} paid` : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-surface-100 px-3 py-2.5">
          <p className="text-[13px] text-navy-700">{referrals.length} sent you {referrals.length === 1 ? 'one person' : 'people'}. No reward agreement yet.</p>
          <button onClick={onInvite} className="text-[13px] font-semibold text-[#5B21B6] min-h-[36px]">Invite as partner</button>
        </div>
      )}
      {referrals.length === 0 ? (
        <p className="text-sm text-navy-500">Nobody sent yet. People you add with "Referred by {firstNameOf(contact)}" show up here.</p>
      ) : (
        <ul className="divide-y divide-surface-200">
          {referrals.map(r => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <button onClick={() => onOpenContact(r.id)} className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-semibold text-navy-900 truncate">{r.name || r.email}</span>
                <span className="block text-xs text-navy-600 truncate">
                  {[r.company, r.becameClientOn ? `Client since ${dateUtils.format(r.becameClientOn, 'short')}` : ''].filter(Boolean).join(' · ')}
                </span>
              </button>
              <RewardControl referral={r} partner={contact} demoMode={demoMode} onSetReward={onSetReward} onMarkPaid={onMarkPaid} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Next step card ──────────────────────────────────────────

const btnPrimary = 'btn-primary min-h-[46px] px-4 text-sm font-display font-semibold flex items-center justify-center gap-1.5'
const btnSecondary = 'min-h-[46px] px-4 rounded-[10px] border border-[#F5D9A0] bg-white text-navy-800 text-sm font-display font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-100'

// onUsed: the step was acted on (task added, Gmail opened), so it can make
// way for the next one.
function StepAction({ step, contact, firstName, gmailAccount, onSchedule, onAddTask, onInvite, onUsed = () => {}, primary = true, small = false }) {
  const cls = small
    ? 'min-h-[36px] px-3 rounded-lg bg-[#FEF6E4] text-[#7A4E00] text-[13px] font-semibold flex-shrink-0'
    : `${primary ? btnPrimary : btnSecondary} flex-[3]`
  if (step.kind === 'email') {
    const href = step.threadId ? gmailThreadUrl(step.threadId, gmailAccount)
      : gmailComposeUrl({ to: contact.email || '', subject: '', body: '', account: gmailAccount })
    return <a href={href} target="_blank" rel="noreferrer" onClick={() => onUsed(step.title)} className={`${cls} no-underline`}>{!small && <Mail size={15} />}Open in Gmail</a>
  }
  if (step.kind === 'task') {
    return <button onClick={() => { onAddTask({ title: step.title, dueDate: step.dueInDays ? calUtils.addDays(calUtils.localToday(), step.dueInDays) : '' }); onUsed(step.title) }} className={cls}>{!small && <Plus size={15} />}{small ? 'Add task' : 'Add as task'}</button>
  }
  if (step.kind === 'invite') {
    return <button onClick={onInvite} className={cls}>{!small && <Gift size={15} />}Invite as partner</button>
  }
  return <button onClick={() => onSchedule({ step })} className={cls}>{!small && <CalendarPlus size={15} />}{small ? 'Schedule' : 'Schedule it'}</button>
}

function NextStepCard({
  contact, firstName, toLog, overdueTask, owed, booked, ai, aiState, last, gmailAccount, demoMode, contactsById,
  onLog, onDismissToLog, onCompleteTask, onEditTask, onSetReward, onMarkPaid, onSchedule, onAddTask, onInvite,
  onRefresh, onAnother, onQuietAddTask, onQuietAddNote, openTasks = [], contacts = [], onUpdate, onMerge, aiFresh = true, onUsedStep,
  onSetMine, onDismissStep,
}) {
  const [rewardAmount, setRewardAmount] = useState('')
  const mask = (t) => (demoMode && t ? DEMO_MASK : t)
  // A suggestion built before the latest change (a task added, notes
  // logged) is out of date: show the rule-based one until the new one comes.
  const aiNow = aiFresh ? ai : null
  // Steps you removed, and the one you wrote yourself, hold whatever the AI
  // says next.
  const dismissed = ai?.dismissed || []
  const mine = ai?.mine?.title ? ai.mine : null
  // Anything already on their task list isn't a new idea.
  const aiSteps = (aiNow?.steps || []).filter(s => s && s.title && !dismissed.includes(s.title)
    && !openTasks.some(t => sameTaskTitle(t.title, s.title)))
  const fallback = fallbackStep(contact, { last, firstName })
  const suggestion = aiSteps[0] || (dismissed.includes(fallback.title) ? null : fallback)

  // Writing or changing the next step.
  const [draft, setDraft] = useState(null) // { kind, title, due, from }
  const stepToDraft = (s, from) => ({
    kind: { schedule: 'schedule', email: 'email', task: 'task' }[s?.kind] || 'reminder',
    title: s?.title || '',
    due: s?.due || s?.day || (s?.dueInDays != null ? calUtils.addDays(calUtils.localToday(), s.dueInDays) : ''),
    from: from || '',
  })
  const saveDraft = (e) => {
    e?.preventDefault()
    const title = (draft?.title || '').trim()
    if (!title) return
    onSetMine({ kind: draft.kind, title, due: draft.due || '', setAt: new Date().toISOString() }, { dismiss: draft.from && draft.from !== title ? draft.from : '' })
    setDraft(null)
  }
  // Your own step as something StepAction can act on.
  const mineAsStep = mine && {
    kind: mine.kind, title: mine.title, eventTitle: mine.title, minutes: 30, day: mine.due || '', fromMine: true,
    dueInDays: mine.due ? Math.max(0, daysBetween(calUtils.localToday(), mine.due) ?? 0) : undefined,
  }
  const prep = aiSteps.find(s => s.kind !== 'schedule')
  const summary = aiNow?.summary || fallbackSummary(contact, { last, firstName })
  const partnerOwed = owed[0]

  // Highest first: notes to add, an overdue task, a reward owed, the booked
  // touch, then the suggestion.
  const queue = []
  if (toLog[0]) queue.push({ mode: 'log', item: toLog[0], line: `Add notes from ${toLog[0].title || 'your meeting'}` })
  if (overdueTask) queue.push({ mode: 'task', task: overdueTask, line: `Finish: ${mask(overdueTask.title)}` })
  if (mine) queue.push({ mode: 'mine', step: mine, line: mask(mine.title) })
  if (partnerOwed) queue.push({ mode: 'reward', referral: partnerOwed, line: `Send ${firstName} the reward for ${partnerOwed.company || partnerOwed.name}` })
  if (booked) queue.push({ mode: 'booked', event: booked, line: `${booked.title} on ${shortDay(localDateOf(booked.start))}` })
  else if (suggestion) queue.push({ mode: 'suggest', step: suggestion, line: mask(suggestion.title) })
  else queue.push({ mode: 'empty', line: '' })
  const current = queue[0]
  const upNext = queue[1]

  const label = {
    log: { icon: <PenLine size={14} />, text: 'To log' },
    task: { icon: <AlertCircle size={14} />, text: 'Overdue task' },
    reward: { icon: <Gift size={14} />, text: 'Reward owed' },
    booked: { icon: <CalendarDays size={14} />, text: 'Next step · booked' },
    suggest: { icon: <Sparkles size={14} />, text: aiSteps.length ? 'Suggested next step' : 'Next step' },
    mine: { icon: <PenLine size={14} />, text: 'Your next step' },
    empty: { icon: <Sparkles size={14} />, text: 'Next step' },
  }[current.mode]
  const shownLabel = draft ? { icon: <PenLine size={14} />, text: draft.from || mine ? 'Change next step' : 'Your next step' } : label
  const referralTag = current.mode === 'reward' || (current.mode === 'suggest' && current.step.kind === 'invite')
  const canRefresh = !draft && (current.mode === 'suggest' || current.mode === 'booked' || current.mode === 'empty')
  const stepMenu = draft ? [] : current.mode === 'suggest' ? [
    { label: 'Change this step', icon: <PenLine size={15} className="text-navy-500" />, onClick: () => setDraft(stepToDraft(current.step, current.step.title)) },
    { label: 'Remove this suggestion', icon: <X size={15} className="text-navy-500" />, onClick: () => onDismissStep(current.step.title) },
    { label: 'Write my own', icon: <Plus size={15} className="text-navy-500" />, onClick: () => setDraft(stepToDraft(null)) },
  ] : current.mode === 'mine' ? [
    { label: 'Edit my next step', icon: <PenLine size={15} className="text-navy-500" />, onClick: () => setDraft(stepToDraft(mine)) },
    { label: 'Remove my next step', icon: <X size={15} className="text-navy-500" />, onClick: () => onSetMine(null) },
  ] : current.mode === 'empty' ? [] : [
    { label: 'Set my own next step', icon: <PenLine size={15} className="text-navy-500" />, onClick: () => setDraft(stepToDraft(null)) },
  ]

  const partnerThanks = partnerOwed ? gmailComposeUrl({
    to: contact.email || '',
    subject: `Thank you for sending ${partnerOwed.name || 'them'} my way`,
    body: `Hi ${firstName},\n\n${firstNameOf(partnerOwed)} signed on, and I wanted you to hear it from me first. Thank you for the introduction.${partnerOwed.rewardAmount ? `\n\nAs promised, your thank-you of ${money(partnerOwed.rewardAmount)} is on its way.` : ''}\n\n`,
    account: gmailAccount,
  }) : ''

  return (
    <section aria-label="Next step" className="rounded-2xl border border-[#FBE3B4] bg-gold-50 p-[18px] md:p-6 space-y-3">
      <div className="flex justify-between items-center -mt-1.5 -mr-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-display font-bold text-[11px] uppercase tracking-[0.08em] text-[#8A5500]">{shownLabel.icon}{shownLabel.text}</span>
          {referralTag && <span className="text-[11px] font-semibold px-[7px] py-px rounded-full bg-[#F1ECFD] text-[#5B21B6]">Referral</span>}
        </div>
        <div className="flex items-center">
          {canRefresh && (
            <button onClick={onRefresh} disabled={aiState?.loading} aria-label="Refresh suggestion" className="w-9 h-9 flex items-center justify-center text-[#8A5500] rounded-lg hover:bg-[#FEF6E4] disabled:opacity-60">
              {aiState?.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          )}
          {stepMenu.length > 0 && (
            <MoreMenu items={stepMenu} label="Change or remove the next step"
              buttonClass="w-9 h-9 flex items-center justify-center text-[#8A5500] rounded-lg hover:bg-[#FEF6E4]" />
          )}
          {!canRefresh && !stepMenu.length && <span className="h-9" />}
        </div>
      </div>

      {draft && (
        <form onSubmit={saveDraft} className="space-y-3">
          <div>
            <label htmlFor={`mine-title-${contact.id}`} className="block text-xs font-semibold text-[#6B4300] mb-1">Next step with {firstName}</label>
            <input id={`mine-title-${contact.id}`} value={draft.title} autoFocus onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder={`What's next with ${firstName}?`} className="w-full input-base bg-white px-3 min-h-[46px] text-[15px]" />
          </div>
          <div role="group" aria-label="What kind of step" className="flex flex-wrap gap-1.5">
            {[['reminder', 'Reminder'], ['schedule', 'Meeting'], ['email', 'Email'], ['task', 'Task']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })}
                className={`min-h-[36px] px-3 rounded-full border text-[13px] font-semibold ${draft.kind === k ? 'border-[#A86800] bg-white text-[#7A4E00]' : 'border-[#F5D9A0] bg-transparent text-navy-600'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-navy-700">
            By when <span className="text-navy-500">(optional)</span>
            <input type="date" min={calUtils.localToday()} value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })}
              className="input-base bg-white px-2 min-h-[38px] text-sm" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={!draft.title.trim()} className={`${btnPrimary} flex-[3] disabled:opacity-50`}><Check size={15} />Save</button>
            <button type="button" onClick={() => setDraft(null)} className={`${btnSecondary} flex-[2]`}>Cancel</button>
          </div>
        </form>
      )}

      {!draft && current.mode === 'log' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">Add notes from {current.item.title ? `"${current.item.title}"` : 'your meeting'}</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            {dateUtils.format(current.item.day, 'long')}{timeRange(current.item.start, current.item.end) ? ` · ${timeRange(current.item.start, current.item.end)}` : ''}. No Circleback recording or notes came in for it.
          </p>
          <div className="flex gap-2 pt-0.5">
            <button onClick={() => onLog({ date: current.item.day, title: current.item.title, calendarEventId: current.item.eventId, contactIds: current.item.contactIds })} className={`${btnPrimary} flex-[3]`}><PenLine size={15} />Log it</button>
            <button onClick={() => onDismissToLog(current.item.eventId)} className={`${btnSecondary} flex-[2]`}>Nothing to log</button>
          </div>
        </>
      )}

      {!draft && current.mode === 'task' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">{mask(current.task.title)}</h2>
          <p className="text-sm text-navy-700">Was due {dateUtils.format(current.task.dueDate, 'long')}.</p>
          <div className="flex gap-2 pt-0.5">
            <button onClick={() => onCompleteTask(current.task.id)} className={`${btnPrimary} flex-[3]`}><Check size={15} strokeWidth={2.5} />Done</button>
            <button onClick={() => onEditTask(current.task)} className={`${btnSecondary} flex-[2]`}>Open task</button>
          </div>
        </>
      )}

      {!draft && current.mode === 'reward' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">
            {current.referral.rewardAmount != null && current.referral.rewardAmount !== ''
              ? `Send ${firstName} ${demoMode ? 'the' : money(current.referral.rewardAmount)} reward for ${current.referral.company || current.referral.name}`
              : `Set ${firstName}'s reward for ${current.referral.company || current.referral.name}`}
          </h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            {current.referral.name} signed{current.referral.becameClientOn ? ` on ${dateUtils.format(current.referral.becameClientOn, 'short')}` : ''}.
            {contact.referralTerms ? ` ${firstName}'s terms: ${mask(contact.referralTerms)}.` : ` No terms saved for ${firstName} yet.`}
          </p>
          {current.referral.rewardAmount != null && current.referral.rewardAmount !== '' ? (
            <div className="flex gap-2 pt-0.5">
              <a href={partnerThanks} target="_blank" rel="noreferrer" className={`${btnPrimary} flex-[3] no-underline`}><Mail size={15} />Draft thank-you</a>
              <button onClick={() => onMarkPaid(current.referral.id)} className={`${btnSecondary} flex-[2]`}>Mark paid</button>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (Number(rewardAmount) > 0) onSetReward(current.referral.id, Number(rewardAmount)) }} className="flex gap-2 pt-0.5">
              <label htmlFor="reward-amount" className="sr-only">Reward amount</label>
              <input id="reward-amount" type="number" min="0" inputMode="decimal" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} placeholder="Amount owed, $"
                className="flex-[3] min-w-0 input-base px-3 min-h-[46px] text-sm bg-white" />
              <button type="submit" disabled={!(Number(rewardAmount) > 0)} className={`${btnPrimary} flex-[2] disabled:opacity-50`}>Save</button>
            </form>
          )}
        </>
      )}

      {!draft && current.mode === 'booked' && (
        <>
          <div className="flex gap-3 items-start">
            <DateTile start={current.event.start} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-bold text-navy-900 text-lg md:text-xl leading-snug">{current.event.title}</h2>
              <p className="text-[13px] text-navy-700 mt-0.5">
                {dateUtils.format(localDateOf(current.event.start), 'long')}{timeRange(current.event.start, current.event.end) ? ` · ${timeRange(current.event.start, current.event.end)}` : ''}
              </p>
              <p className="text-xs text-navy-600 mt-0.5">
                {(() => {
                  const guests = (current.event.attendees || []).map(lower).filter(a => a && a !== lower(current.event.selfEmail))
                  const who = emailsOf(contact).some(e => guests.includes(e)) ? `${firstName} invited`
                    : guests.length ? `${guests.length} ${guests.length === 1 ? 'guest' : 'guests'} invited` : 'Reminder for you'
                  return [who, current.event.meetLink ? 'Google Meet' : ''].filter(Boolean).join(' · ')
                })()}
              </p>
            </div>
          </div>
          {/* Only events you organize, read from the calendar (not the saved
              stand-in), can be moved here. */}
          {((!current.event.cached && current.event.organizerSelf) || current.event.htmlLink) && (
            <div className="flex gap-2">
              {!current.event.cached && current.event.organizerSelf && <button onClick={() => onSchedule({ event: current.event })} className={`${btnSecondary} flex-1`}>Reschedule</button>}
              {current.event.htmlLink && <a href={current.event.htmlLink} target="_blank" rel="noreferrer" className={`${btnSecondary} flex-1 no-underline`}>Calendar <ExternalLink size={13} /></a>}
            </div>
          )}
          {current.event.suggestEmail && (() => {
            const dup = current.event.suggestMergeId ? contacts.find(p => p.id === current.event.suggestMergeId) : null
            const save = () => onUpdate(contact.email
              ? { otherEmails: [...new Set([...(contact.otherEmails || []), current.event.suggestEmail])] }
              : { email: current.event.suggestEmail })
            return (
              <div className="flex gap-2.5 items-center rounded-[10px] bg-white border border-[#FBE3B4] pl-3 pr-1.5 py-2">
                <Mail size={15} className="text-[#A86800] flex-shrink-0" />
                <span className="flex-1 min-w-0 text-[13px] text-navy-800">
                  {dup
                    ? <>The invite went to <span className="font-medium break-all">{current.event.suggestEmail}</span>, who's waiting in Needs review. Same person?</>
                    : <>The invite went to <span className="font-medium break-all">{current.event.suggestEmail}</span>. Save it as {firstName}'s email?</>}
                </span>
                {dup
                  ? <button onClick={() => onMerge(dup)} className="min-h-[36px] px-3 rounded-lg text-[13px] font-display font-semibold text-blue-700 hover:bg-surface-100 flex-shrink-0">Merge</button>
                  : <button onClick={save} className="min-h-[36px] px-3 rounded-lg text-[13px] font-display font-semibold text-blue-700 hover:bg-surface-100 flex-shrink-0">Save</button>}
              </div>
            )
          })()}
          {prep && (
            <div className="flex gap-2.5 items-center rounded-[10px] bg-white border border-[#FBE3B4] pl-3 pr-1.5 py-2">
              <Sparkles size={15} className="text-[#A86800] flex-shrink-0" />
              <span className="flex-1 min-w-0 text-[13px] text-navy-800">{mask(prep.title)}</span>
              <StepAction step={prep} contact={contact} firstName={firstName} gmailAccount={gmailAccount} onSchedule={onSchedule} onAddTask={onAddTask} onInvite={onInvite} onUsed={onUsedStep} small />
            </div>
          )}
        </>
      )}

      {!draft && current.mode === 'suggest' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">{mask(current.step.title)}</h2>
          <p className="text-sm text-navy-700 leading-relaxed">{mask(aiNow?.summary ? summary : (current.step.why || summary))}</p>
          <div className="flex gap-2 pt-0.5">
            <StepAction step={current.step} contact={contact} firstName={firstName} gmailAccount={gmailAccount} onSchedule={onSchedule} onAddTask={onAddTask} onInvite={onInvite} onUsed={onUsedStep} />
            <button onClick={() => onAnother(current.step.title)} disabled={aiState?.loading} className={`${btnSecondary} flex-[2] disabled:opacity-60`}>Another idea</button>
          </div>
          {aiState?.error && <p className="text-xs text-[#7A4E00]">{aiState.error}</p>}
        </>
      )}

      {!draft && current.mode === 'mine' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">{mask(mine.title)}</h2>
          <p className="text-sm text-navy-700">
            {[mine.due ? `By ${shortDay(mine.due)}` : '', `Set by you${mine.setAt ? ` on ${dateUtils.format(localDateOf(mine.setAt), 'short')}` : ''}`].filter(Boolean).join(' · ')}
          </p>
          <div className="flex gap-2 pt-0.5">
            {mine.kind === 'reminder' || mine.kind === 'invite'
              ? <button onClick={() => onSetMine(null)} className={`${btnPrimary} flex-[3]`}><Check size={15} />Done</button>
              : <StepAction step={mineAsStep} contact={contact} firstName={firstName} gmailAccount={gmailAccount} onSchedule={onSchedule} onAddTask={onAddTask} onInvite={onInvite}
                  onUsed={() => { if (mine.kind === 'task') onSetMine(null) }} />}
            {mine.kind === 'reminder' || mine.kind === 'invite'
              ? <button onClick={() => setDraft(stepToDraft(mine))} className={`${btnSecondary} flex-[2]`}>Edit</button>
              : <button onClick={() => onSetMine(null)} className={`${btnSecondary} flex-[2]`}>Done</button>}
          </div>
        </>
      )}

      {!draft && current.mode === 'empty' && (
        <>
          <h2 className="font-display font-bold text-navy-900 text-xl md:text-[22px] leading-snug">No next step for {firstName}</h2>
          <p className="text-sm text-navy-700">Write your own, or ask for a fresh suggestion.</p>
          <div className="flex gap-2 pt-0.5">
            <button onClick={() => setDraft(stepToDraft(null))} className={`${btnPrimary} flex-[3]`}><PenLine size={15} />Write my own</button>
            <button onClick={onRefresh} disabled={aiState?.loading} className={`${btnSecondary} flex-[2] disabled:opacity-60`}>Suggest one</button>
          </div>
          {aiState?.error && <p className="text-xs text-[#7A4E00]">{aiState.error}</p>}
        </>
      )}

      {!draft && upNext && current.mode !== 'suggest' && current.mode !== 'booked' && current.mode !== 'empty' && (
        <p className="text-[13px] text-navy-600 pt-1"><span className="font-semibold text-[#6B4300]">Up next</span> {upNext.line}</p>
      )}

      <div className="flex border-t border-[#F5E3BD] -mx-1.5 -mb-2 pt-0.5">
        <button onClick={() => onLog()} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-[13px] font-medium text-navy-600 hover:text-navy-900">
          <MessageSquare size={14} /> <span>Log<span className="hidden sm:inline"> a conversation</span></span>
        </button>
        <button onClick={onQuietAddNote} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-[13px] font-medium text-navy-600 hover:text-navy-900">
          <StickyNote size={14} /> Add a note
        </button>
        <button onClick={onQuietAddTask} className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-[13px] font-medium text-navy-600 hover:text-navy-900">
          <Plus size={14} /> Add a task
        </button>
      </div>
    </section>
  )
}

// ── Page ────────────────────────────────────────────────────

export function ContactDetail({
  contact, companies, contacts, linkedMeetings, linkedThreads = [], gmailAccount, openTasks, demoMode,
  toLog = [], booked = null, duplicates = [], aiState = {},
  onBack, onEdit, onStageChange, onReferralStageChange, onConvert, onMerge, onNotSame,
  onLog, onDismissToLog, onSchedule, onInvite, onAddTask, onCompleteTask, onEditTask,
  onOpenContact, onOpenClient, onUpdate, onSetReward, onMarkPaid, onRefreshStep, onAnotherStep,
  aiFresh = true, onUsedStep = () => {}, onSetMine = () => {}, onDismissStep = () => {},
}) {
  const stage = stageOf(contact)
  const segment = segmentOf(contact)
  const ref = referralStageOf(contact)
  const company = companies.find(c => c.id === contact.companyId)
  const firstName = firstNameOf(contact)
  const today = calUtils.localToday()
  const referrer = contacts.find(c => c.id === contact.referredBy)
  const referrals = contacts.filter(c => c.referredBy === contact.id)
  const owed = rewardsOwed(contact, contacts)
  const overdueTask = openTasks.find(t => t.dueDate && t.dueDate < today)
  const last = lastTouch(linkedMeetings, linkedThreads)
  const lastDate = lastContactDate(contact, linkedMeetings, linkedThreads)
  const history = historyItems(linkedMeetings, linkedThreads)
  const subtitle = [contact.role, contact.company || (segment === 'clients' ? company?.name : '')].filter(Boolean).join(' · ')
  const history_ = clientHistoryLabel(contact)
  const mask = (text) => (demoMode && text ? DEMO_MASK : text)

  const [openFolds, setOpenFolds] = useState(() => new Set())
  const [historyFilter, setHistoryFilter] = useState('all')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const taskInput = useRef(null)
  const toggle = (id) => setOpenFolds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openAddTask = () => {
    setOpenFolds(s => new Set([...s, 'tasks']))
    setTimeout(() => taskInput.current?.focus(), 30)
  }

  // Notes: dated, newest first, kept on the contact.
  const notes = notesOf(contact)
  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState(null)   // { id, text }
  const [deletingNote, setDeletingNote] = useState(null) // id
  const noteInput = useRef(null)
  const openAddNote = () => {
    setOpenFolds(s => new Set([...s, 'notes']))
    setTimeout(() => noteInput.current?.focus(), 30)
  }
  const saveNotes = (list) => onUpdate({ notesLog: list })
  const addNote = (e) => {
    e?.preventDefault()
    const text = noteText.trim()
    if (!text) return
    saveNotes([{ id: genId('note'), at: new Date().toISOString(), text }, ...notes])
    setNoteText('')
  }
  const saveEdit = () => {
    const text = (editingNote?.text || '').trim()
    if (!text) return
    saveNotes(notes.map(n => (n.id === editingNote.id ? { ...n, text, editedAt: new Date().toISOString() } : n)))
    setEditingNote(null)
  }
  const deleteNote = (id) => { saveNotes(notes.filter(n => n.id !== id)); setDeletingNote(null) }
  const submitOnCmdEnter = (fn) => (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); fn() } }
  const submitTask = (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    onAddTask({ title: taskTitle.trim(), dueDate: taskDue })
    setTaskTitle(''); setTaskDue('')
  }

  const shownHistory = history.filter(h => historyFilter === 'all' || (historyFilter === 'meetings' ? h.kind === 'meeting' : h.kind === 'email'))
  const meetingsCount = history.filter(h => h.kind === 'meeting').length
  const emailCount = history.length - meetingsCount
  const lastPreview = last
    ? (last.kind === 'email'
      ? `Last: email, ${dateUtils.format(last.date, 'short')} · ${whoWroteLast(last.thread, firstName)}`
      : `Last: ${demoMode ? 'meeting' : (last.meeting.title || 'conversation')}, ${dateUtils.format(last.date, 'short')}`)
    : 'Nothing logged yet'
  const signedCount = referrals.filter(hasSigned).length
  const owedTotal = owed.reduce((n, r) => n + (Number(r.rewardAmount) || 0), 0)
  const showReferrals = !!ref || referrals.length > 0

  const aboutPreview = [
    contact.notes ? mask(contact.notes.split('\n')[0]) : '',
    referrer ? `Referred by ${referrer.name}` : '',
    company && segment !== 'clients' ? company.name : '',
  ].filter(Boolean).join(' · ') || 'Profile and details'

  const moreItems = [
    { label: 'Edit contact', icon: <PenLine size={15} className="text-navy-500" />, onClick: onEdit },
    segment === 'leads' && { label: 'Convert to client', icon: <Building2 size={15} className="text-navy-500" />, onClick: onConvert },
    segment === 'clients' && company && { label: `Open ${company.name}`, icon: <Building2 size={15} className="text-navy-500" />, onClick: () => onOpenClient(company) },
    !ref && { label: 'Invite as referral partner', icon: <Gift size={15} className="text-navy-500" />, onClick: onInvite },
    { label: 'Merge with someone', icon: <Users size={15} className="text-navy-500" />, onClick: () => onMerge(null) },
  ]

  return (
    <div className="h-full overflow-y-auto">
      {onBack && (
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-surface-300 flex items-center justify-between px-2 py-1">
          <button onClick={onBack} className="flex items-center gap-0.5 px-2 min-h-[44px] font-display font-semibold text-navy-700">
            <ChevronLeft size={20} /> Back
          </button>
          <div className="flex items-center">
            {contact.email && <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`} className="w-11 h-11 flex items-center justify-center text-navy-600"><Mail size={18} /></a>}
            {contact.phone && <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="w-11 h-11 flex items-center justify-center text-navy-600"><Phone size={18} /></a>}
            <MoreMenu items={moreItems} />
          </div>
        </div>
      )}

      <div className="px-4 md:px-10 py-4 md:py-8 space-y-4 md:space-y-5 max-w-3xl">
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex gap-3 items-center min-w-0">
            <Avatar contact={contact} company={company} size={48} />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-navy-900 text-[22px] md:text-2xl leading-tight">{contact.name || contact.email}</h2>
              {subtitle && <p className="text-sm text-navy-600 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className={`${onBack ? 'hidden md:flex' : 'flex'} gap-1.5 items-center`}>
            {contact.email && <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`} className="btn-ghost w-10 h-10 flex items-center justify-center"><Mail size={16} /></a>}
            {contact.phone && <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="btn-ghost w-10 h-10 flex items-center justify-center"><Phone size={16} /></a>}
            <MoreMenu items={moreItems} />
          </div>
          <div className="w-full flex flex-wrap items-center gap-1.5 -mt-1">
            <label htmlFor={`stage-${contact.id}`} className="sr-only">Business stage</label>
            <select id={`stage-${contact.id}`} value={stage} onChange={e => onStageChange(e.target.value)}
              className={`${chipSelect} ${STAGES[stage].chip}`} style={caret}>
              {stage === 'needs_review' && <option value="needs_review">Needs review</option>}
              {BUSINESS_STAGES.map(s => <option key={s} value={s}>{STAGES[s].label}</option>)}
            </select>
            {ref && (
              <>
                <label htmlFor={`ref-${contact.id}`} className="sr-only">Referral stage</label>
                <select id={`ref-${contact.id}`} value={ref} onChange={e => onReferralStageChange(e.target.value || null)}
                  className={`${chipSelect} ${REFERRAL_STAGES[ref].chip}`} style={caret}>
                  <option value="invited">Invited</option>
                  <option value="partner">Referral partner</option>
                  <option value="">Not a partner</option>
                </select>
              </>
            )}
            {contact.networkLabel && NETWORK_LABELS[contact.networkLabel] && <span className="text-xs text-navy-600 px-1">{NETWORK_LABELS[contact.networkLabel]}</span>}
            {history_ && <span className="text-xs text-navy-600 px-1">{history_}</span>}
            {segment === 'clients' && contact.becameClientOn && stage === 'client' && <span className="text-xs text-navy-600 px-1">Client since {dateUtils.format(contact.becameClientOn)}</span>}
          </div>
        </div>

        {/* Looks like someone else you have */}
        {duplicates.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#C7D8FB] bg-[#F3F7FE] px-3.5 py-2.5">
            <p className="flex-1 min-w-[180px] text-[13px] text-navy-800">
              Looks like the same person as <button onClick={() => onOpenContact(duplicates[0].id)} className="font-semibold text-blue-700">{duplicates[0].name || duplicates[0].email}</button>
              {duplicates[0].email ? ` (${duplicates[0].email})` : ''}.
            </p>
            <button onClick={() => onMerge(duplicates[0])} className="text-[13px] font-semibold text-blue-700 min-h-[36px] px-1">Merge</button>
            <button onClick={() => onNotSame(duplicates[0].id)} className="text-[13px] font-medium text-navy-600 min-h-[36px] px-1">Not the same</button>
          </div>
        )}

        <NextStepCard
          contact={contact} firstName={firstName} toLog={toLog} overdueTask={overdueTask} owed={owed} booked={booked}
          ai={contact.nextStep} aiState={aiState} last={last} gmailAccount={gmailAccount} demoMode={demoMode}
          onLog={onLog} onDismissToLog={onDismissToLog} onCompleteTask={onCompleteTask} onEditTask={onEditTask}
          onSetReward={onSetReward} onMarkPaid={onMarkPaid} onSchedule={onSchedule} onAddTask={onAddTask} onInvite={onInvite}
          onRefresh={onRefreshStep} onAnother={onAnotherStep} onQuietAddTask={openAddTask} onQuietAddNote={openAddNote}
          openTasks={openTasks} contacts={contacts} onUpdate={onUpdate} onMerge={onMerge}
          aiFresh={aiFresh} onUsedStep={onUsedStep} onSetMine={onSetMine} onDismissStep={onDismissStep}
        />

        {/* Everything else, folded */}
        <div className={card}>
          {showReferrals && (
            <Fold id="referrals" title="Referrals" count={referrals.length} countTone="referral" open={openFolds.has('referrals')} onToggle={toggle}
              preview={<>{signedCount} signed{owedTotal > 0 && !demoMode ? <> · <span className="font-semibold text-[#7A4E00]">{money(owedTotal)} reward owed</span></> : owed.length ? <> · <span className="font-semibold text-[#7A4E00]">reward to set</span></> : null}</>}>
              <ReferralsBody contact={contact} referrals={referrals} demoMode={demoMode} onUpdate={onUpdate}
                onSetReward={onSetReward} onMarkPaid={onMarkPaid} onOpenContact={onOpenContact} onInvite={onInvite} />
            </Fold>
          )}

          <Fold id="tasks" title="Open tasks" count={openTasks.length} open={openFolds.has('tasks')} onToggle={toggle}
            preview={openTasks[0] ? `${mask(openTasks[0].title)}${openTasks[0].dueDate ? ` · ${openTasks[0].dueDate < today ? 'overdue' : `due ${dateUtils.format(openTasks[0].dueDate, 'weekday')}`}` : ''}` : 'Nothing open'}>
            <div className="space-y-2">
              {openTasks.map(t => {
                const overdue = t.dueDate && t.dueDate < today
                return (
                  <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-[10px] border border-surface-300">
                    <button onClick={() => onCompleteTask(t.id)} aria-label={demoMode ? 'Complete task' : `Complete ${t.title}`} className="w-5 h-5 mt-0.5 rounded-full border-2 border-surface-400 hover:border-forest-500 flex-shrink-0" />
                    <button onClick={() => onEditTask(t)} className="text-left min-w-0 flex-1">
                      <span className="block text-sm font-medium text-navy-900">{mask(t.title)}</span>
                      <span className={`block text-xs ${overdue ? 'text-red-700 font-semibold' : 'text-navy-600'}`}>
                        {[t.dueDate ? `Due ${dateUtils.format(t.dueDate, 'short')}` : '', t.contactId === contact.id ? 'Added here' : 'From a meeting'].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </div>
                )
              })}
              <form onSubmit={submitTask} className="flex gap-2 items-center pt-1">
                <label htmlFor={`add-task-${contact.id}`} className="sr-only">Add a task for {firstName}</label>
                <input id={`add-task-${contact.id}`} ref={taskInput} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder={`Add a task for ${firstName}`}
                  className="flex-1 min-w-0 input-base px-3 min-h-[42px] text-sm" />
                <label htmlFor={`add-task-due-${contact.id}`} className="sr-only">Due date</label>
                <input id={`add-task-due-${contact.id}`} type="date" value={taskDue} min={today} onChange={e => setTaskDue(e.target.value)}
                  className="w-[132px] input-base px-2 min-h-[42px] text-sm" />
                <button type="submit" disabled={!taskTitle.trim()} className="px-3.5 min-h-[42px] rounded-[10px] bg-navy-900 text-white text-sm font-display font-semibold disabled:opacity-40">Add</button>
              </form>
            </div>
          </Fold>

          <Fold id="notes" title="Notes" count={notes.length} open={openFolds.has('notes')} onToggle={toggle}
            preview={notes[0] ? `${dateUtils.format(localDateOf(notes[0].at), 'short')} · ${mask(notes[0].text.split('\n')[0])}` : `Add what you learn about ${firstName}`}>
            <div className="space-y-3">
              <form onSubmit={addNote} className="space-y-2">
                <label htmlFor={`add-note-${contact.id}`} className="sr-only">Add a note about {firstName}</label>
                <textarea id={`add-note-${contact.id}`} ref={noteInput} value={noteText} rows={noteText.length > 80 ? 4 : 2}
                  onChange={e => setNoteText(e.target.value)} onKeyDown={submitOnCmdEnter(addNote)}
                  placeholder={`Add a note about ${firstName}`}
                  className="w-full input-base px-3 py-2.5 text-sm resize-y" />
                <div className="flex justify-end">
                  <button type="submit" disabled={!noteText.trim()} className="px-3.5 min-h-[40px] rounded-[10px] bg-navy-900 text-white text-sm font-display font-semibold disabled:opacity-40">Save note</button>
                </div>
              </form>
              {notes.map(n => (
                <div key={n.id} className="rounded-[10px] border border-surface-300 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-navy-600">
                      {dateUtils.format(localDateOf(n.at), 'short')}{n.editedAt ? ' · edited' : ''}
                    </p>
                    {editingNote?.id !== n.id && (
                      deletingNote === n.id ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => deleteNote(n.id)} className="text-xs font-semibold text-red-700 min-h-[32px] px-2">Delete</button>
                          <button onClick={() => setDeletingNote(null)} className="text-xs font-medium text-navy-600 min-h-[32px] px-2">Keep</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <button onClick={() => { setEditingNote({ id: n.id, text: n.text }); setDeletingNote(null) }} className="text-xs font-medium text-navy-600 hover:text-navy-900 min-h-[32px] px-2">Edit</button>
                          <button onClick={() => setDeletingNote(n.id)} aria-label="Delete note" className="text-xs font-medium text-navy-600 hover:text-red-700 min-h-[32px] px-2">Delete</button>
                        </span>
                      )
                    )}
                  </div>
                  {editingNote?.id === n.id ? (
                    <div className="mt-1.5 space-y-2">
                      <label htmlFor={`edit-note-${n.id}`} className="sr-only">Edit note</label>
                      <textarea id={`edit-note-${n.id}`} value={editingNote.text} autoFocus rows={3}
                        onChange={e => setEditingNote({ ...editingNote, text: e.target.value })} onKeyDown={submitOnCmdEnter(saveEdit)}
                        className="w-full input-base px-3 py-2 text-sm resize-y" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingNote(null)} className="px-3 min-h-[36px] text-sm text-navy-600">Cancel</button>
                        <button onClick={saveEdit} disabled={!editingNote.text.trim()} className="px-3.5 min-h-[36px] rounded-[10px] bg-navy-900 text-white text-sm font-display font-semibold disabled:opacity-40">Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-navy-800 leading-relaxed mt-1 whitespace-pre-wrap break-words">{mask(n.text)}</p>
                  )}
                </div>
              ))}
            </div>
          </Fold>

          <Fold id="history" title="History" count={history.length} open={openFolds.has('history')} onToggle={toggle} preview={lastPreview}>
            {history.length === 0 ? (
              <p className="text-sm text-navy-600">No meetings or email yet. Log a conversation, paste a Circleback link, or wait for the hourly Gmail sync.</p>
            ) : (
              <>
                <div role="group" aria-label="Show" className="flex gap-1.5 mb-1 text-xs font-semibold">
                  {[['all', 'All'], ['meetings', `Meetings ${meetingsCount}`], ['email', `Email ${emailCount}`]].map(([k, l]) => (
                    <button key={k} aria-pressed={historyFilter === k} onClick={() => setHistoryFilter(k)}
                      className={`min-h-[32px] px-3 rounded-full border ${historyFilter === k ? 'border-navy-900 bg-navy-900 text-white' : 'border-surface-300 bg-white text-navy-600'}`}>{l}</button>
                  ))}
                </div>
                {shownHistory.map(h => h.kind === 'meeting'
                  ? <HistoryMeeting key={h.id} meeting={h.meeting} demoMode={demoMode} />
                  : <HistoryEmail key={h.id} thread={h.thread} firstName={firstName} account={gmailAccount} demoMode={demoMode} />)}
              </>
            )}
          </Fold>

          <Fold id="about" title={`About ${firstName}`} open={openFolds.has('about')} onToggle={toggle} preview={aboutPreview} last>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-navy-600">Profile</p>
                  <button onClick={onEdit} className="text-[13px] font-medium text-navy-600 hover:text-navy-900 min-h-[32px]">Edit</button>
                </div>
                <p className="text-sm text-navy-700 leading-relaxed mt-1 whitespace-pre-wrap">
                  {contact.notes ? mask(contact.notes) : <span className="text-navy-500">Who they are and what matters to them. Add it from Edit.</span>}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {emailsOf(contact).length > 0 && (
                  <div className="col-span-2"><dt className="text-xs text-navy-600">Email</dt>
                    <dd className="flex flex-col">{emailsOf(contact).map(e => <a key={e} href={`mailto:${e}`} className="text-blue-700 truncate">{e}</a>)}</dd>
                  </div>
                )}
                {contact.phone && <div><dt className="text-xs text-navy-600">Phone</dt><dd>{contact.phone}</dd></div>}
                <div><dt className="text-xs text-navy-600">Last contact</dt><dd>{lastDate ? dateUtils.format(lastDate) : 'Not yet'}</dd></div>
                {contact.source && <div><dt className="text-xs text-navy-600">Source</dt><dd>{SOURCES[contact.source] || contact.source}</dd></div>}
                {referrer && <div><dt className="text-xs text-navy-600">Referred by</dt><dd><button onClick={() => onOpenContact(referrer.id)} className="text-blue-700">{referrer.name}</button></dd></div>}
                {company && <div><dt className="text-xs text-navy-600">Client / Area</dt><dd>{company.name}</dd></div>}
                {contact.becameClientOn && <div><dt className="text-xs text-navy-600">Client</dt><dd>{dateUtils.format(contact.becameClientOn, 'short')}{contact.clientUntil ? ` to ${dateUtils.format(contact.clientUntil)}` : stage === 'client' ? ' to now' : ''}</dd></div>}
                {contact.createdAt && <div><dt className="text-xs text-navy-600">Added</dt><dd>{dateUtils.format(contact.createdAt.split('T')[0])}</dd></div>}
              </dl>
            </div>
          </Fold>
        </div>
      </div>
    </div>
  )
}

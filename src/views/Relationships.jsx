import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Search, Inbox, ChevronDown, ChevronUp, Users, CalendarPlus, SlidersHorizontal, Gift, PenLine } from 'lucide-react'
import { Avatar } from '../components/relationships/bits'
import { ContactDetail } from '../components/relationships/ContactDetail'
import { ContactForm } from '../components/relationships/ContactForm'
import { ConvertSheet } from '../components/relationships/ConvertSheet'
import { ReviewSheet } from '../components/relationships/ReviewSheet'
import { LogConversationModal } from '../components/relationships/LogConversationModal'
import { ScheduleSheet } from '../components/relationships/ScheduleSheet'
import { InviteSheet } from '../components/relationships/InviteSheet'
import { MergeSheet } from '../components/relationships/MergeSheet'
import {
  STAGES, STAGE_ORDER, SEGMENTS,
  stageOf, segmentOf, referralStageOf, tabsFor, meetingsForContact,
  lastContactDate, openTasksForContact, companyNameFor, sortContacts, hiddenInDemo,
  threadsForContact, lastTouch, referralsOf, allRewardsOwed, duplicatesOf, notSameKey,
  nextStepBasis, shortDay, localDateOf, firstNameOf, money, sameTaskTitle, isNotesTask,
} from '../utils/relationships'
import { buildBrief, fetchNextStep } from '../utils/nextStepAI'
import { dateUtils, calUtils } from '../utils/dateUtils'
import { genId as makeId } from '../utils/ids'

const GROUP_LABELS = { stage: 'Stage', company: 'Company', referral: 'Partner status', none: 'None' }
const GROUPS_FOR = { leads: ['stage', 'company', 'none'], clients: ['company', 'stage', 'none'], network: ['referral', 'company', 'none'] }
const SORT_LABELS = { next: 'Next touch', last: 'Last contact', name: 'Name' }

// The AI next step function stays off for the rest of the session once
// Supabase says it isn't deployed, or it can't be reached twice in a row
// while online (an undeployed function fails the browser's CORS check).
let aiUnavailable = false
let aiUnreachable = 0

function ContactRow({ contact, company, tab, booked, toLog, lastDate, referralCount, selected, onSelect }) {
  const ref = referralStageOf(contact)
  const second = [
    contact.company || (segmentOf(contact) === 'clients' ? company?.name : '') || (contact.role ? '' : 'Independent'),
    tab === 'network' && segmentOf(contact) === 'leads' ? 'also a lead' : '',
    tab === 'network' && segmentOf(contact) === 'clients' ? (stageOf(contact) === 'client' ? 'also a client' : 'past client') : '',
    tab !== 'network' && ref === 'partner' ? 'referral partner' : '',
  ].filter(Boolean).join(' · ')

  let right = null
  if (toLog) right = <span className="text-xs font-semibold text-[#8A5500] flex items-center gap-1"><PenLine size={11} />To log</span>
  else if (tab === 'network' && ref === 'partner') right = <span className="text-xs text-navy-600">{referralCount ? `${referralCount} sent` : 'None yet'}</span>
  else if (tab === 'network' && ref === 'invited') right = <span className="text-xs text-navy-600">{contact.invitedOn ? `Invited ${dateUtils.format(contact.invitedOn, 'short')}` : 'Invited'}</span>
  else if (booked) right = <span className="text-xs text-navy-600">{shortDay(localDateOf(booked.start))}</span>
  else if (tab !== 'network') right = <span className="text-xs font-semibold text-[#8A5500]">Not booked</span>
  else if (lastDate) right = <span className="text-xs text-navy-600">{dateUtils.format(lastDate, 'short')}</span>

  return (
    <button onClick={() => onSelect(contact.id)} aria-current={selected ? 'true' : undefined}
      className={`w-full flex gap-3 items-center px-2.5 py-2.5 rounded-[10px] text-left transition-colors border ${selected ? 'border-gold-500 bg-gold-50' : 'border-transparent hover:bg-surface-100'}`}>
      <Avatar contact={contact} company={company} size={32} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-navy-900 truncate">{contact.name || contact.email}</span>
        {second && <span className="block text-xs text-navy-600 truncate">{second}</span>}
      </span>
      <span className="flex-shrink-0">{right}</span>
    </button>
  )
}

function ListMenu({ tab, group, setGroup, sort, setSort }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true"
        className="min-h-[40px] px-3 rounded-[10px] border border-surface-300 bg-white text-navy-700 text-[13px] flex items-center gap-1.5">
        <SlidersHorizontal size={14} /> Filter
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-56 bg-white border border-surface-300 rounded-xl shadow-modal p-3 space-y-3">
          <label className="block text-xs font-semibold text-navy-600">Group by
            <select value={group} onChange={e => setGroup(e.target.value)} className="mt-1 w-full input-base px-2.5 py-2 text-sm font-normal">
              {GROUPS_FOR[tab].map(k => <option key={k} value={k}>{GROUP_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-navy-600">Sort by
            <select value={sort} onChange={e => setSort(e.target.value)} className="mt-1 w-full input-base px-2.5 py-2 text-sm font-normal">
              {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <p className="text-xs text-navy-500">The client filter at the top of the app narrows this list too.</p>
        </div>
      )}
    </div>
  )
}

export function Relationships({
  contacts, allContacts, companies, meetings, tasks, demoMode, emailThreads = [], gmailAccount,
  focusContactId, focusAction, onFocusHandled, userEmail, ignore,
  google, bookedById = {}, toLogByContact = {}, notSame = [], referralProgram = {},
  onAdd, onUpdate, onUpdateMany, onDelete,
  onAddMeeting, onUpdateMeeting, onAddCompany, onDeleteCompany,
  onAddTask, onCompleteTask, onEditTask, onOpenClient, onIgnoreEmails, onNotSame, onDismissToLog,
  onMerge, onScheduled, onSaveProgram, showToast,
}) {
  const [tab, setTab] = useState('leads')
  const [group, setGroup] = useState('stage')
  const [sort, setSort] = useState('next')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const [form, setForm] = useState(null)          // { contact?, defaultStage }
  const [reviewOpen, setReviewOpen] = useState(false)
  const [convertId, setConvertId] = useState(null)
  const [log, setLog] = useState(null)            // { contactId, prefill? } — null contactId logs from the header
  const [schedule, setSchedule] = useState(null)  // { contactId, step?, event? }
  const [inviteId, setInviteId] = useState(null)
  const [merge, setMerge] = useState(null)        // { contactId, candidate? }
  const [aiState, setAiState] = useState({})      // contactId -> { loading, error }
  const inFlight = useRef(new Set())

  const people = useMemo(() => (allContacts || contacts).filter(c => !hiddenInDemo(c, demoMode)), [allContacts, contacts, demoMode])
  const visible = useMemo(() => contacts.filter(c => !hiddenInDemo(c, demoMode)), [contacts, demoMode])
  const peopleById = useMemo(() => Object.fromEntries(people.map(c => [c.id, c])), [people])

  const linkedById = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = meetingsForContact(c, meetings) })
    return map
  }, [people, meetings])

  const threadsById = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = threadsForContact(c, emailThreads) })
    return map
  }, [people, emailThreads])

  const lastDates = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = lastContactDate(c, linkedById[c.id] || [], threadsById[c.id] || []) })
    return map
  }, [people, linkedById, threadsById])

  const openTasksById = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = openTasksForContact(c, linkedById[c.id] || [], tasks) })
    return map
  }, [people, linkedById, tasks])

  const referralCounts = useMemo(() => {
    const map = {}
    people.forEach(c => { if (c.referredBy) map[c.referredBy] = (map[c.referredBy] || 0) + 1 })
    return map
  }, [people])

  const reviewQueue = visible.filter(c => stageOf(c) === 'needs_review')
  const counts = Object.fromEntries(SEGMENTS.map(s => [s.id, visible.filter(c => tabsFor(c).includes(s.id)).length]))
  const owedAll = useMemo(() => allRewardsOwed(people), [people])

  const pickTab = (id) => {
    const seg = SEGMENTS.find(s => s.id === id)
    setTab(id); setGroup(seg.defaultGroup); setSort(seg.defaultSort); setShowPast(false)
  }

  // Jump to a person from Today, the calendar, or a link; maybe open a sheet.
  useEffect(() => {
    if (!focusContactId) return
    const c = people.find(x => x.id === focusContactId)
    if (c) {
      const tabs = tabsFor(c)
      if (tabs.length && !tabs.includes(tab)) pickTab(tabs[0])
      setSelectedId(c.id)
      setMobileDetail(true)
      if (focusAction?.type === 'log') setLog({ contactId: c.id, prefill: focusAction.prefill || null })
      if (focusAction?.type === 'schedule') setSchedule({ contactId: c.id })
    }
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusContactId])

  const q = search.trim().toLowerCase()
  const inTab = visible
    .filter(c => tabsFor(c).includes(tab))
    .filter(c => !q || [c.name, c.company, c.email, c.role, ...(c.otherEmails || [])].some(v => (v || '').toLowerCase().includes(q)))

  const groups = useMemo(() => {
    const isPast = (c) => stageOf(c) === 'past_client'
    const main = tab === 'clients' ? inTab.filter(c => !isPast(c)) : inTab
    const past = tab === 'clients' ? inTab.filter(isPast) : []
    let out = []
    if (group === 'stage') {
      out = STAGE_ORDER.filter(s => STAGES[s].segment === tab && s !== 'past_client')
        .map(s => ({ key: s, label: STAGES[s].label, items: main.filter(c => stageOf(c) === s) }))
    } else if (group === 'referral') {
      out = [
        { key: 'partner', label: 'Partners', tone: 'referral', items: main.filter(c => referralStageOf(c) === 'partner') },
        { key: 'invited', label: 'Invited', items: main.filter(c => referralStageOf(c) === 'invited') },
        { key: 'rest', label: 'Everyone else', items: main.filter(c => !referralStageOf(c)) },
      ]
    } else if (group === 'company') {
      const byName = new Map()
      main.forEach(c => {
        const name = companyNameFor(c, companies)
        if (!byName.has(name)) byName.set(name, [])
        byName.get(name).push(c)
      })
      out = [...byName.entries()]
        .sort((a, b) => (a[0] === 'Independent') - (b[0] === 'Independent') || a[0].localeCompare(b[0]))
        .map(([name, items]) => {
          const record = companies.find(co => co.name === name)
          return { key: `co:${name}`, label: name, color: record?.color, items }
        })
    } else {
      out = [{ key: 'all', label: null, items: main }]
    }
    out = out.filter(g => g.items.length > 0).map(g => ({ ...g, items: sortContacts(g.items, sort, lastDates) }))
    return { list: out, past: sortContacts(past, sort, lastDates) }
  }, [inTab, tab, group, sort, companies, lastDates])

  const flatOrder = [...groups.list.flatMap(g => g.items), ...(showPast ? groups.past : [])]
  const selected = people.find(c => c.id === selectedId)
  const desktopContact = selected || flatOrder[0] || null
  const shownContact = mobileDetail && selected ? selected : desktopContact

  const select = (id) => { setSelectedId(id); setMobileDetail(true) }
  const showMobileDetail = mobileDetail && !!selected
  const contactById = (id) => peopleById[id]

  // ── AI next step ──
  const contextFor = (c) => ({
    linkedMeetings: linkedById[c.id] || [],
    linkedThreads: threadsById[c.id] || [],
    openTasks: openTasksById[c.id] || [],
    booked: bookedById[c.id] || null,
    referrals: referralsOf(c, people),
    referrer: peopleById[c.referredBy],
    company: companies.find(co => co.id === c.companyId),
  })
  const basisFor = (c) => {
    const ctx = contextFor(c)
    return nextStepBasis(c, { last: lastTouch(ctx.linkedMeetings, ctx.linkedThreads), openTasks: ctx.openTasks, booked: ctx.booked, referrals: ctx.referrals })
  }

  const requestStep = async (c, { force = false, dismissed } = {}) => {
    if (!c || stageOf(c) === 'needs_review') return
    if (aiUnavailable) {
      if (force) showToast?.({ message: 'New ideas come from the AI next step, which isn\'t set up in Supabase yet.', duration: 5000 })
      return
    }
    const basis = basisFor(c)
    if (!force && c.nextStep?.basis === basis) return
    if (inFlight.current.has(c.id)) return
    inFlight.current.add(c.id)
    setAiState(s => ({ ...s, [c.id]: { loading: true } }))
    const keepDismissed = dismissed || c.nextStep?.dismissed || []
    const r = await fetchNextStep(buildBrief(c, { ...contextFor(c), dismissed: keepDismissed }))
    inFlight.current.delete(c.id)
    aiUnreachable = r.ok ? 0 : r.code === 'unreachable' ? aiUnreachable + 1 : aiUnreachable
    if (aiUnreachable >= 2) aiUnavailable = true
    if (r.ok) {
      onUpdate(c.id, { nextStep: { summary: r.summary, steps: r.steps, basis, generatedAt: new Date().toISOString(), dismissed: keepDismissed } })
      setAiState(s => ({ ...s, [c.id]: { loading: false } }))
    } else {
      // Not deployed, or deployed without what it needs: stop asking this session.
      if (['not_deployed', 'forbidden', 'no_owner', 'no_key'].includes(r.code)) aiUnavailable = true
      const notThere = r.code === 'not_deployed' || aiUnavailable
      setAiState(s => ({ ...s, [c.id]: { loading: false, error: force && !notThere ? (r.error && r.code?.startsWith('ai_') ? r.error : "Couldn't get a new suggestion. Try again in a minute.") : null } }))
      if (force && notThere) showToast?.({ message: 'New ideas come from the AI next step, which isn\'t set up in Supabase yet.', duration: 5000 })
    }
  }

  // Ask again when the person on screen has something new.
  const shownBasis = shownContact ? basisFor(shownContact) : ''
  useEffect(() => {
    if (shownContact) requestStep(shownContact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownContact?.id, shownBasis])

  const anotherStep = (c, title) => {
    const ns = c.nextStep
    const dismissed = [...new Set([...(ns?.dismissed || []), title])]
    const open = openTasksById[c.id] || []
    const left = (ns?.steps || []).filter(s => !dismissed.includes(s.title) && !open.some(t => sameTaskTitle(t.title, s.title)))
    if (ns && left.length && ns.basis === basisFor(c)) onUpdate(c.id, { nextStep: { ...ns, dismissed } })
    else requestStep(c, { force: true, dismissed })
  }

  // A step you acted on (task added, Gmail opened) is done as a suggestion:
  // it's left out from now on, and the AI is told not to repeat it.
  const usedStep = (c, title) => {
    const ns = c.nextStep
    if (!ns || !title) return
    onUpdate(c.id, { nextStep: { ...ns, dismissed: [...new Set([...(ns.dismissed || []), title])] } })
  }

  // ── actions ──
  const handleSaveForm = (data) => {
    if (data.id) {
      const before = contactById(data.id)
      // Stopped being a client: remember when, for "Client in 2025".
      if (before && stageOf(before) === 'client' && data.stage !== 'client') data.clientUntil = calUtils.localToday()
      onUpdate(data.id, data)
    } else {
      const created = onAdd(data)
      if (created) {
        const tabs = tabsFor(created)
        if (tabs.length && !tabs.includes(tab)) pickTab(tabs[0])
        setSelectedId(created.id)
        setMobileDetail(true)
      }
    }
    setForm(null)
  }

  const handleDelete = (id) => {
    onDelete(id)
    setForm(null)
    if (selectedId === id) { setSelectedId(null); setMobileDetail(false) }
  }

  const handleStageChange = (contact, stage) => {
    const from = stageOf(contact)
    if (stage === from) return
    if (stage === 'client' && segmentOf(contact) !== 'clients') { setConvertId(contact.id); return }
    const patch = { stage, networkLabel: stage === 'network' ? contact.networkLabel || null : null }
    if (from === 'client') patch.clientUntil = calUtils.localToday()
    onUpdate(contact.id, patch)
    const tabs = tabsFor({ ...contact, ...patch })
    if (tabs.length && !tabs.includes(tab)) pickTab(tabs[0])
  }

  const handleReferralStageChange = (contact, referralStage) => {
    if (!referralStage) {
      onUpdate(contact.id, { referralStage: null })
      showToast?.({ message: `${firstNameOf(contact)} is no longer on the referral track`, duration: 4000 })
      return
    }
    const today = calUtils.localToday()
    onUpdate(contact.id, {
      referralStage,
      ...(referralStage === 'partner' && !contact.partnerSince ? { partnerSince: today } : {}),
      ...(referralStage === 'invited' && !contact.invitedOn ? { invitedOn: today } : {}),
    })
  }

  // The Circleback processor writes meetings and contacts straight to the
  // database, so a pasted link can name rows this device hasn't loaded yet.
  // Take those copies in under their own ids; creating fresh ones would hit
  // the one-row-per-meeting and one-contact-per-email rules and stall sync.
  const adoptSaved = ({ meeting, contacts: saved = [] }) => {
    const known = new Map((allContacts || contacts).map(c => [c.id, c]))
    const byEmail = new Map((allContacts || contacts).filter(c => c.email).map(c => [c.email.trim().toLowerCase(), c]))
    const used = saved.map(c => {
      const local = known.get(c.id) || byEmail.get((c.email || '').trim().toLowerCase())
      return local || onAdd({ lastContactDate: '', nextTouchOn: '', ...c })
    }).filter(Boolean)
    let usedMeeting = null
    if (meeting) {
      usedMeeting = meetings.find(m => m.id === meeting.id || (m.externalId && m.externalId === meeting.externalId)) || null
      if (!usedMeeting) usedMeeting = onAddMeeting(meeting)
    }
    return { meeting: usedMeeting, contacts: used }
  }

  // One meeting, linked to everyone picked. Attendees from a Circleback link
  // who aren't contacts yet can be added to Needs review on the way in.
  const handleLog = ({ existingMeetingId, meeting, contactIds, newPeople }) => {
    const created = (newPeople || []).map(p => onAdd({
      name: p.name || p.email.split('@')[0],
      email: p.email,
      stage: 'needs_review',
      source: 'circleback',
      sourceRef: meeting.externalId || null,
      lastContactDate: meeting.date,
    })).filter(Boolean)
    const known = new Map([...people, ...created].map(c => [c.id, c]))
    const ids = [...new Set([...contactIds, ...created.map(c => c.id)])]
    const linked = ids.map(id => known.get(id)).filter(Boolean)
    const companyId = linked.find(c => c.companyId)?.companyId || null

    const existing = existingMeetingId ? meetings.find(m => m.id === existingMeetingId) : null
    if (existing) {
      // Same Circleback meeting saved before: add the people, fill blanks,
      // and leave action items alone so tasks already pushed stay linked.
      onUpdateMeeting(existing.id, {
        contactIds: [...new Set([...(existing.contactIds || []), ...ids])],
        summary: existing.summary || meeting.summary,
        notes: existing.notes || meeting.notes,
        recordingUrl: existing.recordingUrl || meeting.recordingUrl,
        companyId: existing.companyId || companyId,
        calendarEventId: existing.calendarEventId || meeting.calendarEventId || null,
      })
    } else {
      onAddMeeting({
        ...meeting,
        attendees: meeting.attendees || linked.map(c => c.name || c.email).filter(Boolean).join(', '),
        contactIds: ids,
        companyId,
      })
    }

    // Last contact moves forward for everyone on it.
    const forward = linked.filter(c => !c.lastContactDate || c.lastContactDate < meeting.date)
      .map(c => ({ id: c.id, lastContactDate: meeting.date }))
    if (forward.length) onUpdateMany(forward)

    const first = (linked[0]?.name || linked[0]?.email || '').split(' ')[0]
    const others = linked.length - 1
    const said = `${existing ? 'Updated' : 'Logged'} with ${first}${others > 0 ? ` and ${others} other${others === 1 ? '' : 's'}` : ''}`
      + (created.length ? ` · ${created.length} added to Needs review` : '')
    // A "Log notes from…" task for these people is what this just did.
    const notesTasks = [...new Map(linked.flatMap(c => openTasksById[c.id] || []).filter(t => isNotesTask(t.title)).map(t => [t.id, t])).values()]
    if (notesTasks.length) {
      showToast?.({
        message: `${said}. Mark "${notesTasks[0].title}"${notesTasks.length > 1 ? ` and ${notesTasks.length - 1} more` : ''} done?`,
        actionLabel: 'Mark done',
        duration: 9000,
        // After this toast closes, so "Task completed · Undo" can show.
        undo: () => setTimeout(() => notesTasks.forEach(t => onCompleteTask(t.id)), 0),
      })
    } else {
      showToast?.({ message: said, duration: 4000 })
    }
    setLog(null)
  }

  const handleConvert = ({ newCompany, companyId, peerIds, rewardAmount }) => {
    const c = contactById(convertId)
    if (!c) { setConvertId(null); return }
    let cid = companyId
    if (newCompany) {
      cid = makeId('co')
      onAddCompany({ id: cid, ...newCompany })
    }
    const today = calUtils.localToday()
    const ids = [c.id, ...peerIds]
    const before = ids.map(id => {
      const p = contactById(id)
      return { id, stage: p.stage, companyId: p.companyId ?? null, becameClientOn: p.becameClientOn || '', rewardAmount: p.rewardAmount ?? null }
    })
    onUpdateMany(ids.map(id => ({
      id, stage: 'client', companyId: cid, becameClientOn: contactById(id)?.becameClientOn || today,
      ...(id === c.id && rewardAmount != null ? { rewardAmount } : {}),
    })))
    setConvertId(null)
    pickTab('clients')
    setSelectedId(c.id)
    showToast?.({
      message: `${c.name} is now a client`,
      actionLabel: 'Undo',
      duration: 7000,
      undo: () => {
        onUpdateMany(before)
        if (newCompany) onDeleteCompany(cid)
      },
    })
  }

  const handleApprove = (patches) => {
    onUpdateMany(patches)
    showToast?.({ message: `${patches.length} ${patches.length === 1 ? 'person' : 'people'} sorted`, duration: 3000 })
  }
  const handleReviewDelete = (list) => {
    onIgnoreEmails?.(list.flatMap(c => [c.email, ...(c.otherEmails || [])]).filter(Boolean))
    list.forEach(c => onDelete(c.id))
    showToast?.({ message: `${list.length} deleted and ignored from now on`, duration: 4000 })
  }

  const handleScheduled = (contact, result) => {
    onScheduled?.(contact, result, schedule?.event || null)
    setSchedule(null)
  }

  const handleInvite = (contact, { referralTerms }) => {
    onUpdate(contact.id, {
      referralStage: referralStageOf(contact) === 'partner' ? 'partner' : 'invited',
      invitedOn: contact.invitedOn || calUtils.localToday(),
      ...(referralTerms ? { referralTerms } : {}),
    })
    setInviteId(null)
    if (!referralStageOf(contact) && !tabsFor(contact).includes('network')) {
      showToast?.({ message: `${firstNameOf(contact)} is Invited. They now show in Network too.`, duration: 4000 })
    }
  }

  const convertContact = convertId ? contactById(convertId) : null
  const logContact = log?.contactId ? contactById(log.contactId) : null
  const scheduleContact = schedule ? contactById(schedule.contactId) : null
  const inviteContact = inviteId ? contactById(inviteId) : null
  const mergeContact = merge ? contactById(merge.contactId) : null

  const renderDetail = (contact, withBack) => (
    <ContactDetail
      key={contact.id}
      contact={contact}
      companies={companies}
      contacts={people}
      linkedMeetings={linkedById[contact.id] || []}
      linkedThreads={threadsById[contact.id] || []}
      gmailAccount={gmailAccount}
      openTasks={openTasksById[contact.id] || []}
      demoMode={demoMode}
      toLog={toLogByContact[contact.id] || []}
      booked={bookedById[contact.id] || null}
      duplicates={duplicatesOf(contact, people, { notSame })}
      aiState={aiState[contact.id]}
      aiFresh={!contact.nextStep || contact.nextStep.basis === basisFor(contact)}
      onUsedStep={(title) => usedStep(contact, title)}
      onBack={withBack ? () => setMobileDetail(false) : null}
      onEdit={() => setForm({ contact })}
      onStageChange={(s) => handleStageChange(contact, s)}
      onReferralStageChange={(s) => handleReferralStageChange(contact, s)}
      onConvert={() => setConvertId(contact.id)}
      onMerge={(candidate) => setMerge({ contactId: contact.id, candidate: candidate || null })}
      onNotSame={(otherId) => onNotSame(notSameKey(contact.id, otherId))}
      onLog={(prefill) => setLog({ contactId: contact.id, prefill: prefill || null })}
      onDismissToLog={onDismissToLog}
      onSchedule={({ step, event } = {}) => setSchedule({ contactId: contact.id, step: step || null, event: event || null })}
      onInvite={() => setInviteId(contact.id)}
      onAddTask={({ title, dueDate }) => {
        onAddTask({ title, dueDate: dueDate || null, contactId: contact.id, companyId: contact.companyId || null, priority: 'medium' })
        showToast?.({ message: `Task added for ${firstNameOf(contact)}`, duration: 3000 })
      }}
      onCompleteTask={onCompleteTask}
      onEditTask={onEditTask}
      onOpenContact={(id) => select(id)}
      onOpenClient={onOpenClient}
      onUpdate={(patch) => onUpdate(contact.id, patch)}
      onSetReward={(referralId, amount) => onUpdate(referralId, { rewardAmount: amount })}
      onMarkPaid={(referralId) => {
        const r = contactById(referralId)
        onUpdate(referralId, { rewardPaidOn: calUtils.localToday() })
        showToast?.({ message: `Marked paid${r?.rewardAmount ? `: ${money(r.rewardAmount)}` : ''}`, actionLabel: 'Undo', duration: 6000, undo: () => onUpdate(referralId, { rewardPaidOn: '' }) })
      }}
      onRefreshStep={() => requestStep(contact, { force: true })}
      onAnotherStep={(title) => anotherStep(contact, title)}
    />
  )

  const segDefaultStage = tab === 'clients' ? 'client' : tab === 'network' ? 'network' : 'nurturing'
  const owedTotal = owedAll.reduce((n, o) => n + (Number(o.referral.rewardAmount) || 0), 0)

  return (
    <div className="h-full flex">
      {/* List */}
      <section aria-label="People" className={`${showMobileDetail ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[360px] md:flex-shrink-0 md:border-r border-surface-300 h-full md:bg-white`}>
        <div className="px-4 pt-5 pb-3 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-navy-900 text-xl">Relationships</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setLog({ contactId: null })} aria-label="Log a meeting" className="btn-ghost px-3 min-h-[40px] text-sm font-display font-semibold flex items-center gap-1.5">
                <CalendarPlus size={15} /> Log
              </button>
              <button onClick={() => setForm({ defaultStage: segDefaultStage })} className="btn-primary px-4 min-h-[40px] text-sm flex items-center gap-1.5">
                <Plus size={15} strokeWidth={2.5} /> Add
              </button>
            </div>
          </div>

          {reviewQueue.length > 0 && (
            <button onClick={() => setReviewOpen(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] border border-[#FBE3B4] bg-gold-50 text-left min-h-[44px]">
              <Inbox size={16} className="text-[#8A5500] flex-shrink-0" />
              <span className="flex-1 text-[13px] text-navy-700"><strong className="font-semibold">{reviewQueue.length} {reviewQueue.length === 1 ? 'person' : 'people'}</strong> waiting to be sorted</span>
              <span className="font-display font-semibold text-[13px] text-[#8A5500]">Sort</span>
            </button>
          )}

          <div role="tablist" aria-label="Segments" className="flex p-[3px] gap-[3px] rounded-[10px] bg-surface-200 font-display text-[13px] font-semibold">
            {SEGMENTS.map(s => (
              <button key={s.id} role="tab" aria-selected={tab === s.id} onClick={() => pickTab(s.id)}
                className={`flex-1 min-h-[36px] rounded-lg transition-all ${tab === s.id ? 'bg-white shadow-card text-navy-900' : 'text-navy-600 hover:text-navy-900'}`}>
                {s.label} <span className="font-medium text-navy-600">{counts[s.id]}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-surface-300 rounded-[10px] px-3 focus-within:border-gold-500">
              <Search size={15} className="text-navy-500 flex-shrink-0" aria-hidden="true" />
              <label htmlFor="rel-search" className="sr-only">Search people</label>
              <input id="rel-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
                className="flex-1 min-w-0 bg-transparent py-2 text-sm text-navy-900 placeholder-navy-400 focus:outline-none" />
            </div>
            <ListMenu tab={tab} group={group} setGroup={setGroup} sort={sort} setSort={setSort} />
          </div>

          {tab === 'network' && owedAll.length > 0 && (
            <button onClick={() => select(owedAll[0].partner.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] border border-[#FBE3B4] bg-gold-50 text-left min-h-[44px]">
              <Gift size={16} className="text-[#8A5500] flex-shrink-0" />
              <span className="flex-1 text-[13px] text-navy-700">
                {owedTotal > 0 && !demoMode ? <><strong className="font-semibold">{money(owedTotal)} in rewards</strong> owed</> : <><strong className="font-semibold">{owedAll.length} {owedAll.length === 1 ? 'reward' : 'rewards'}</strong> to settle</>}
                {owedAll.length === 1 ? ` to ${owedAll[0].partner.name}` : ` to ${new Set(owedAll.map(o => o.partner.id)).size} partners`}
              </span>
              <span className="font-display font-semibold text-[13px] text-[#8A5500]">View</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-6">
          {groups.list.length === 0 && groups.past.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <Users size={28} className="text-surface-500 mb-3" />
              <p className="font-display font-semibold text-navy-700">{q ? 'Nobody matches that search' : `No ${SEGMENTS.find(s => s.id === tab).label.toLowerCase()} yet`}</p>
              {!q && <p className="text-navy-600 text-sm mt-1">{tab === 'network' ? 'Add someone, or invite a contact to be a referral partner from their page.' : 'Add someone, or sort the people waiting for review.'}</p>}
            </div>
          ) : (
            <>
              {groups.list.map(g => (
                <div key={g.key} className="mb-1">
                  {g.label && (
                    <p className={`flex items-center gap-2 px-2 pt-3 pb-1 font-display font-bold text-[11px] uppercase tracking-wider ${g.tone === 'referral' ? 'text-[#5B21B6]' : 'text-navy-600'}`}>
                      {g.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />}
                      {g.label} · {g.items.length}
                    </p>
                  )}
                  {g.items.map(c => (
                    <ContactRow key={c.id} contact={c} company={companies.find(co => co.id === c.companyId)} tab={tab}
                      booked={bookedById[c.id]} toLog={(toLogByContact[c.id] || []).length > 0} lastDate={lastDates[c.id]}
                      referralCount={referralCounts[c.id] || 0} selected={desktopContact?.id === c.id} onSelect={select} />
                  ))}
                </div>
              ))}
              {groups.past.length > 0 && (
                <div className="pt-2 px-1.5">
                  <button onClick={() => setShowPast(s => !s)} aria-expanded={showPast}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] border border-dashed border-surface-400 font-display font-bold text-[11px] uppercase tracking-wider text-navy-600">
                    Past clients · {groups.past.length}
                    {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showPast && groups.past.map(c => (
                    <ContactRow key={c.id} contact={c} company={companies.find(co => co.id === c.companyId)} tab={tab}
                      booked={bookedById[c.id]} toLog={(toLogByContact[c.id] || []).length > 0} lastDate={lastDates[c.id]}
                      referralCount={referralCounts[c.id] || 0} selected={desktopContact?.id === c.id} onSelect={select} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Detail: desktop pane */}
      <section aria-label="Contact" className="hidden md:block flex-1 min-w-0 h-full">
        {desktopContact ? renderDetail(desktopContact, false) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Users size={32} className="text-surface-500 mb-3" />
            <p className="font-display font-semibold text-navy-700">Pick someone to see their next step</p>
          </div>
        )}
      </section>

      {/* Detail: phone screen */}
      {showMobileDetail && (
        <section aria-label="Contact" className="md:hidden flex-1 min-w-0 h-full">
          {renderDetail(selected, true)}
        </section>
      )}

      {form && (
        <ContactForm contact={form.contact} defaultStage={form.defaultStage} companies={companies} contacts={people}
          allContacts={allContacts || contacts} demoMode={demoMode}
          onSave={handleSaveForm} onDelete={handleDelete} onClose={() => setForm(null)} />
      )}
      {reviewOpen && (
        <ReviewSheet queue={reviewQueue} companies={companies} meetings={meetings} emailThreads={emailThreads}
          contacts={people} selfEmails={[userEmail, gmailAccount].filter(Boolean)} notSame={notSame} demoMode={demoMode}
          onApprove={handleApprove} onDelete={handleReviewDelete}
          onMerge={(person, dup) => setMerge({ contactId: person.id, candidate: dup })}
          onNotSame={(a, b) => onNotSame(notSameKey(a, b))}
          onClose={() => setReviewOpen(false)} />
      )}
      {convertContact && (
        <ConvertSheet contact={convertContact} contacts={people} companies={companies}
          onConvert={handleConvert} onClose={() => setConvertId(null)} />
      )}
      {log && (log.contactId === null || logContact) && (
        <LogConversationModal contact={logContact} contacts={people} allContacts={allContacts || contacts}
          meetings={meetings} userEmail={userEmail} ignore={ignore} prefill={log.prefill || null}
          onAdoptSaved={adoptSaved} onSave={handleLog} onClose={() => setLog(null)} />
      )}
      {scheduleContact && google && (
        <ScheduleSheet contact={scheduleContact} step={schedule.step} event={schedule.event} google={google}
          onDone={(result) => handleScheduled(scheduleContact, result)} onClose={() => setSchedule(null)} />
      )}
      {inviteContact && (
        <InviteSheet contact={inviteContact} program={referralProgram} gmailAccount={gmailAccount} demoMode={demoMode}
          onInvite={(data) => handleInvite(inviteContact, data)} onSaveProgram={onSaveProgram} onClose={() => setInviteId(null)} />
      )}
      {mergeContact && (
        <MergeSheet contact={mergeContact} candidate={merge.candidate} contacts={people}
          onMerge={(keepId, dropId) => {
            onMerge(keepId, dropId)
            setMerge(null)
            if (selectedId === dropId) setSelectedId(keepId)
          }}
          onClose={() => setMerge(null)} />
      )}
    </div>
  )
}

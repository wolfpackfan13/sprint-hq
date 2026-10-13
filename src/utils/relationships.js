// Relationships CRM: stages, segments, and the derived values the
// Relationships page, the Today cards, and the calendar all share.
//
// Every person has two tracks:
//   business  stage: Nurturing → In conversation → Proposal out → Client →
//             Past client, or Network when they are not buying from you.
//   referral  referralStage: Invited → Partner, or none. A partner has an
//             agreement and a reward for the clients they send.

import { dateUtils, calUtils } from './dateUtils'

// One business stage per contact. defaultDays is how long someone in that
// stage can go without contact before Today's Reach out lists them.
export const STAGES = {
  nurturing:       { label: 'Nurturing',       segment: 'leads',   defaultDays: 42,   chip: 'bg-[#EEF1F7] text-[#2E3D5A] border-[#D5DBE8]' },
  in_conversation: { label: 'In conversation', segment: 'leads',   defaultDays: 7,    chip: 'bg-[#FEF6E4] text-[#7A4E00] border-[#F5D9A0]' },
  proposal_out:    { label: 'Proposal out',    segment: 'leads',   defaultDays: 5,    chip: 'bg-[#E8F0FE] text-[#1D4ED8] border-[#C7D8FB]' },
  client:          { label: 'Client',          segment: 'clients', defaultDays: 14,   chip: 'bg-forest-100 text-forest-700 border-[#B7E4C7]' },
  past_client:     { label: 'Past client',     segment: 'clients', defaultDays: 90,   chip: 'bg-surface-200 text-navy-600 border-surface-300' },
  network:         { label: 'Network',         segment: 'network', defaultDays: null, chip: 'bg-surface-200 text-navy-700 border-surface-300' },
  needs_review:    { label: 'Needs review',    segment: 'inbox',   defaultDays: null, chip: 'bg-surface-200 text-navy-600 border-surface-300' },
}

export const STAGE_ORDER = ['proposal_out', 'in_conversation', 'nurturing', 'client', 'past_client', 'network', 'needs_review']
export const LEAD_STAGES = ['nurturing', 'in_conversation', 'proposal_out']
export const BUSINESS_STAGES = ['nurturing', 'in_conversation', 'proposal_out', 'client', 'past_client', 'network']

export const REFERRAL_STAGES = {
  invited: { label: 'Invited',          defaultDays: 14, chip: 'bg-[#F7F5FE] text-[#5B21B6] border-[#E6DEFB]' },
  partner: { label: 'Referral partner', defaultDays: 30, chip: 'bg-[#F1ECFD] text-[#5B21B6] border-[#DDD0FA]' },
}

export const SEGMENTS = [
  { id: 'leads',   label: 'Leads',   defaultGroup: 'stage',    defaultSort: 'next' },
  { id: 'clients', label: 'Clients', defaultGroup: 'company',  defaultSort: 'next' },
  { id: 'network', label: 'Network', defaultGroup: 'referral', defaultSort: 'name' },
]

// "Referral partner" used to be a label; it is now the referral track.
export const NETWORK_LABELS = {
  collaborator: 'Collaborator',
  personal: 'Personal',
}

export const SOURCES = {
  referral: 'Referral',
  event: 'Event',
  content: 'Content',
  circleback: 'Circleback',
  gmail: 'Gmail',
  notion_import: 'Notion import',
  other: 'Other',
}

export const DEMO_MASK = 'Hidden in demo mode'

export const lower = (s) => String(s || '').trim().toLowerCase()
export const firstNameOf = (c) => (c?.name || '').trim().split(/\s+/)[0] || 'them'

export const stageOf = (c) => (c?.stage && STAGES[c.stage] ? c.stage : 'needs_review')
export const segmentOf = (c) => STAGES[stageOf(c)].segment
export const referralStageOf = (c) => (c?.referralStage && REFERRAL_STAGES[c.referralStage] ? c.referralStage : null)
export const isPartner = (c) => referralStageOf(c) === 'partner'

// Which list tabs a person shows up in. A partner who is also a lead is in
// both Leads and Network.
export function tabsFor(c) {
  const seg = segmentOf(c)
  if (seg === 'inbox') return []
  const tabs = [seg]
  if (seg !== 'network' && referralStageOf(c)) tabs.push('network')
  return tabs
}

export function defaultNextTouch(stage, from = dateUtils.today()) {
  const days = STAGES[stage]?.defaultDays
  return days ? calUtils.addDays(from, days) : ''
}

// How many days this person can go without contact before Reach out lists
// them, from whichever track wants the more frequent touch. null: never.
export function cadenceDays(c) {
  const stage = stageOf(c)
  const days = [
    stage !== 'network' && stage !== 'needs_review' ? STAGES[stage].defaultDays : null,
    REFERRAL_STAGES[referralStageOf(c)]?.defaultDays ?? null,
  ].filter(d => d != null)
  return days.length ? Math.min(...days) : null
}

// ── Dates ──
export function shortDay(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// YYYY-MM-DD in this device's time zone for an ISO timestamp (or a bare
// date, which is returned as is).
export function localDateOf(iso) {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null
  const a = new Date(fromDate + 'T12:00:00').getTime()
  const b = new Date(toDate + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function timeRange(startIso, endIso) {
  const fmt = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (!startIso || !endIso || !startIso.includes('T')) return ''
  return `${fmt(startIso)} to ${fmt(endIso)}`
}

// "Client in 2025", "Client 2024 to 2025", or '' while they are a client.
export function clientHistoryLabel(c) {
  if (!c?.becameClientOn || stageOf(c) === 'client') return ''
  const from = c.becameClientOn.slice(0, 4)
  const until = (c.clientUntil || '').slice(0, 4)
  if (!until || until === from) return `Client in ${from}`
  return `Client ${from} to ${until}`
}

// ── Emails ──
// Every address a person goes by, main one first, lower case.
export function emailsOf(c) {
  const out = []
  ;[c?.email, ...(Array.isArray(c?.otherEmails) ? c.otherEmails : [])].forEach(e => {
    const v = lower(e)
    if (v && !out.includes(v)) out.push(v)
  })
  return out
}

export function contactForEmail(email, contacts = []) {
  const e = lower(email)
  if (!e) return null
  return contacts.find(c => emailsOf(c).includes(e)) || null
}

// ── Meetings ↔ contacts ──
// A meeting belongs to a contact when it lists the contact's id, or (for
// meetings logged before contact_ids existed) when the attendee text
// contains one of the contact's emails or their exact full name.
export function meetingMatchesContact(m, c) {
  if (!m || !c) return false
  if (Array.isArray(m.contactIds) && m.contactIds.includes(c.id)) return true
  const attendees = (m.attendees || '').toLowerCase()
  if (!attendees) return false
  const emails = emailsOf(c)
  // Whole-address match: dan@acme.com must not match jordan@acme.com.
  if (emails.length && attendees.split(/[\s,;<>()"]+/).some(t => emails.includes(t))) return true
  const name = (c.name || '').trim().toLowerCase()
  if (name && name.includes(' ')) {
    return attendees.split(/[,;\n]/).map(s => s.trim()).some(s => s === name || s.startsWith(name + ' '))
  }
  return false
}

export function meetingsForContact(c, meetings = []) {
  return meetings
    .filter(m => meetingMatchesContact(m, c))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
}

// Contacts whose email or full name appears in a meeting's attendee text.
export function contactIdsFromAttendees(attendees, contacts = []) {
  if (!attendees) return []
  return contacts.filter(c => meetingMatchesContact({ attendees, contactIds: [] }, c)).map(c => c.id)
}

export function meetingBlurb(m) {
  const text = (m?.summary || m?.notes || '').trim()
  if (!text) return ''
  return text.split('\n')[0]
}

// ── Email (from the hourly Gmail sync) ──
// Threads this person is on, newest first. Matches by id, and by any of
// their addresses for someone added or merged since the last sync.
export function threadsForContact(c, threads = []) {
  if (!c || !threads.length) return []
  const emails = emailsOf(c)
  return threads
    .filter(t => (t.contactIds || []).includes(c.id) || (t.participants || []).some(p => emails.includes(lower(p))))
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
}

// Opens a thread in Gmail, in the right account when you have several.
export function gmailThreadUrl(threadId, account) {
  const who = account ? `?authuser=${encodeURIComponent(account)}` : ''
  return `https://mail.google.com/mail/${who}#all/${encodeURIComponent(threadId)}`
}

// Opens a new Gmail draft, filled in. Nothing sends until you press Send.
export function gmailComposeUrl({ to = '', subject = '', body = '', account = '' } = {}) {
  const p = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body })
  if (account) p.set('authuser', account)
  return `https://mail.google.com/mail/?${p.toString()}`
}

// ── Last contact and history ──
// The newest conversation of any kind: a meeting (Circleback or logged) or
// an email thread. Returns { kind, date, meeting?, thread? } or null.
export function lastTouch(linkedMeetings = [], linkedThreads = []) {
  const m = linkedMeetings[0]
  const t = linkedThreads[0]
  const tDay = localDateOf(t?.lastMessageAt)
  if (t && (!m || tDay > (m.date || ''))) return { kind: 'email', date: tDay, thread: t }
  if (m) return { kind: 'meeting', date: m.date || '', meeting: m }
  return null
}

// The newest of: the date on the contact, their latest meeting, and their
// latest email thread.
export function lastContactDate(c, linkedMeetings = [], linkedThreads = []) {
  const fromMeeting = linkedMeetings[0]?.date || ''
  const fromEmail = localDateOf(linkedThreads[0]?.lastMessageAt)
  const manual = c.lastContactDate || ''
  return [fromMeeting, fromEmail, manual].reduce((a, b) => (b > a ? b : a), '')
}

// Meetings and email threads in one list, newest first.
export function historyItems(linkedMeetings = [], linkedThreads = []) {
  const items = [
    ...linkedMeetings.map(m => ({ kind: 'meeting', id: `m:${m.id}`, date: m.date || '', at: `${m.date || ''}T${m.time || '00:00'}`, meeting: m })),
    ...linkedThreads.map(t => ({ kind: 'email', id: `t:${t.id}`, date: localDateOf(t.lastMessageAt), at: t.lastMessageAt || '', thread: t })),
  ]
  return items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || '').localeCompare(a.at || ''))
}

// "Hannah wrote last", "You wrote last".
export function whoWroteLast(thread, firstName) {
  return thread?.lastDirection === 'out' ? 'You wrote last' : `${firstName || 'They'} wrote last`
}

// ── Tasks ──
// Open tasks for this person: added from their page, plus action items
// from their meetings (pushed to tasks, or Circleback tasks tagged with
// the meeting's external id).
export function openTasksForContact(contact, linkedMeetings = [], tasks = []) {
  const ids = new Set()
  const tags = []
  linkedMeetings.forEach(m => {
    ;(m.actionItems || []).forEach(ai => { if (ai.taskId) ids.add(ai.taskId) })
    if (m.externalId) tags.push(`[circleback:${m.externalId}]`)
  })
  return tasks
    .filter(t => t.status !== 'done' && (
      (contact && t.contactId === contact.id) || ids.has(t.id) || tags.some(tag => (t.notes || '').includes(tag))
    ))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
}

// ── Calendar ──
// Whole-word, case-insensitive: "Rane" is in "Sam and Rane connect" but
// not in "Ranelagh".
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const titleHasName = (title, name) => {
  const n = lower(name).replace(/\s+/g, ' ')
  if (!n) return false
  return new RegExp(`(^|[^\\p{L}])${escapeRe(n)}($|[^\\p{L}])`, 'iu').test(title || '')
}

// First names that only one person has, so a title like "Lunch with Rane"
// can point to them. Your own first name is left out, since most titles
// carry it ("Sam and Rane connect").
export function uniqueFirstNames(contacts = [], selfEmails = []) {
  const self = new Set(selfEmails.map(e => lower(e).split('@')[0].split(/[._+-]/)[0]).filter(Boolean))
  const counts = new Map()
  contacts.forEach(c => {
    if (stageOf(c) === 'needs_review') return
    const first = lower(firstNameOf(c))
    if (first && first !== 'them') counts.set(first, (counts.get(first) || 0) + 1)
  })
  return new Set([...counts].filter(([n, k]) => k === 1 && n.length >= 3 && !self.has(n)).map(([n]) => n))
}

// How a calendar event is tied to this person, or null: the event SprintHQ
// saved for them, they're on the invite, it carries their #contact link
// (reminders SprintHQ makes), or the title names them (their full name, or
// a first name nobody else has).
export function eventMatch(ev, c, { uniqueFirst } = {}) {
  if (!ev || !c) return null
  if (c.nextTouchEventId && ev.id === c.nextTouchEventId) return 'saved'
  const emails = emailsOf(c)
  if ((ev.attendees || []).some(a => emails.includes(lower(a)))) return 'email'
  if ((ev.description || '').includes(`#contact=${encodeURIComponent(c.id)}`)) return 'link'
  const name = (c.name || '').trim()
  if (name.includes(' ') && titleHasName(ev.title, name)) return 'title'
  const first = lower(firstNameOf(c))
  if (uniqueFirst && uniqueFirst.has(first) && titleHasName(ev.title, first)) return 'title'
  return null
}
export const eventIsAbout = (ev, c, opts) => !!eventMatch(ev, c, opts)

const startMs = (ev) => {
  const s = ev?.start || ''
  return Date.parse(s.includes('T') ? s : `${s}T00:00:00`)
}
const endMs = (ev) => {
  const s = ev?.end || ev?.start || ''
  return Date.parse(s.includes('T') ? s : `${s}T23:59:59`)
}

// The next thing on the calendar with this person, or null. The event comes
// back with matchedBy saying how it was tied to them.
export function nextBookedEvent(c, events = [], { now = Date.now(), uniqueFirst } = {}) {
  let best = null
  let how = null
  for (const ev of events) {
    if (ev.selfStatus === 'declined' || endMs(ev) < now) continue
    const m = eventMatch(ev, c, { uniqueFirst })
    if (m && (!best || startMs(ev) < startMs(best))) { best = ev; how = m }
  }
  return best ? { ...best, matchedBy: how } : null
}

const TO_LOG_AFTER_MS = 2 * 60 * 60 * 1000
const TO_LOG_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

// Who a missing-notes reminder is for: leads, clients and partners, never
// Personal contacts.
const needsNotes = (c) => c.networkLabel !== 'personal' && (
  LEAD_STAGES.includes(stageOf(c)) || ['client', 'past_client'].includes(stageOf(c)) || !!referralStageOf(c)
)

// Meetings on your calendar with a lead, client or partner that ended over
// two hours ago (time for Circleback to deliver) with no notes from
// Circleback or by hand. Recurring meetings are skipped, so standing team
// syncs don't ask every week. Newest first.
export function toLogItems(events = [], contacts = [], meetings = [], { dismissed = [], now = Date.now() } = {}) {
  const out = []
  for (const ev of events) {
    if (ev.allDay || ev.recurring || ev.selfStatus === 'declined') continue
    const end = endMs(ev)
    if (!(end < now - TO_LOG_AFTER_MS) || end < now - TO_LOG_WINDOW_MS) continue
    if (dismissed.includes(ev.id)) continue
    if (meetings.some(m => m.calendarEventId === ev.id)) continue
    const attendees = (ev.attendees || []).map(lower)
    const people = contacts.filter(c => needsNotes(c) && emailsOf(c).some(e => attendees.includes(e)))
    if (!people.length) continue
    const day = localDateOf(ev.start)
    if (people.some(c => meetingsForContact(c, meetings).some(m => m.date === day))) continue
    out.push({ eventId: ev.id, title: ev.title, start: ev.start, end: ev.end, day, contactIds: people.map(c => c.id) })
  }
  return out.sort((a, b) => (b.start || '').localeCompare(a.start || ''))
}

// People to reach out to: nothing on the calendar with them, and longer
// since the last contact than their stage allows. Most overdue first.
export function reachOutList(contacts = [], { lastDates = {}, bookedIds = new Set(), today = calUtils.localToday() } = {}) {
  return contacts
    .map(c => {
      const days = cadenceDays(c)
      if (days == null || stageOf(c) === 'needs_review' || bookedIds.has(c.id) || c.networkLabel === 'personal') return null
      const last = lastDates[c.id] || localDateOf(c.createdAt) || ''
      const since = last ? daysBetween(last, today) : days + 1
      return since > days ? { contact: c, since, last } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.since - a.since)
}

// ── Referrals ──
export const referralsOf = (partner, contacts = []) => contacts.filter(c => partner && c.referredBy === partner.id)
export const hasSigned = (c) => ['client', 'past_client'].includes(stageOf(c)) || !!c.becameClientOn

// Signed clients a partner sent you whose reward isn't paid yet.
export function rewardsOwed(partner, contacts = []) {
  if (!isPartner(partner)) return []
  return referralsOf(partner, contacts)
    .filter(r => hasSigned(r) && !r.rewardPaidOn)
    .sort((a, b) => (a.becameClientOn || '').localeCompare(b.becameClientOn || ''))
}

// Every unpaid reward across your partners: [{ partner, referral }].
export function allRewardsOwed(contacts = []) {
  return contacts.filter(isPartner).flatMap(p => rewardsOwed(p, contacts).map(r => ({ partner: p, referral: r })))
}

export const money = (n) => (n == null || n === '' ? '' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`)

// ── Duplicates and merging ──
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'comcast.net', 'att.net'])
const normName = (s) => lower(s).replace(/[^a-z\s'-]/g, ' ').replace(/\s+/g, ' ').trim()
const pairKey = (a, b) => [a, b].sort().join('|')

// Other people who look like this one: the same full name, or the same
// first name at the same company email domain. Pairs you marked as
// different people are left out.
export function duplicatesOf(c, contacts = [], { notSame = [] } = {}) {
  if (!c) return []
  const name = normName(c.name)
  const parts = name.split(' ')
  const domains = emailsOf(c).map(e => e.split('@')[1]).filter(d => d && !FREE_MAIL.has(d))
  return contacts.filter(o => {
    if (o.id === c.id || notSame.includes(pairKey(c.id, o.id))) return false
    const oName = normName(o.name)
    if (name.includes(' ') && oName === name) return true
    if (!domains.length || !parts[0]) return false
    const oParts = oName.split(' ')
    const sameDomain = emailsOf(o).some(e => domains.includes(e.split('@')[1]))
    const lastOk = oParts.length < 2 || parts.length < 2 || oParts[oParts.length - 1] === parts[parts.length - 1]
    return sameDomain && oParts[0] === parts[0] && lastOk
  })
}
export const notSameKey = pairKey

// Which business stage says more about where someone is now, when two
// records disagree: a current client over a past one, a live lead over a
// network contact.
const STAGE_RANK = { client: 7, proposal_out: 6, in_conversation: 5, nurturing: 4, past_client: 3, network: 2, needs_review: 1 }
export const moreCurrentStage = (a, b) => ((STAGE_RANK[stageOf(a)] || 0) >= (STAGE_RANK[stageOf(b)] || 0) ? stageOf(a) : stageOf(b))

const earliest = (...ds) => ds.filter(Boolean).sort()[0] || ''
const latest = (...ds) => ds.filter(Boolean).sort().slice(-1)[0] || ''
const looksLikeEmailName = (name, email) => !name || (email && lower(name) === lower(email).split('@')[0])

// The fields to save on `keep` when `drop` is merged into it. Nothing on
// `keep` that is filled in is overwritten, except where noted.
export function mergePatch(keep, drop) {
  const keepEmail = lower(keep.email) || lower(drop.email)
  const otherEmails = [...new Set([...emailsOf(keep), ...emailsOf(drop)])].filter(e => e !== keepEmail)
  const pick = (k) => (keep[k] !== undefined && keep[k] !== null && keep[k] !== '' ? keep[k] : (drop[k] ?? keep[k] ?? null))
  const notes = [keep.notes, drop.notes].map(s => (s || '').trim()).filter(Boolean)
  const referralRank = { partner: 2, invited: 1 }
  // Neither record can end up referred by the other (or by itself).
  const keepRef = keep.referredBy && keep.referredBy !== drop.id && keep.referredBy !== keep.id ? keep.referredBy : null
  const dropRef = drop.referredBy && drop.referredBy !== keep.id && drop.referredBy !== drop.id ? drop.referredBy : null
  const referralStage = (referralRank[keep.referralStage] || 0) >= (referralRank[drop.referralStage] || 0)
    ? (keep.referralStage || null) : (drop.referralStage || null)
  return {
    name: looksLikeEmailName(keep.name, keep.email) && drop.name ? drop.name : keep.name,
    email: keepEmail,
    otherEmails,
    company: pick('company'),
    companyId: pick('companyId'),
    role: pick('role'),
    phone: pick('phone'),
    source: pick('source'),
    referredBy: keepRef || dropRef || null,
    networkLabel: moreCurrentStage(keep, drop) === 'network' ? pick('networkLabel') : null,
    stage: moreCurrentStage(keep, drop),
    referralStage,
    referralTerms: pick('referralTerms') || '',
    invitedOn: earliest(keep.invitedOn, drop.invitedOn),
    partnerSince: earliest(keep.partnerSince, drop.partnerSince),
    rewardAmount: keep.rewardAmount ?? drop.rewardAmount ?? null,
    rewardPaidOn: pick('rewardPaidOn') || '',
    becameClientOn: earliest(keep.becameClientOn, drop.becameClientOn),
    clientUntil: latest(keep.clientUntil, drop.clientUntil),
    lastContactDate: latest(keep.lastContactDate, drop.lastContactDate),
    nextTouchOn: keep.nextTouchEventId ? keep.nextTouchOn : (drop.nextTouchEventId ? drop.nextTouchOn : pick('nextTouchOn') || ''),
    nextTouchReason: keep.nextTouchEventId ? keep.nextTouchReason : (drop.nextTouchEventId ? drop.nextTouchReason : pick('nextTouchReason') || ''),
    nextTouchEventId: keep.nextTouchEventId || drop.nextTouchEventId || null,
    notes: [...new Set(notes)].join('\n\n'),
    tags: [...new Set([...(keep.tags || []), ...(drop.tags || [])])],
    createdAt: earliest(keep.createdAt, drop.createdAt) || keep.createdAt,
    nextStep: null,
  }
}

// ── Next step ──
// What the AI next step was built from. When this changes (a new meeting,
// email, finished task, stage change, booking), the suggestion refreshes.
export function nextStepBasis(c, { last, openTasks = [], booked, referrals = [] } = {}) {
  return [
    last ? `${last.kind}:${last.date}:${last.meeting?.id || last.thread?.id || ''}:${last.thread?.lastDirection || ''}` : 'none',
    openTasks.map(t => t.id).sort().join(','),
    stageOf(c), referralStageOf(c) || '',
    booked?.id || '',
    referrals.filter(hasSigned).length, referrals.length,
  ].join('|')
}

// A suggestion that needs no AI, for when the AI is off, not deployed, or
// still thinking.
export function fallbackStep(c, { last, firstName }) {
  const first = firstName || firstNameOf(c)
  if (last?.kind === 'email' && last.thread?.lastDirection === 'in') {
    const ago = daysBetween(last.date, calUtils.localToday())
    return {
      kind: 'email', title: `Reply to ${first}'s ${dateUtils.format(last.date, 'short')} email`,
      why: `${first} wrote last${ago > 0 ? `, ${ago} day${ago === 1 ? '' : 's'} ago` : ' today'}.`,
      threadId: last.thread.id,
    }
  }
  const suggested = !c.nextTouchEventId && c.nextTouchOn && c.nextTouchOn >= calUtils.localToday() ? c.nextTouchOn : ''
  const stage = stageOf(c)
  const title = LEAD_STAGES.includes(stage) ? `Book a follow-up with ${first}`
    : stage === 'client' ? `Book a check-in with ${first}`
    : isPartner(c) ? `Check in with ${first}`
    : `Catch up with ${first}`
  return {
    kind: 'schedule', title, minutes: 30,
    why: suggested ? `A follow-up was suggested for ${shortDay(suggested)}${c.nextTouchReason ? `: ${c.nextTouchReason}` : '.'}` : `Nothing is on your calendar with ${first}.`,
    day: suggested || '',
  }
}

export function fallbackSummary(c, { last, firstName }) {
  const first = firstName || firstNameOf(c)
  if (!last) return `No conversations with ${first} logged yet.`
  if (last.kind === 'email') return `Last contact was email on ${dateUtils.format(last.date, 'short')}. ${whoWroteLast(last.thread, first)}.`
  const m = last.meeting
  return `Last conversation: ${m.title || 'a conversation'} on ${dateUtils.format(m.date, 'short')}.${meetingBlurb(m) ? ` ${meetingBlurb(m)}` : ''}`
}

// ── Lists ──
export function companyNameFor(c, companies = []) {
  const record = companies.find(co => co.id === c.companyId)
  if (segmentOf(c) === 'clients' && record) return record.name
  return (c.company || '').trim() || 'Independent'
}

// next: people with nothing booked come first, longest since contact at the
// top, then everyone booked, soonest first.
export function sortContacts(list, sortKey, lastDates = {}) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  const copy = [...list]
  if (sortKey === 'name') return copy.sort(byName)
  if (sortKey === 'last') {
    return copy.sort((a, b) => (lastDates[a.id] || '').localeCompare(lastDates[b.id] || '') || byName(a, b))
  }
  return copy.sort((a, b) => {
    const ba = a.nextTouchEventId && a.nextTouchOn ? a.nextTouchOn : ''
    const bb = b.nextTouchEventId && b.nextTouchOn ? b.nextTouchOn : ''
    if (!ba && bb) return -1
    if (ba && !bb) return 1
    if (!ba && !bb) return (lastDates[a.id] || '').localeCompare(lastDates[b.id] || '') || byName(a, b)
    return ba.localeCompare(bb) || byName(a, b)
  })
}

export function hiddenInDemo(c, demoMode) {
  return !!demoMode && c.networkLabel === 'personal'
}

// The contacts on a calendar invite, in invite order, skipping your own
// address and (in demo mode) Personal contacts.
export function contactsOnInvite(attendeeEmails = [], contacts = [], { selfEmail = '', demoMode = false } = {}) {
  const self = lower(selfEmail)
  const seen = new Set()
  return attendeeEmails
    .filter(e => e && lower(e) !== self)
    .map(e => contactForEmail(e, contacts))
    .filter(c => c && !seen.has(c.id) && seen.add(c.id))
    .filter(c => !hiddenInDemo(c, demoMode))
}

// "Last time with Jane Doe, Sep 12: agreed to send two pricing options."
// The summary is left off in demo mode, since this line is saved into a task.
export function lastTimeLine(c, meetings = [], { demoMode = false } = {}) {
  const who = (c.name || c.email || 'them').trim()
  const last = meetingsForContact(c, meetings)[0]
  if (!last) return `${who}: no conversations logged yet.`
  const head = `Last time with ${who}, ${dateUtils.format(last.date, 'short')}`
  const blurb = demoMode ? '' : meetingBlurb(last).replace(/^•\s*/, '').trim()
  return blurb ? `${head}: ${blurb}` : `${head}.`
}

// A link that opens this contact in SprintHQ, for task resources and
// calendar events. It points at this page with #contact=<id>, which App
// picks up on load or on click.
export function contactLink(id) {
  if (typeof window === 'undefined') return ''
  const { origin, pathname } = window.location
  return `${origin}${pathname}#contact=${encodeURIComponent(id)}`
}

// The contact id in an in-app contact link, or null for any other URL.
export function contactIdFromLink(url) {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined)
    if (typeof window !== 'undefined' && u.origin !== window.location.origin) return null
    const m = u.hash.match(/^#contact=(.+)$/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

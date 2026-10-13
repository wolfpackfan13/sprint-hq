// Relationships CRM: stages, segments, and the derived values the
// Relationships page, the Today card, and the calendar all share.

import { dateUtils, calUtils } from './dateUtils'

// One stage per contact. defaultDays pre-fills the next touch when the
// stage changes; every date stays editable.
export const STAGES = {
  nurturing:       { label: 'Nurturing',       segment: 'leads',   defaultDays: 42,   chip: 'bg-[#EEF1F7] text-[#2E3D5A] border-[#D5DBE8]' },
  in_conversation: { label: 'In conversation', segment: 'leads',   defaultDays: 7,    chip: 'bg-[#FEF6E4] text-[#7A4E00] border-[#F5D9A0]' },
  proposal_out:    { label: 'Proposal out',    segment: 'leads',   defaultDays: 5,    chip: 'bg-[#E8F0FE] text-[#1D4ED8] border-[#C7D8FB]' },
  client:          { label: 'Client',          segment: 'clients', defaultDays: 14,   chip: 'bg-forest-100 text-forest-700 border-[#B7E4C7]' },
  past_client:     { label: 'Past client',     segment: 'clients', defaultDays: 90,   chip: 'bg-surface-200 text-navy-600 border-surface-300' },
  network:         { label: 'Network',         segment: 'network', defaultDays: null, chip: 'bg-[#F1ECFD] text-[#5B21B6] border-[#DDD0FA]' },
  needs_review:    { label: 'Needs review',    segment: 'inbox',   defaultDays: null, chip: 'bg-surface-200 text-navy-600 border-surface-300' },
}

export const STAGE_ORDER = ['proposal_out', 'in_conversation', 'nurturing', 'client', 'past_client', 'network', 'needs_review']
export const LEAD_STAGES = ['nurturing', 'in_conversation', 'proposal_out']

export const SEGMENTS = [
  { id: 'leads',   label: 'Leads',   defaultGroup: 'stage',   defaultSort: 'next' },
  { id: 'clients', label: 'Clients', defaultGroup: 'company', defaultSort: 'next' },
  { id: 'network', label: 'Network', defaultGroup: 'none',    defaultSort: 'name' },
]

export const NETWORK_LABELS = {
  referral_partner: 'Referral partner',
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

export const stageOf = (c) => (c?.stage && STAGES[c.stage] ? c.stage : 'needs_review')
export const segmentOf = (c) => STAGES[stageOf(c)].segment

export function defaultNextTouch(stage, from = dateUtils.today()) {
  const days = STAGES[stage]?.defaultDays
  return days ? calUtils.addDays(from, days) : ''
}

// ── Dates ──
export function shortDay(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function touchStatus(nextTouchOn, today = dateUtils.today()) {
  if (!nextTouchOn) return 'none'
  if (nextTouchOn < today) return 'overdue'
  if (nextTouchOn === today) return 'today'
  return 'upcoming'
}

export function touchLabel(nextTouchOn, today = dateUtils.today()) {
  const s = touchStatus(nextTouchOn, today)
  if (s === 'none') return 'No next touch'
  if (s === 'overdue') return `Overdue · ${dateUtils.format(nextTouchOn, 'short')}`
  if (s === 'today') return 'Today'
  return shortDay(nextTouchOn)
}

// ── Meetings ↔ contacts ──
// A meeting belongs to a contact when it lists the contact's id, or (for
// meetings logged before contact_ids existed) when the attendee text
// contains the contact's email or exact full name.
export function meetingMatchesContact(m, c) {
  if (!m || !c) return false
  if (Array.isArray(m.contactIds) && m.contactIds.includes(c.id)) return true
  const attendees = (m.attendees || '').toLowerCase()
  if (!attendees) return false
  const email = (c.email || '').trim().toLowerCase()
  // Whole-address match: dan@acme.com must not match jordan@acme.com.
  if (email && attendees.split(/[\s,;<>()"]+/).includes(email)) return true
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

// The newest of: the date on the contact, their latest meeting, and their
// latest email thread. The email is counted here as well as on the contact
// row, because a contact edited on a device that loaded before the hourly
// sync can push its older date back up.
export function lastContactDate(c, linkedMeetings = [], linkedThreads = []) {
  const fromMeeting = linkedMeetings[0]?.date || ''
  const fromEmail = localDateOf(linkedThreads[0]?.lastMessageAt)
  const manual = c.lastContactDate || ''
  return [fromMeeting, fromEmail, manual].reduce((a, b) => (b > a ? b : a), '')
}

// ── Email (from the hourly Gmail sync) ──
// YYYY-MM-DD in this device's time zone for an ISO timestamp.
export function localDateOf(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Threads this person is on, newest first. Matches by id, and by email for
// someone added since the last sync.
export function threadsForContact(c, threads = []) {
  if (!c || !threads.length) return []
  const email = (c.email || '').trim().toLowerCase()
  return threads
    .filter(t => (t.contactIds || []).includes(c.id) || (email && (t.participants || []).includes(email)))
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
}

// The day you last wrote to them, when it is close enough to their next
// touch (from three days before it onward) to probably be that touch.
// Returns '' otherwise.
export function emailedForTouch(c, linkedThreads = []) {
  if (!c?.nextTouchOn) return ''
  const latest = linkedThreads.reduce((mx, t) => (t.lastOutboundAt && t.lastOutboundAt > mx ? t.lastOutboundAt : mx), '')
  const day = localDateOf(latest)
  return day && day >= calUtils.addDays(c.nextTouchOn, -3) ? day : ''
}

// Opens a thread in Gmail, in the right account when you have several.
export function gmailThreadUrl(threadId, account) {
  const who = account ? `?authuser=${encodeURIComponent(account)}` : ''
  return `https://mail.google.com/mail/${who}#all/${encodeURIComponent(threadId)}`
}

// Open tasks that came out of this person's meetings: action items pushed
// to tasks, and Circleback tasks tagged with the meeting's external id.
export function openTasksForContact(linkedMeetings, tasks = []) {
  const ids = new Set()
  const tags = []
  linkedMeetings.forEach(m => {
    ;(m.actionItems || []).forEach(ai => { if (ai.taskId) ids.add(ai.taskId) })
    if (m.externalId) tags.push(`[circleback:${m.externalId}]`)
  })
  return tasks.filter(t => t.status !== 'done' && (ids.has(t.id) || tags.some(tag => (t.notes || '').includes(tag))))
}

// ── Lists ──
export function companyNameFor(c, companies = []) {
  const record = companies.find(co => co.id === c.companyId)
  if (segmentOf(c) === 'clients' && record) return record.name
  return (c.company || '').trim() || 'Independent'
}

export function sortContacts(list, sortKey, lastDates = {}) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  const copy = [...list]
  if (sortKey === 'name') return copy.sort(byName)
  if (sortKey === 'last') {
    return copy.sort((a, b) => (lastDates[a.id] || '').localeCompare(lastDates[b.id] || '') || byName(a, b))
  }
  // next touch: soonest first, overdue at the top, no date last
  return copy.sort((a, b) => {
    const da = a.nextTouchOn || '9999-12-31'
    const db = b.nextTouchOn || '9999-12-31'
    return da.localeCompare(db) || byName(a, b)
  })
}

export function dueTouches(contacts, today = dateUtils.today()) {
  return contacts
    .filter(c => stageOf(c) !== 'needs_review' && c.nextTouchOn && c.nextTouchOn <= today)
    .sort((a, b) => a.nextTouchOn.localeCompare(b.nextTouchOn) || (a.name || '').localeCompare(b.name || ''))
}

export function hiddenInDemo(c, demoMode) {
  return !!demoMode && c.networkLabel === 'personal'
}

// The contacts on a calendar invite, in invite order, skipping your own
// address and (in demo mode) Personal contacts.
export function contactsOnInvite(attendeeEmails = [], contacts = [], { selfEmail = '', demoMode = false } = {}) {
  const self = (selfEmail || '').trim().toLowerCase()
  const seen = new Set()
  return attendeeEmails
    .filter(e => e && e.trim().toLowerCase() !== self)
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

// "Last time" lines for several people, one line per meeting: people whose
// latest conversation was the same meeting share a line, so a prep task
// doesn't repeat one summary per attendee.
// "Last time with Jane Doe and Sam Lee, Sep 12: agreed to send two options."
export function lastTimeLines(people = [], meetings = [], { demoMode = false } = {}) {
  const groups = []
  for (const c of people) {
    const last = meetingsForContact(c, meetings)[0]
    const shared = last && groups.find(g => g.meeting && g.meeting.id === last.id)
    if (shared) shared.people.push(c)
    else groups.push({ meeting: last, people: [c] })
  }
  return groups.map(({ meeting, people: group }) => {
    if (!meeting || group.length === 1) return lastTimeLine(group[0], meetings, { demoMode })
    const names = group.map(c => (c.name || c.email || 'them').trim())
    const who = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const head = `Last time with ${who}, ${dateUtils.format(meeting.date, 'short')}`
    const blurb = demoMode ? '' : meetingBlurb(meeting).replace(/^•\s*/, '').trim()
    return blurb ? `${head}: ${blurb}` : `${head}.`
  })
}

// A link that opens this contact in SprintHQ, for task resources. It points
// at this page with #contact=<id>, which App picks up on load or on click.
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

// The latest meeting with this contact, for the calendar's "last time" line.
export function contactForEmail(email, contacts = []) {
  const e = (email || '').trim().toLowerCase()
  if (!e) return null
  return contacts.find(c => (c.email || '').trim().toLowerCase() === e) || null
}

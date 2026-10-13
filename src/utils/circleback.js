// Circleback meeting import for the Relationships CRM.
//
// Paste a meeting link (https://circleback.ai/meetings/<id>) and the
// circleback-meeting-import edge function reads it through Circleback's API.
// These helpers turn that reply into a SprintHQ meeting: plain-text notes,
// an overview summary, action items with owners, and the attendees matched
// against your contacts.

import { supabase } from './supabase'
import { genId } from './ids'
import { fromRow } from './dataMap'

export const CIRCLEBACK_FUNCTION = 'circleback-meeting-import'

export function circlebackMeetingId(input) {
  const text = String(input || '').trim()
  if (!text) return null
  const fromPath = text.match(/circleback\.ai\/.*?meetings\/([A-Za-z0-9_-]{6,64})/i)
  if (fromPath) return fromPath[1]
  return /^[A-Za-z0-9_-]{15,64}$/.test(text) ? text : null
}

export function looksLikeCirclebackLink(input) {
  return /circleback\.ai\/.*meetings\//i.test(String(input || ''))
}

const MESSAGES = {
  not_configured: "Circleback import isn't set up yet. You can still type the notes in below.",
  not_deployed: "Circleback import isn't set up yet. You can still type the notes in below.",
  offline: "Couldn't reach Circleback import. Check your connection, or type the notes in below.",
  not_found: 'No meeting with that link in your Circleback account.',
  bad_link: "That doesn't look like a Circleback meeting link.",
}

// Returns { meeting } or { error, code }. Never throws.
export async function fetchCirclebackMeeting(link) {
  const id = circlebackMeetingId(link)
  if (!id) return { code: 'bad_link', error: MESSAGES.bad_link }
  try {
    const { data, error } = await supabase.functions.invoke(CIRCLEBACK_FUNCTION, { body: { meetingId: id } })
    if (error) {
      let body = null
      try { body = await error.context?.json?.() } catch { body = null }
      // The Supabase gateway answers NOT_FOUND (upper case) when the
      // function has not been deployed; ours answers not_found.
      const code = body?.code === 'NOT_FOUND' ? 'not_deployed'
        : body?.code || (error.name === 'FunctionsFetchError' ? 'offline' : 'error')
      return { code, error: MESSAGES[code] || body?.error || 'Circleback import failed. Try again, or type the notes in below.' }
    }
    if (!data?.ok || !data.meeting) {
      const code = data?.code || 'error'
      return { code, error: MESSAGES[code] || data?.error || 'Circleback import failed.' }
    }
    return { meeting: data.meeting }
  } catch {
    return { code: 'offline', error: MESSAGES.offline }
  }
}

// The circleback-meeting-processor writes the meeting and any new attendees
// straight to the database after each call. Returns the database's copies of
// this meeting and of contacts with these emails, in the app's shape, so the
// log sheet reuses them. Returns empty lists offline. Never throws.
export async function fetchSavedCopies(externalId, emails = []) {
  const empty = { meeting: null, contacts: [] }
  if (!externalId) return empty
  try {
    const want = new Set(emails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean))
    const [m, c] = await Promise.all([
      supabase.from('meetings').select('*').eq('external_id', externalId).limit(1),
      want.size ? supabase.from('contacts').select('*') : Promise.resolve({ data: [] }),
    ])
    if (m.error || c.error) return empty
    return {
      meeting: m.data?.[0] ? fromRow('meetings', m.data[0]) : null,
      contacts: (c.data || [])
        .filter(r => want.has(String(r.email || '').trim().toLowerCase()))
        .map(r => fromRow('contacts', r)),
    }
  } catch {
    return empty
  }
}

// ── Notes ──

function stripInline(s) {
  return s
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')   // [text](url) -> text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

// Circleback writes Markdown (#### headings, * bullets, **bold**). The CRM
// shows plain text, so headings become their own line and bullets become •.
// Returns sections so the overview can be pulled out as the summary.
function parseSections(markdown) {
  const sections = []
  let current = { heading: '', lines: [] }
  String(markdown || '').replace(/\r/g, '').split('\n').forEach(raw => {
    const line = raw.replace(/\s+$/, '')
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      if (current.heading || current.lines.length) sections.push(current)
      current = { heading: stripInline(heading[1]), lines: [] }
      return
    }
    const bullet = line.match(/^(\s*)[*+-]\s+(.*)$/)
    if (bullet) {
      const indent = bullet[1].length >= 2 ? '   ' : ''
      current.lines.push(`${indent}• ${stripInline(bullet[2])}`)
      return
    }
    if (!line.trim()) {
      if (current.lines.length && current.lines[current.lines.length - 1] !== '') current.lines.push('')
      return
    }
    current.lines.push(stripInline(line))
  })
  if (current.heading || current.lines.length) sections.push(current)
  return sections.map(s => ({ ...s, lines: trimBlank(s.lines) })).filter(s => s.heading || s.lines.length)
}

function trimBlank(lines) {
  const out = [...lines]
  while (out.length && out[0] === '') out.shift()
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

export function circlebackNotesToText(markdown) {
  return parseSections(markdown)
    .map(s => [s.heading, ...s.lines].filter((l, i) => i > 0 || l).join('\n'))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// The Overview section when there is one, otherwise the first section.
export function circlebackSummary(markdown) {
  const sections = parseSections(markdown)
  if (!sections.length) return ''
  const overview = sections.find(s => /^(overview|summary)$/i.test(s.heading)) || sections[0]
  return overview.lines.join('\n').trim()
}

// Notes pasted by hand often come straight from Circleback's "Copy notes".
export function looksLikeMarkdown(text) {
  return /(^|\n)#{1,6}\s|\*\*[^*]+\*\*|(^|\n)\s*[*]\s/.test(String(text || ''))
}

// ── People ──

const lower = (s) => String(s || '').trim().toLowerCase()
const isPlaceholder = (name) => /^participant\s*\d*$/i.test(String(name || '').trim())

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || ''
}

// Matches attendees to contacts by email, then by exact full name.
// Returns { matchedIds, newPeople } where newPeople are attendees with an
// email that is not you, not a contact, and not on the ignore list.
export function matchAttendees(attendees = [], contacts = [], { selfEmails = [], ignore = [] } = {}) {
  const self = new Set(selfEmails.map(lower).filter(Boolean))
  const ignored = new Set(ignore.map(lower))
  const byEmail = new Map()
  // Any of a person's addresses (merged contacts keep their old ones).
  contacts.forEach(c => { [c.email, ...(c.otherEmails || [])].forEach(e => { if (lower(e) && !byEmail.has(lower(e))) byEmail.set(lower(e), c) }) })
  const matchedIds = []
  const newPeople = []
  const seen = new Set()
  attendees.forEach(a => {
    const email = lower(a.email)
    const name = String(a.name || '').trim()
    if (email && self.has(email)) return
    let contact = email ? byEmail.get(email) : null
    if (!contact && name.includes(' ') && !isPlaceholder(name)) {
      contact = contacts.find(c => lower(c.name) === lower(name)) || null
    }
    if (contact) {
      if (!matchedIds.includes(contact.id)) matchedIds.push(contact.id)
      return
    }
    if (!email || ignored.has(email) || seen.has(email)) return
    seen.add(email)
    newPeople.push({ name: isPlaceholder(name) ? '' : name, email })
  })
  return { matchedIds, newPeople }
}

export function attendeeText(attendees = []) {
  return attendees
    .filter(a => a.email || (a.name && !isPlaceholder(a.name)))
    .map(a => (a.name && a.email ? `${a.name} <${a.email}>` : a.name || a.email))
    .join(', ')
}

// ── Meeting ──

function localDateAndTime(iso) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

// Action items keep their owner: yours read as-is, everyone else's are
// prefixed with their first name so the list says who owes what.
export function circlebackActionItems(items = [], selfEmails = []) {
  const self = new Set(selfEmails.map(lower).filter(Boolean))
  return items.map(ai => {
    const mine = !ai.assignee || self.has(lower(ai.assignee.email))
    const owner = mine ? '' : firstName(ai.assignee.name) || ai.assignee.email || ''
    return {
      id: genId('ai'),
      title: owner ? `${owner}: ${ai.title}` : ai.title,
      dueDate: null,
      done: !!ai.done,
      taskId: null,
    }
  })
}

// Everything the log sheet pre-fills from a Circleback reply.
export function draftFromCircleback(cb, { selfEmails = [] } = {}) {
  const { date, time } = localDateAndTime(cb.startedAt)
  const fullNotes = circlebackNotesToText(cb.notes)
  return {
    externalId: cb.id,
    title: cb.title || 'Meeting',
    date,
    time,
    summary: circlebackSummary(cb.notes),
    notes: fullNotes,
    attendees: attendeeText(cb.attendees),
    actionItems: circlebackActionItems(cb.actionItems, selfEmails),
    recordingUrl: cb.url,
    source: 'circleback',
  }
}

export function isCirclebackUrl(url) {
  return /circleback\.ai\/.*meetings\//i.test(String(url || ''))
}

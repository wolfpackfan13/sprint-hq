// Circleback -> Sprint HQ meeting processor.
//
// Deployed as edge function `circleback-meeting-processor`, called by the
// Circleback webhook after every recorded call. For each meeting it:
//
//   1. matches attendees to contacts by email (then by exact full name), and
//      adds anyone new to Needs review with a suggested stage
//   2. writes one meeting row per Circleback id: plain-text notes, a
//      two-sentence summary, the Circleback link, and everyone matched
//   3. sets a contact's next touch when the call names a follow-up, unless
//      a next touch is already set for a later date
//   4. creates the tasks the call produced, tagged [circleback:<id>]
//   5. parks a follow-up email on the ledger for the Gmail draft pass
//
// Before asking Claude, it reads what SprintHQ already knows about each
// attendee (their Profile and last two meeting summaries) so the
// relationship call and the email are grounded in history.
//
// Requests are verified with Circleback's signing secret (x-signature,
// HMAC-SHA256 of the raw body). A caller without a signature, such as a
// scheduled task, can send the admin secret instead.
//
// Idempotency lives in the circleback_processed ledger. The meeting is
// CLAIMED before any work happens, so a retry that arrives while the first
// invocation is still talking to Claude is turned away. The contact and
// meeting writes are safe to repeat, and tasks are written last, so a run
// that fails part-way can be retried without duplicating tasks.
//
// Every "already handled" path returns 200. A webhook that gets a non-2xx
// retries, and a retry is exactly what we are trying to stop.
//
// Requires migrations 002, 003, 004 and 005.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SRK      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SAM_USER_ID       = Deno.env.get("SAM_USER_ID")!

// Gates the admin actions and lets an unsigned caller (a scheduled task)
// post a meeting. Unset = admin actions disabled (fail closed).
const ADMIN_SECRET = Deno.env.get("CIRCLEBACK_ADMIN_SECRET") ?? ""

// From the webhook step of the Circleback automation. Once this is set,
// every meeting request must carry a valid x-signature or the admin secret.
// Unset = requests are accepted unverified, as before, with a warning.
const SIGNING_SECRET = Deno.env.get("CIRCLEBACK_SIGNING_SECRET") ?? ""

// Dates and times are written in Sam's time zone, so a 9pm call is not
// filed under tomorrow.
const TIME_ZONE = Deno.env.get("SAM_TIME_ZONE") ?? "America/New_York"

// A large group call (a community meetup, a webinar) would flood Needs
// review. Above this many new people, existing contacts are still linked
// but nobody new is added; they can be added from the meeting by hand.
const MAX_NEW_CONTACTS = (() => {
  const n = Number(Deno.env.get("MAX_NEW_CONTACTS_PER_MEETING") ?? "8")
  return Number.isFinite(n) && n >= 0 ? n : 8
})()

// A claim older than this is assumed dead (function timed out, cold start
// killed it) and may be taken over by a later delivery.
const STALE_CLAIM_MS = 10 * 60 * 1000

// Long calls produce long transcripts. The notes carry the substance, so
// the transcript is capped to keep the Claude call fast and affordable.
const TRANSCRIPT_CHAR_LIMIT = 120_000

// Sam's own addresses: never matched as a contact, never the recipient of
// his own follow-up. SELF_EMAILS adds more, comma-separated.
const SELF_ADDRESSES = [
  "sam.blinson@gmail.com",
  ...(Deno.env.get("SELF_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
]

// Deterministic company routing by attendee email. Checked before asking
// Claude, because a domain match is not a judgement call.
// VERIFY these ids against `select id, name from companies;` — they come
// from the scheduled task's notes, not from the database.
const COMPANY_BY_DOMAIN: Record<string, string> = {
  "inuaai.com":          "co_1782329982318_4ia",  // Apex Property Media
  "eduplusintl.com":     "co_1782329982318_4ia",
  "apexpropertymedia.com": "co_1782329982318_4ia",
}
const COMPANY_BY_EMAIL: Record<string, string> = {
  "dmillary@gmail.com":  "co_1782329982318_4ia",  // David Millary
  "bevans512@gmail.com": "co_1782329982318_4ia",  // Brian Evans
}
// Extra context for Claude's pick, by company id. Optional: a company with no
// hint here is still offered, using its name from the database.
const COMPANY_HINTS: Record<string, string> = {
  "co_1782329982318_4ia": "photo editing, CTA site, credits, photographers, David Millary, Brian Evans, inuaai",
  "refuge-homes":  "faith-based affordable housing fund, Dana, Blake, LPs, investors, DAFs",
  "flip-projects": "fix-and-flip, 210 East Crestview Smithfield, Alejandro, contractors",
  "content":       "samblinson.com, coaching, personal brand",
  "mayfly":        "Mayfly",
  "personal":      "personal, family, non-business",
  "admin":         "bookkeeping, taxes, insurance, internal admin",
}

const STAGES = ["nurturing", "in_conversation", "proposal_out", "client", "past_client", "network"] as const
const NETWORK_LABELS = ["referral_partner", "collaborator", "personal"] as const
const STAGE_LABELS: Record<string, string> = {
  nurturing: "Nurturing", in_conversation: "In conversation", proposal_out: "Proposal out",
  client: "Client", past_client: "Past client", network: "Network", needs_review: "Needs review",
}

// When Claude gives no stage for a new person, fall back on the
// relationship type it gave the call as a whole.
const STAGE_FROM_RELATIONSHIP: Record<string, { stage: string; label: string | null }> = {
  warm_existing_client: { stage: "client",          label: null },
  new_prospect:         { stage: "in_conversation", label: null },
  peer_partner:         { stage: "network",         label: "collaborator" },
  internal_team:        { stage: "network",         label: "collaborator" },
  vendor:               { stage: "network",         label: null },
}

const SYSTEM_PROMPT = `
You are Sam Blinson's chief of staff. Sam just finished a call (captured by Circleback). Do SEVEN jobs and return ONLY valid JSON — no markdown fences, no preamble.

Sam is a strategy consultant / operator. Circleback already captured some action items (provided, with assignees).

JOB 1 — FINAL TASK LIST (for Sprint HQ):
The list Sam has to work from. Keep it to what the call actually produced.
- Include every Circleback action item assigned to Sam, rephrased as a clear verb-first task. Do NOT include items assigned to other people.
- Include a commitment Sam made in the notes that Circleback missed.
- You may add AT MOST 2 follow-ups that were not stated, and only where the call clearly implies one and leaving it out would drop the ball. A decision that has to be made, a real blocker, a hard deadline. Set "inferred": true on those.
- Do NOT pad. Do NOT invent CRM hygiene, "log this", "create a record", "define criteria", "identify the contact", or generic relationship-management busywork. If the call produced three tasks, return three tasks.
There is no minimum. The ceiling is 8. Fewer is better.
Rules: concrete and executable, verb-first titles. priority: "high" = do this week, "medium" = this sprint, "low" = later. due_date = "YYYY-MM-DD" computed relative to the TODAY value provided, or null.

JOB 2 — RELATIONSHIP EVALUATION:
Using the attendees and the PEOPLE ON THIS CALL section (what Sam's records already say about each person), classify the relationship and therefore the right follow-up email type. Choose exactly one type: "warm_existing_client" | "new_prospect" | "peer_partner" | "vendor" | "internal_team". Give a one-line rationale.

JOB 3 — FOLLOW-UP EMAIL DRAFT:
Write the follow-up email in Sam's voice, matching the relationship type. For warm existing clients/partners: warm but professional, no stiff formality. Recap the key DECISIONS made on the call, confirm who owns what next, and close with one clear next step. 150–250 words, plain text, tight, no filler. Address the primary counterpart by first name. Sign as "Sam".

JOB 4 — COMPANY:
Pick the company this call belongs to from the COMPANY OPTIONS list in the payload. Return its exact id string. If the call does not clearly belong to any of them, return null. Do not guess from a single passing mention.

JOB 5 — SUMMARY:
Two plain sentences, 50 words at most, that Sam will read later as "last time we talked". First sentence: what the call was about. Second: where it landed or what happens next. No markdown, no bullet points, do not start with "Sam".

JOB 6 — NEW PEOPLE:
For each person in the NEW PEOPLE section (and only those), suggest where they stand with Sam:
- "nurturing": a relationship being built, no talk of working together yet
- "in_conversation": a need is on the table or working together came up
- "proposal_out": a scope or price is in their hands
- "client": paying Sam now, or on the team of a client he serves
- "past_client": an engagement that has ended
- "network": a referral partner, collaborator, teammate, vendor, or personal contact
For "network", also give network_label: "referral_partner" | "collaborator" | "personal" | null.
company: their business name if the call or a non-personal email domain makes it clear, otherwise "".
If the NEW PEOPLE section says none, return an empty array.

JOB 7 — FOLLOW-UP TIMING:
Only where the call explicitly names when Sam and a specific attendee will next connect ("let's reconnect after the holidays", "talk again in two weeks", "I'll check in once the proposal is reviewed Friday"), return that attendee's email, the date as "YYYY-MM-DD" computed from TODAY, and a short reason (under 12 words, e.g. "reconnect after the holidays"). Use the attendee emails exactly as listed. Do not invent cadences or default check-ins. Return an empty array when no timing was named.

Return ONLY this JSON shape:
{
  "tasks": [ { "title": "", "notes": "", "priority": "high|medium|low", "due_date": "YYYY-MM-DD or null", "inferred": false } ],
  "relationship": { "type": "", "rationale": "" },
  "email": { "subject": "", "body": "" },
  "company_id": "<id or null>",
  "summary": "",
  "people": [ { "email": "", "suggested_stage": "", "network_label": null, "company": "" } ],
  "follow_ups": [ { "email": "", "date": "YYYY-MM-DD", "reason": "" } ]
}`.trim()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

// ── Small helpers ─────────────────────────────────────────────
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))
const lower = (v: unknown) => str(v).trim().toLowerCase()
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const isPlaceholder = (name: string) => /^participant\s*\d*$/i.test(name.trim())
const isFullName = (name: string) => name.trim().includes(" ") && !isPlaceholder(name)
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ""
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CIRCLEBACK_ID = /^[A-Za-z0-9_-]{6,64}$/
const uuid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()

function localParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }
}

// ── Request verification ──────────────────────────────────────
async function hmacHex(secret: string, body: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, body)
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function validSignature(req: Request, body: ArrayBuffer): Promise<boolean> {
  const provided = lower(req.headers.get("x-signature"))
  if (!SIGNING_SECRET || !provided) return false
  return safeEqual(await hmacHex(SIGNING_SECRET, body), provided)
}

const hasAdminSecret = (payload: any) =>
  !!ADMIN_SECRET && typeof payload?.secret === "string" && safeEqual(payload.secret, ADMIN_SECRET)

// ── Circleback notes (same rules as src/utils/circleback.js) ─────
function stripInline(s: string) {
  return s
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

function trimBlank(lines: string[]) {
  const out = [...lines]
  while (out.length && out[0] === "") out.shift()
  while (out.length && out[out.length - 1] === "") out.pop()
  return out
}

function parseSections(markdown: string) {
  const sections: { heading: string; lines: string[] }[] = []
  let current = { heading: "", lines: [] as string[] }
  markdown.replace(/\r/g, "").split("\n").forEach((raw) => {
    const line = raw.replace(/\s+$/, "")
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      if (current.heading || current.lines.length) sections.push(current)
      current = { heading: stripInline(heading[1]), lines: [] }
      return
    }
    const bullet = line.match(/^(\s*)[*+-]\s+(.*)$/)
    if (bullet) {
      const indent = bullet[1].length >= 2 ? "   " : ""
      current.lines.push(`${indent}• ${stripInline(bullet[2])}`)
      return
    }
    if (!line.trim()) {
      if (current.lines.length && current.lines[current.lines.length - 1] !== "") current.lines.push("")
      return
    }
    current.lines.push(stripInline(line))
  })
  if (current.heading || current.lines.length) sections.push(current)
  return sections.map((s) => ({ ...s, lines: trimBlank(s.lines) })).filter((s) => s.heading || s.lines.length)
}

function notesToText(markdown: string) {
  return parseSections(markdown)
    .map((s) => [s.heading, ...s.lines].filter((l, i) => i > 0 || l).join("\n"))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function overviewOf(markdown: string) {
  const sections = parseSections(markdown)
  if (!sections.length) return ""
  const overview = sections.find((s) => /^(overview|summary)$/i.test(s.heading)) ?? sections[0]
  return overview.lines.join("\n").trim()
}

// ── Payload ───────────────────────────────────────────────────
type Attendee = { name: string; email: string }

// The webhook posts Circleback's own shape (id, name, createdAt, notes,
// attendees, actionItems, transcript as segments). A scheduled task may
// wrap it as { meeting: {...} }. Accept either.
function readMeeting(payload: any) {
  const m = payload.meeting ?? payload.data ?? payload ?? {}
  const linkId = str(m.linkId ?? m.link_id ?? m.id ?? m.meetingId ?? payload.id).trim()
  const started = localParts(m.createdAt ?? m.created_at ?? m.startedAt ?? null)
  const date = ISO_DATE.test(str(m.date)) ? str(m.date) : started.date || localParts(nowIso()).date

  const transcriptRaw = Array.isArray(m.transcript)
    ? m.transcript.map((s: any) => `${str(s?.speaker) || "?"}: ${str(s?.text)}`).join("\n")
    : str(m.transcript)
  const transcript = transcriptRaw.length > TRANSCRIPT_CHAR_LIMIT
    ? transcriptRaw.slice(0, TRANSCRIPT_CHAR_LIMIT) + "\n[transcript truncated]"
    : transcriptRaw

  const attendees: Attendee[] = arr(payload.attendees ?? m.attendees)
    .map((a: any) => ({ name: str(a?.name).trim(), email: lower(a?.email) }))
    .filter((a) => a.name || a.email)

  return {
    linkId,
    title: str(m.title ?? m.name).trim() || "Untitled meeting",
    date,
    time: started.time,
    notesMarkdown: str(m.notes),
    transcript,
    actionItems: arr(m.action_items ?? m.actionItems),
    attendees,
    // Circleback's recordingUrl is a file link that expires after 24 hours,
    // so the meeting page is what gets stored.
    meetingUrl: CIRCLEBACK_ID.test(linkId) ? `https://circleback.ai/meetings/${linkId}` : "",
  }
}

// ── Contacts ──────────────────────────────────────────────────
type ContactRow = {
  id: string; name: string | null; email: string | null; company: string | null
  company_id: string | null; stage: string | null; network_label: string | null
  notes: string | null; next_touch_on: string | null; next_touch_reason: string | null
}
const CONTACT_COLUMNS = "id, name, email, company, company_id, stage, network_label, notes, next_touch_on, next_touch_reason"

type MeetingRow = {
  id: string; external_id: string | null; title: string | null; date: string | null
  summary: string | null; notes: string | null; contact_ids: unknown; attendees: string | null
}

// Same rule as meetingMatchesContact in src/utils/relationships.js: listed
// in contact_ids, or (older meetings) the attendee text has their email.
function meetingHasContact(m: MeetingRow, c: ContactRow) {
  if (arr(m.contact_ids).includes(c.id)) return true
  const email = lower(c.email)
  if (!email || !m.attendees) return false
  return m.attendees.toLowerCase().split(/[\s,;<>()"]+/).includes(email)
}

function matchAttendees(attendees: Attendee[], contacts: ContactRow[], ignore: Set<string>) {
  const self = new Set(SELF_ADDRESSES)
  const byEmail = new Map<string, ContactRow>()
  contacts.forEach((c) => { const e = lower(c.email); if (e && !byEmail.has(e)) byEmail.set(e, c) })

  const matched: ContactRow[] = []
  const matchedEmail = new Map<string, string>()   // attendee email -> contact id
  const newPeople: Attendee[] = []
  const seen = new Set<string>()

  for (const a of attendees) {
    if (a.email && self.has(a.email)) continue
    let c = a.email ? byEmail.get(a.email) : undefined
    if (!c && isFullName(a.name)) c = contacts.find((x) => lower(x.name) === lower(a.name))
    if (c) {
      if (!matched.some((x) => x.id === c!.id)) matched.push(c)
      if (a.email) matchedEmail.set(a.email, c.id)
      continue
    }
    if (!a.email || ignore.has(a.email) || seen.has(a.email)) continue
    seen.add(a.email)
    newPeople.push({ name: isPlaceholder(a.name) ? "" : a.name, email: a.email })
  }
  return { matched, matchedEmail, newPeople }
}

function contextFor(c: ContactRow, meetings: MeetingRow[], currentLinkId: string) {
  const lines = [
    `- ${c.name || "(no name)"} <${c.email || "no email"}> · stage: ${STAGE_LABELS[c.stage ?? ""] ?? c.stage ?? "unknown"}`
      + (c.company ? ` · company: ${c.company}` : "")
      + (c.next_touch_on ? ` · next touch ${c.next_touch_on}${c.next_touch_reason ? ` (${clip(c.next_touch_reason, 80)})` : ""}` : ""),
  ]
  if (c.notes?.trim()) lines.push(`  Profile: ${clip(c.notes.trim().replace(/\s+/g, " "), 600)}`)
  const last = meetings
    .filter((m) => m.external_id !== currentLinkId && meetingHasContact(m, c))
    .slice(0, 2)
  if (last.length) {
    lines.push("  Last meetings:")
    last.forEach((m) => {
      const text = (m.summary || m.notes || "").trim().replace(/\s+/g, " ")
      lines.push(`    ${m.date ?? "?"} ${m.title || "Meeting"}: ${clip(text, 300) || "(no notes)"}`)
    })
  } else {
    lines.push("  Last meetings: none on file")
  }
  return lines.join("\n")
}

// One contact per email. Look first, insert if missing, and if someone else
// (the app, another delivery) created the same address in between, the
// unique index refuses the insert and the existing row is used instead.
async function findOrCreateContact(sb: any, userId: string, row: Record<string, unknown>) {
  const email = lower(row.email)
  const lookup = async () => {
    const escaped = email.replace(/[\\%_]/g, (ch) => `\\${ch}`)
    const { data, error } = await sb.from("contacts").select(CONTACT_COLUMNS)
      .eq("user_id", userId).ilike("email", escaped)
    if (error) throw new Error(`contact lookup failed: ${error.message}`)
    return (data ?? []).find((c: ContactRow) => lower(c.email) === email) ?? null
  }
  const found = await lookup()
  if (found) return { contact: found as ContactRow, created: false }

  const { error } = await sb.from("contacts").insert(row)
  if (!error) return { contact: row as unknown as ContactRow, created: true }
  if (error.code !== "23505") throw new Error(`contact insert failed: ${error.message}`)
  const raced = await lookup()
  if (!raced) throw new Error(`contact insert conflicted but no contact has ${email}`)
  return { contact: raced as ContactRow, created: false }
}

// ── Meetings ──────────────────────────────────────────────────
// One row per Circleback id. A row the app already saved for this meeting
// (pasted link, Notion import) keeps its id and anything already filled in;
// this only adds people and fills blanks.
async function saveMeeting(sb: any, userId: string, row: Record<string, any>) {
  const cols = "id, title, time, attendees, company_id, notes, summary, recording_url, contact_ids, action_items"
  const lookup = async () => {
    const { data, error } = await sb.from("meetings").select(cols)
      .eq("user_id", userId).eq("external_id", row.external_id).maybeSingle()
    if (error) throw new Error(`meeting lookup failed: ${error.message}`)
    return data
  }

  let existing = await lookup()
  if (!existing) {
    const { error } = await sb.from("meetings").insert(row)
    if (!error) return { id: row.id as string, created: true }
    if (error.code !== "23505") throw new Error(`meeting insert failed: ${error.message}`)
    existing = await lookup()
    if (!existing) throw new Error("meeting insert conflicted but no meeting has this id")
  }

  const blank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "")
  const pick = (have: unknown, add: unknown) => (blank(have) ? add : have)
  const { error } = await sb.from("meetings").update({
    title: blank(existing.title) || /^untitled/i.test(existing.title) ? row.title : existing.title,
    time: pick(existing.time, row.time),
    attendees: pick(existing.attendees, row.attendees),
    company_id: pick(existing.company_id, row.company_id),
    notes: pick(existing.notes, row.notes),
    summary: pick(existing.summary, row.summary),
    recording_url: pick(existing.recording_url, row.recording_url),
    contact_ids: [...new Set([...arr(existing.contact_ids), ...arr(row.contact_ids)])],
    action_items: arr(existing.action_items).length ? existing.action_items : row.action_items,
    updated_at: nowIso(),
  }).eq("user_id", userId).eq("id", existing.id)
  if (error) throw new Error(`meeting update failed: ${error.message}`)
  return { id: existing.id as string, created: false }
}

// Action items in the app's shape. Sam's read as-is; everyone else's are
// prefixed with their first name so the list says who owes what.
function appActionItems(items: any[]) {
  const self = new Set(SELF_ADDRESSES)
  return items.map((ai) => {
    const email = lower(ai?.assignee?.email)
    const mine = !ai?.assignee || (email && self.has(email))
    const owner = mine ? "" : firstName(str(ai.assignee?.name)) || email
    const title = str(ai?.title).trim()
    return {
      id: `ai_${uuid()}`,
      title: owner ? `${owner}: ${title}` : title,
      dueDate: null,
      done: lower(ai?.status) === "done" || ai?.done === true,
      taskId: null,
    }
  }).filter((ai) => ai.title)
}

function attendeeText(attendees: Attendee[]) {
  return attendees
    .filter((a) => a.email || (a.name && !isPlaceholder(a.name)))
    .map((a) => (a.name && !isPlaceholder(a.name) && a.email ? `${a.name} <${a.email}>` : (!isPlaceholder(a.name) && a.name) || a.email))
    .join(", ")
}

// ── Company resolution ────────────────────────────────────────
// Deterministic first: an attendee address is evidence, not inference.
function companyFromAttendees(attendees: Attendee[]): string | null {
  for (const a of attendees) {
    if (!a.email || SELF_ADDRESSES.includes(a.email)) continue
    if (COMPANY_BY_EMAIL[a.email]) return COMPANY_BY_EMAIL[a.email]
    const domain = a.email.split("@")[1]
    if (domain && COMPANY_BY_DOMAIN[domain]) return COMPANY_BY_DOMAIN[domain]
  }
  return null
}

// Best guess at who the follow-up is addressed to: first external attendee.
function primaryCounterpart(attendees: Attendee[]): string | null {
  for (const a of attendees) {
    if (a.email && !SELF_ADDRESSES.includes(a.email)) return a.email
  }
  return null
}

function parseClaudeJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned)
}

serve(async (req: Request) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SRK)
  // Always Sam. The caller never chooses whose account is written to.
  const userId = SAM_USER_ID
  let claimed: { userId: string; linkId: string } | null = null

  try {
    const body = await req.arrayBuffer()
    let payload: any
    try {
      payload = JSON.parse(new TextDecoder().decode(body))
    } catch {
      return json({ error: "body is not JSON" }, 400)
    }

    // ── Admin actions for the draft pass ────────────────────────
    // Gated on a shared secret: these return email bodies, and the anon
    // key that reaches this function is public.
    if (payload.action === "pending_drafts" || payload.action === "mark_draft") {
      if (!ADMIN_SECRET) return json({ error: "admin actions disabled: CIRCLEBACK_ADMIN_SECRET not set" }, 503)
      if (!hasAdminSecret(payload)) return json({ error: "unauthorized" }, 401)

      if (payload.action === "pending_drafts") {
        const { data, error } = await sb
          .from("circleback_processed")
          .select("link_id, meeting_title, company_id, draft_to, email_subject, email_body, processed_at")
          .eq("user_id", userId).eq("status", "done")
          .is("draft_created_at", null).not("email_subject", "is", null)
          .order("processed_at", { ascending: true }).limit(20)
        if (error) return json({ error: "query failed", detail: error }, 500)
        return json({ ok: true, pending: data ?? [] })
      }

      const linkId = str(payload.link_id).trim()
      if (!linkId) return json({ error: "link_id required" }, 400)
      const { error } = await sb
        .from("circleback_processed")
        .update({ draft_id: payload.draft_id ?? null, draft_created_at: nowIso() })
        .eq("user_id", userId).eq("link_id", linkId)
      if (error) return json({ error: "update failed", detail: error }, 500)
      return json({ ok: true, link_id: linkId, marked: true })
    }

    // ── Who is calling ──────────────────────────────────────────
    // Circleback signs with the automation's signing secret; a scheduled
    // task can send the admin secret instead. Until the signing secret is
    // set, requests are accepted as before so nothing breaks on deploy.
    const signed = await validSignature(req, body)
    const admin = hasAdminSecret(payload)
    if (SIGNING_SECRET && !signed && !admin) {
      return json({ error: "unauthorized: missing or invalid x-signature" }, 401)
    }
    if (!SIGNING_SECRET && !admin) {
      console.warn("circleback-meeting-processor: CIRCLEBACK_SIGNING_SECRET is not set; request accepted unverified")
    }

    // ── Normal webhook path ─────────────────────────────────────
    const mtg = readMeeting(payload)
    const linkId = mtg.linkId

    // Without a linkId there is no dedup key, and an untagged batch can never
    // be attributed to a meeting or cleaned up. Refuse rather than pollute.
    // 400 is deliberate: this is a payload-shape bug to fix, not a transient
    // failure worth retrying.
    if (!linkId) {
      const m = payload.meeting ?? payload.data ?? payload ?? {}
      return json({
        error: "missing linkId",
        hint: "no linkId/link_id/id found on payload.meeting, payload.data, or payload",
        received_keys: Object.keys(payload ?? {}),
        meeting_keys: Object.keys(m ?? {}),
      }, 400)
    }

    // The stored copy never keeps a secret a caller sent.
    const { secret: _secret, ...storedPayload } = payload

    // ── Claim the meeting before doing any work ──────────────────
    const { error: claimErr } = await sb
      .from("circleback_processed")
      .insert({
        user_id: userId, link_id: linkId, status: "processing",
        meeting_title: mtg.title,
        raw_payload: storedPayload,
      })

    if (claimErr) {
      // 23505 = unique violation: somebody already claimed this meeting.
      if (claimErr.code !== "23505") {
        return json({ error: "claim failed", detail: claimErr }, 500)
      }

      const { data: existing } = await sb
        .from("circleback_processed")
        .select("status, processed_at, tasks_created")
        .eq("user_id", userId).eq("link_id", linkId)
        .maybeSingle()

      const age = existing?.processed_at ? Date.now() - Date.parse(existing.processed_at) : Infinity
      const takeable = existing?.status === "failed" ||
                       (existing?.status === "processing" && age > STALE_CLAIM_MS)

      if (!takeable) {
        // Already done, or in flight right now. 200 so the webhook stops retrying.
        return json({
          ok: true, skipped: existing?.status === "done" ? "already_processed" : "in_flight",
          link_id: linkId, tasks_created: 0,
          previously_created: existing?.tasks_created ?? 0,
        })
      }

      // Take over the stale/failed claim. Guarding on the timestamp we read
      // means only one concurrent taker wins.
      const { data: taken } = await sb
        .from("circleback_processed")
        .update({ status: "processing", processed_at: nowIso() })
        .eq("user_id", userId).eq("link_id", linkId)
        .eq("processed_at", existing!.processed_at)
        .select("link_id")
      if (!taken || taken.length === 0) {
        return json({ ok: true, skipped: "in_flight", link_id: linkId, tasks_created: 0 })
      }
    }

    claimed = { userId, linkId }

    const today = ISO_DATE.test(str(payload.today)) ? str(payload.today) : localParts(nowIso()).date
    const dryRun = payload.dry_run === true

    // ── What SprintHQ already knows ─────────────────────────────
    const [contactsRes, settingsRes, meetingsRes, companiesRes] = await Promise.all([
      sb.from("contacts").select(CONTACT_COLUMNS).eq("user_id", userId),
      sb.from("app_state").select("value").eq("user_id", userId).eq("key", "settings").maybeSingle(),
      sb.from("meetings").select("id, external_id, title, date, summary, notes, contact_ids, attendees")
        .eq("user_id", userId).order("date", { ascending: false, nullsFirst: false }).limit(400),
      sb.from("companies").select("id, name").eq("user_id", userId),
    ])
    for (const r of [contactsRes, settingsRes, meetingsRes, companiesRes]) {
      if (r.error) throw new Error(`read failed: ${r.error.message}`)
    }
    const contacts = (contactsRes.data ?? []) as ContactRow[]
    const recentMeetings = (meetingsRes.data ?? []) as MeetingRow[]
    const companyRows = (companiesRes.data ?? []) as { id: string; name: string }[]
    // "Not a contact" in the Needs review sheet adds the address here.
    const ignore = new Set(arr(settingsRes.data?.value?.contactIgnore).map(lower).filter(Boolean))

    const { matched, matchedEmail, newPeople: unknownPeople } = matchAttendees(mtg.attendees, contacts, ignore)
    const tooManyNew = unknownPeople.length > MAX_NEW_CONTACTS
    const newPeople = tooManyNew ? [] : unknownPeople

    // Explicit company on the payload wins, then an attendee address match,
    // then a matched contact's Client/Area, then Claude's pick from the
    // list (applied after the review).
    // Each candidate must be a company that exists, so a stale id in the
    // address map falls through to the next source instead of winning.
    const validIds = new Set(companyRows.map((c) => c.id))
    const valid = (id: unknown) => (typeof id === "string" && validIds.has(id) ? id : null)
    const explicitCompany = valid(payload.company_id)
    const addressCompany = valid(companyFromAttendees(mtg.attendees))
    const contactCompany = matched.map((c) => valid(c.company_id)).find(Boolean) ?? null
    const matchedCompany = explicitCompany ?? addressCompany ?? contactCompany

    const aiLines = mtg.actionItems.map((i: any) => `- [${str(i.assignee?.name ?? i.assignee) || "unassigned"}] ${str(i.title)}${i.description ? ": " + str(i.description) : ""}`)
    const attLines = mtg.attendees.map((a) => `- ${a.name || "?"} (${a.email || "no email"})`)

    const userMessage = [
      `TODAY: ${today}`,
      `Meeting: ${mtg.title}`,
      `Date: ${mtg.date}`,
      "",
      "--- COMPANY OPTIONS (for JOB 4) ---",
      matchedCompany
        ? `Already resolved: ${matchedCompany}. Return this id.`
        : companyRows.map((c) => `- id:"${c.id}" name:"${c.name}"${COMPANY_HINTS[c.id] ? ` — ${COMPANY_HINTS[c.id]}` : ""}`).join("\n") || "(none on file — return null)",
      "",
      "--- ATTENDEES ---",
      attLines.length ? attLines.join("\n") : "None listed",
      "",
      "--- PEOPLE ON THIS CALL (Sam's records) ---",
      matched.length ? matched.map((c) => contextFor(c, recentMeetings, linkId)).join("\n") : "None of the attendees are in Sam's records yet.",
      "",
      "--- NEW PEOPLE (for JOB 6) ---",
      newPeople.length ? newPeople.map((p) => `- ${p.name || "(no name)"} <${p.email}>`).join("\n") : "None",
      "",
      "--- CIRCLEBACK NOTES ---",
      mtg.notesMarkdown || "(none)",
      "",
      "--- CIRCLEBACK ACTION ITEMS (with assignees) ---",
      aiLines.length ? aiLines.join("\n") : "None",
      "",
      mtg.transcript ? `--- FULL TRANSCRIPT ---\n${mtg.transcript}` : "",
    ].filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim()

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 6000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
    })
    const claudeData = await claudeRes.json().catch(() => ({}))
    const rawOutput: string = claudeData.content?.[0]?.text ?? ""
    if (!claudeRes.ok || !rawOutput) {
      await release(sb, claimed, "failed")
      return json({ error: "claude call failed", status: claudeRes.status, detail: claudeData?.error ?? null }, 502)
    }

    let analysis: {
      tasks?: any[]; relationship?: any; email?: any; company_id?: string | null
      summary?: string; people?: any[]; follow_ups?: any[]
    }
    try {
      analysis = parseClaudeJson(rawOutput)
    } catch {
      await release(sb, claimed, "failed")
      return json({ error: "parse failed", raw: rawOutput }, 500)
    }

    // Only accept a company id that actually exists in this user's
    // companies. The domain map above is hand-maintained and can go stale;
    // writing an id that points at nothing is worse than writing null.
    const claudeCompany = valid(analysis.company_id)
    const companyId = matchedCompany ?? claudeCompany

    const summary = clip(str(analysis.summary).trim(), 400) || clip(overviewOf(mtg.notesMarkdown), 400)
    const relType = str(analysis.relationship?.type)

    // New people, with the stage the call suggests.
    const suggestionByEmail = new Map(arr(analysis.people).map((p: any) => [lower(p?.email), p]))
    const plannedPeople = newPeople.map((p) => {
      const s = suggestionByEmail.get(p.email)
      const fallback = STAGE_FROM_RELATIONSHIP[relType]
      const stage = (STAGES as readonly string[]).includes(str(s?.suggested_stage)) ? str(s.suggested_stage) : fallback?.stage ?? null
      const label = stage === "network"
        ? ((NETWORK_LABELS as readonly string[]).includes(str(s?.network_label)) ? str(s.network_label) : fallback?.stage === "network" ? fallback.label : null)
        : null
      return {
        id: `con_${uuid()}`,
        user_id: userId,
        name: p.name || p.email.split("@")[0],
        email: p.email,
        company: clip(str(s?.company).trim(), 120),
        company_id: stage === "client" ? companyId : null,
        stage: "needs_review",
        suggested_stage: stage,
        network_label: label,
        source: "circleback",
        source_ref: linkId,
        last_contact_date: mtg.date,
        tags: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      }
    })

    // Follow-up timing named on the call, for people on it.
    const followUps = arr(analysis.follow_ups)
      .map((f: any) => ({ email: lower(f?.email), date: str(f?.date), reason: clip(str(f?.reason).trim(), 120) }))
      .filter((f) => f.email && ISO_DATE.test(f.date) && f.date >= today)

    const tasks = arr(analysis.tasks)
    const crm = {
      matched: matched.length,
      added_to_review: 0,
      new_people_skipped: tooManyNew ? unknownPeople.length : 0,
      meeting: "" as "" | "created" | "updated",
      meeting_id: "" as string,
      next_touches_set: 0,
    }
    let tasksCreated = 0
    const insertedRows: any[] = []

    if (!dryRun) {
      // 1. Contacts. Safe to repeat: an address that exists is reused.
      const contactIdByEmail = new Map(matchedEmail)
      const meetingContactIds = matched.map((c) => c.id)
      for (const row of plannedPeople) {
        const { contact, created } = await findOrCreateContact(sb, userId, row)
        contactIdByEmail.set(row.email, contact.id)
        if (!meetingContactIds.includes(contact.id)) meetingContactIds.push(contact.id)
        if (created) crm.added_to_review++
      }

      // 2. The meeting. Safe to repeat: keyed on the Circleback id.
      const saved = await saveMeeting(sb, userId, {
        id: `mtg_${uuid()}`,
        user_id: userId,
        title: mtg.title,
        date: mtg.date,
        time: mtg.time,
        attendees: attendeeText(mtg.attendees),
        company_id: companyId,
        project_id: null,
        goal_id: null,
        notes: notesToText(mtg.notesMarkdown),
        action_items: appActionItems(mtg.actionItems),
        contact_ids: meetingContactIds,
        external_id: linkId,
        summary,
        recording_url: mtg.meetingUrl,
        source: "circleback",
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      crm.meeting = saved.created ? "created" : "updated"
      crm.meeting_id = saved.id

      // 3. Next touch from the call. A next touch already set for a later
      // date is Sam's call and stays as it is.
      for (const f of followUps) {
        const id = contactIdByEmail.get(f.email)
        if (!id) continue
        const { data, error } = await sb.from("contacts")
          .update({ next_touch_on: f.date, next_touch_reason: `From call: ${f.reason || mtg.title}`, updated_at: nowIso() })
          .eq("user_id", userId).eq("id", id)
          .or(`next_touch_on.is.null,next_touch_on.lte.${today}`)
          .select("id")
        if (error) throw new Error(`next touch update failed: ${error.message}`)
        crm.next_touches_set += data?.length ?? 0
      }

      // 4. Tasks, last: the one write that is not safe to repeat.
      if (tasks.length > 0) {
        const rows = tasks.map((t: any) => ({
          id: crypto.randomUUID(), user_id: userId,
          title: t.title,
          notes: [t.notes ?? "", `From: ${mtg.title} (${mtg.date}) · Circleback`, mtg.meetingUrl, `[circleback:${linkId}]`].filter(Boolean).join("\n"),
          company_id: companyId,
          status: "todo", priority: t.priority ?? "medium",
          due_date: (t.due_date && t.due_date !== "null" && ISO_DATE.test(str(t.due_date))) ? t.due_date : null,
          created_at: nowIso(), updated_at: nowIso(),
        }))
        const { error } = await sb.from("tasks").insert(rows)
        if (error) {
          await release(sb, claimed, "failed")
          return json({ error: "supabase insert failed", detail: error }, 500)
        }
        tasksCreated = rows.length
        insertedRows.push(...rows.map((r) => ({ id: r.id, title: r.title, priority: r.priority, due_date: r.due_date })))
      }
    }

    // A dry run must not consume the claim, or the real delivery is skipped.
    if (dryRun) {
      await releaseRow(sb, claimed)
    } else {
      await sb.from("circleback_processed").update({
        status: "done",
        tasks_created: tasksCreated,
        company_id: companyId,
        email_subject: analysis.email?.subject ?? null,
        email_body: analysis.email?.body ?? null,
        draft_to: primaryCounterpart(mtg.attendees),
        processed_at: nowIso(),
      }).eq("user_id", userId).eq("link_id", linkId)
    }

    return json({
      ok: true, meeting: mtg.title, link_id: linkId, dry_run: dryRun,
      verified: signed ? "signature" : admin ? "admin_secret" : "unverified",
      tasks_created: tasksCreated,
      company_id: companyId,
      company_source: explicitCompany ? "payload" : addressCompany ? "attendee_domain" : contactCompany ? "contact" : claudeCompany ? "claude" : "unresolved",
      tasks: dryRun ? tasks : insertedRows,
      relationship: analysis.relationship ?? null,
      email: analysis.email ?? null,
      summary,
      crm: dryRun
        ? { ...crm, would_add: plannedPeople.map((p) => ({ email: p.email, suggested_stage: p.suggested_stage, company: p.company })), follow_ups: followUps }
        : crm,
    })
  } catch (err) {
    if (claimed) await release(sb, claimed, "failed")
    return json({ error: String(err) }, 500)
  }
})

async function release(sb: any, c: { userId: string; linkId: string }, status: string, tasksCreated = 0) {
  await sb.from("circleback_processed")
    .update({ status, tasks_created: tasksCreated, processed_at: nowIso() })
    .eq("user_id", c.userId).eq("link_id", c.linkId)
}

async function releaseRow(sb: any, c: { userId: string; linkId: string }) {
  await sb.from("circleback_processed")
    .delete().eq("user_id", c.userId).eq("link_id", c.linkId)
}

// Gmail -> Relationships CRM, for SprintHQ.
//
// Runs every hour from the schedule in migration 007, and on demand when
// the app asks (right after Google is connected, and Sync now in Settings).
// It reads message HEADERS only (gmail.metadata scope): who, when, subject.
// Message bodies never leave Gmail.
//
// For each Google connection:
//   1. First run (backfill): reads threads you sent in, and threads in your
//      Primary inbox category, back backfill_days (default 90). Progress is
//      saved after every page, so a long backfill finishes over several runs.
//   2. After that: reads only what changed since the last run, using Gmail's
//      history. If Gmail no longer has that history (a long pause), it
//      backfills the last 14 days instead.
//   3. Skips automated mail: mailing lists, newsletters, auto-replies and
//      no-reply senders.
//   4. Matches people to contacts by email. A thread with at least one
//      contact on it is saved to email_threads (subject, people, dates,
//      direction) and moves those contacts' last_contact_date forward.
//   5. Adds people you wrote to (To line, up to 4 new people per message) to
//      Needs review with source 'gmail'. People who only wrote to you, Cc'd
//      people and addresses on the Needs review ignore list are not added.
//
// Callers:
//   - the schedule: header x-sync-secret = GMAIL_SYNC_SECRET; syncs every
//     connection, in the background
//   - the app: the signed-in user's token; syncs that user and waits
//
// Each connection is locked while it syncs (sync_started_at), so an hourly
// run and a Sync now never overlap. A lock older than 15 minutes is
// treated as abandoned.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_SECRET  same as google-auth
//   GMAIL_SYNC_SECRET     the value migration 007 prints
// Optional:
//   GOOGLE_TOKEN_KEY      same as google-auth, if set there
//   SELF_EMAILS           other addresses that are you, comma-separated
//   SAM_TIME_ZONE         for last contact dates (default America/New_York)
//
// Deployed as Gmail-sync (the app and the schedule call that exact name;
// function names are case-sensitive). Deploy with "Verify JWT" OFF: the
// schedule has no user token. This function checks every caller itself.
// Requires migrations 006 and 007.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""
const TOKEN_KEY     = Deno.env.get("GOOGLE_TOKEN_KEY") ?? ""
const SYNC_SECRET   = Deno.env.get("GMAIL_SYNC_SECRET") ?? ""
const TIME_ZONE     = Deno.env.get("SAM_TIME_ZONE") ?? "America/New_York"
const EXTRA_SELF    = (Deno.env.get("SELF_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)

// Wall-clock budget for one invocation. Supabase stops a function at 150
// seconds on the free plan; this leaves room to save progress.
const RUN_BUDGET_MS = Number(Deno.env.get("GMAIL_SYNC_BUDGET_MS") ?? "110000")
const STALE_LOCK_MS = 15 * 60 * 1000
const RECOVERY_DAYS = 14
const MAX_NEW_PER_MESSAGE = 4
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.metadata"

// Gmail allows 250 quota units per user per second; reading a thread costs
// 10. Six at a time, started at least 70 ms apart, stays well under.
const FETCH_CONCURRENCY = 6
const FETCH_GAP_MS = 70

const BACKFILL_LABELS = ["SENT", "CATEGORY_PERSONAL"] as const
const SKIP_LABELS = new Set(["DRAFT", "SPAM", "TRASH", "CHAT"])
const HEADERS = ["From", "To", "Cc", "Subject", "List-Id", "List-Unsubscribe", "Precedence", "Auto-Submitted"]

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

const ALLOWED_ORIGINS = new Set([
  "https://wolfpackfan13.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
])

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? ""
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://wolfpackfan13.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
class ReauthError extends Error {}
class HistoryGone extends Error {}

const nowIso = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const lower = (s: unknown) => String(s ?? "").trim().toLowerCase()

function localDate(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Encryption (same as google-auth; keep them in step) ───────
const unb64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function tokenKey(): Promise<CryptoKey> {
  const material = TOKEN_KEY || CLIENT_SECRET
  if (!material) throw new Error("GOOGLE_CLIENT_SECRET is not set on this function yet.")
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(material), "HKDF", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("sprinthq"), info: new TextEncoder().encode("google-refresh-token-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  )
}

async function decryptToken(stored: string): Promise<string> {
  const [v, iv, ct] = String(stored).split(".")
  if (v !== "v1" || !iv || !ct) throw new ReauthError("The stored Google key is unreadable. Connect Google again.")
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await tokenKey(), unb64u(ct))
    return new TextDecoder().decode(plain)
  } catch {
    throw new ReauthError("The stored Google key no longer matches this function's secret. Connect Google again.")
  }
}

async function accessTokenFor(conn: Connection): Promise<string> {
  if (!conn.client_id) throw new ReauthError("Connect Google again to finish setup.")
  const refreshToken = await decryptToken(conn.refresh_token)
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: conn.client_id, client_secret: CLIENT_SECRET,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }).toString(),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (body?.error === "invalid_grant") {
      throw new ReauthError("Google withdrew SprintHQ's access. Connect Google again.")
    }
    throw new Error(`Google token refresh failed (${body?.error ?? res.status})`)
  }
  const scopes = String(body.scope ?? conn.scopes ?? "")
  if (!scopes.split(/\s+/).includes(GMAIL_SCOPE)) {
    throw new ReauthError("Gmail access is off for SprintHQ. Connect Google again and leave Gmail ticked.")
  }
  return body.access_token
}

// ── Gmail calls ───────────────────────────────────────────────
// One shared pacer per invocation: concurrency cap plus a minimum gap
// between request starts, with retries on rate limits and server errors.
function makeGmail(accessToken: string) {
  let active = 0
  let lastStart = 0
  const waiters: (() => void)[] = []

  async function slot() {
    while (active >= FETCH_CONCURRENCY) await new Promise<void>((r) => waiters.push(r))
    active++
    const wait = lastStart + FETCH_GAP_MS - Date.now()
    lastStart = Math.max(Date.now(), lastStart + FETCH_GAP_MS)
    if (wait > 0) await sleep(wait)
  }
  function release() {
    active--
    waiters.shift()?.()
  }

  async function get(path: string, params: Record<string, string | string[]> = {}): Promise<any> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      for (const one of Array.isArray(v) ? v : [v]) if (one !== undefined && one !== "") qs.append(k, one)
    }
    const url = `${GMAIL}${path}${qs.size ? `?${qs}` : ""}`
    for (let attempt = 0; ; attempt++) {
      await slot()
      let res: Response
      try {
        res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      } catch (err) {
        release()
        if (attempt < 3) { await sleep(500 * 2 ** attempt); continue }
        throw new Error(`Couldn't reach Gmail: ${(err as Error).message}`)
      }
      release()
      if (res.ok) return res.json()
      const body = await res.json().catch(() => ({}))
      const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? ""
      const limited = res.status === 429 || (res.status === 403 && /rateLimit|userRateLimit/i.test(reason))
      if ((limited || res.status >= 500) && attempt < 4) {
        const after = Number(res.headers.get("Retry-After"))
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 800 * 2 ** attempt)
        continue
      }
      if (res.status === 401) throw new ReauthError("Google rejected SprintHQ's pass. Connect Google again.")
      if (res.status === 403 && /insufficient/i.test(JSON.stringify(body))) {
        throw new ReauthError("Gmail access is off for SprintHQ. Connect Google again and leave Gmail ticked.")
      }
      if (res.status === 404 && path === "/history") throw new HistoryGone()
      const err = new Error(`Gmail ${path.split("/")[1]} failed (${res.status}): ${body?.error?.message ?? reason}`) as Error & { status?: number }
      err.status = res.status
      throw err
    }
  }

  const thread = (id: string) => get(`/threads/${encodeURIComponent(id)}`, {
    format: "metadata",
    metadataHeaders: HEADERS,
    fields: "id,messages(id,internalDate,labelIds,payload/headers)",
  })

  return { get, thread }
}

// ── Headers and addresses ─────────────────────────────────────
type Addr = { email: string; name: string }

// "=?UTF-8?B?...?=" and "=?UTF-8?Q?...?=" encoded words, when Gmail
// passes them through undecoded.
function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, enc, text) => {
    try {
      const bytes = enc.toUpperCase() === "B"
        ? Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
        : Uint8Array.from(
            text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16))),
            (c: string) => c.charCodeAt(0),
          )
      return new TextDecoder(charset).decode(bytes)
    } catch {
      return whole
    }
  }).replace(/\?=\s+=\?/g, "?==?")
}

const EMAIL_SHAPE = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/

export function parseAddressList(value: string | undefined): Addr[] {
  if (!value) return []
  const parts: string[] = []
  let cur = "", inQuote = false, inAngle = false
  for (const ch of value) {
    if (ch === '"') inQuote = !inQuote
    else if (ch === "<" && !inQuote) inAngle = true
    else if (ch === ">" && !inQuote) inAngle = false
    if ((ch === "," || ch === ";") && !inQuote && !inAngle) { parts.push(cur); cur = ""; continue }
    cur += ch
  }
  parts.push(cur)

  const out: Addr[] = []
  for (let part of parts) {
    part = part.trim()
    if (!part) continue
    // Group syntax ("Team: a@x.com, b@y.com;" or "undisclosed-recipients:;")
    const colon = part.indexOf(":")
    if (colon >= 0 && colon < part.indexOf("@") && !part.slice(0, colon).includes("<")) part = part.slice(colon + 1).trim()
    const angle = part.match(/<([^<>\s]+@[^<>\s]+)>/)
    const bare = angle ? null : part.match(/[^\s<>"]+@[^\s<>"]+/)
    const email = lower((angle?.[1] ?? bare?.[0] ?? "").replace(/^mailto:/i, "").replace(/[.,;]+$/, ""))
    if (!EMAIL_SHAPE.test(email)) continue
    const name = angle ? decodeWords(part.slice(0, angle.index).trim()).replace(/^"+|"+$/g, "").replace(/\\"/g, '"').trim() : ""
    out.push({ email, name: name.includes("@") ? "" : name })
  }
  return out
}

const MACHINE_LOCAL = /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|notify)([._+-]|$)/i
export const isMachineAddress = (email: string) => MACHINE_LOCAL.test(email.split("@")[0] ?? "")

export function isAutomated(h: Map<string, string>): boolean {
  if (h.has("list-id") || h.has("list-unsubscribe")) return true
  if (["bulk", "list", "junk"].includes(lower(h.get("precedence")))) return true
  const auto = lower(h.get("auto-submitted"))
  return !!auto && auto !== "no"
}

// "marcus.hill@x.com" -> "Marcus Hill", a starting name the review sheet
// lets you change. Same rule as the app's Calendar.
function nameFromEmail(email: string): string {
  return (email.split("@")[0] || "").split(/[._-]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

// ── Thread summary ────────────────────────────────────────────
export type ThreadSummary = {
  id: string
  subject: string
  participants: string[]
  messageCount: number
  firstAt: number
  lastAt: number
  lastDirection: "in" | "out"
  lastInboundAt: number | null
  lastOutboundAt: number | null
  touches: Map<string, number>              // address -> newest direct contact
  newPeople: Map<string, { name: string; at: number }>
}

export function summarizeThread(thread: any, self: Set<string>): ThreadSummary | null {
  const messages = [...(thread?.messages ?? [])]
    .filter((m) => !(m.labelIds ?? []).some((l: string) => SKIP_LABELS.has(l)))
    .sort((a, b) => Number(a.internalDate) - Number(b.internalDate))

  const s: ThreadSummary = {
    id: String(thread?.id ?? ""), subject: "", participants: [], messageCount: 0,
    firstAt: 0, lastAt: 0, lastDirection: "in", lastInboundAt: null, lastOutboundAt: null,
    touches: new Map(), newPeople: new Map(),
  }
  const participants = new Set<string>()
  const touch = (email: string, at: number) => {
    if ((s.touches.get(email) ?? 0) < at) s.touches.set(email, at)
  }

  for (const m of messages) {
    const at = Number(m.internalDate) || 0
    const h = new Map<string, string>()
    for (const { name, value } of m.payload?.headers ?? []) {
      const k = lower(name)
      if (!h.has(k)) h.set(k, String(value ?? ""))
    }
    if (isAutomated(h)) continue

    const from = parseAddressList(h.get("from"))[0]
    const to = parseAddressList(h.get("to"))
    const cc = parseAddressList(h.get("cc"))
    const outbound = (m.labelIds ?? []).includes("SENT") || (!!from && self.has(from.email))
    if (!outbound && (!from || isMachineAddress(from.email))) continue

    const others = (list: Addr[]) => list.filter((a) => !self.has(a.email) && !isMachineAddress(a.email))
    const toOthers = others(to)
    const ccOthers = others(cc)

    s.messageCount++
    if (!s.subject) s.subject = decodeWords(h.get("subject") ?? "").trim()
    if (!s.firstAt) s.firstAt = at
    if (at >= s.lastAt) { s.lastAt = at; s.lastDirection = outbound ? "out" : "in" }

    if (outbound) {
      s.lastOutboundAt = Math.max(s.lastOutboundAt ?? 0, at)
      for (const a of [...toOthers, ...ccOthers]) { participants.add(a.email); touch(a.email, at) }
      // A message to a crowd is an announcement, not a relationship.
      if (toOthers.length <= MAX_NEW_PER_MESSAGE) {
        for (const a of toOthers) {
          const prev = s.newPeople.get(a.email)
          if (!prev || prev.at < at) s.newPeople.set(a.email, { name: a.name || prev?.name || "", at })
        }
      }
    } else {
      s.lastInboundAt = Math.max(s.lastInboundAt ?? 0, at)
      participants.add(from!.email)
      touch(from!.email, at)
      for (const a of [...toOthers, ...ccOthers]) participants.add(a.email)
    }
  }

  if (s.messageCount === 0 || !s.id) return null
  s.participants = [...participants].sort()
  return s
}

// ── Database ──────────────────────────────────────────────────
type Connection = {
  user_id: string; google_email: string; refresh_token: string; scopes: string
  client_id: string | null; history_id: string | null; backfill_days: number
  sync_state: Record<string, any> | null; sync_started_at: string | null
}
type Contact = { id: string; email: string | null; name: string | null; last_contact_date: string | null }

type BackfillState = {
  startHistoryId: string
  cutoffMs: number
  labels: Record<string, { pageToken: string | null; done: boolean }>
}

type Run = {
  sb: any
  conn: Connection
  gmail: ReturnType<typeof makeGmail>
  self: Set<string>
  ignore: Set<string>
  contactsByEmail: Map<string, Contact>
  touchDates: Map<string, number>          // contact id -> newest contact
  seenThreads: Set<string>
  counts: { threads: number; needsReview: number; contactsUpdated: number; messagesChecked: number }
  deadline: number
}

// Takes the lock. Returns null when another run holds it.
//
// The update asks for a row count, not the updated row: PostgREST re-applies
// an or= filter to the rows it returns, and after this update the row no
// longer matches its own filter, so asking for the row would come back
// empty (or fail, when the filter column is not selected).
async function claim(sb: any, userId: string): Promise<Connection | null> {
  const stale = new Date(Date.now() - STALE_LOCK_MS).toISOString()
  const { count, error } = await sb.from("google_connections")
    .update({ sync_started_at: nowIso() }, { count: "exact" })
    .eq("user_id", userId)
    .or(`sync_started_at.is.null,sync_started_at.lt.${stale}`)
  if (error) throw new Error(`lock failed: ${error.message}`)
  if (count !== 1) return null
  const { data, error: readErr } = await sb.from("google_connections").select("*").eq("user_id", userId).single()
  if (readErr) throw new Error(`connection read failed: ${readErr.message}`)
  return data as Connection
}

async function finish(sb: any, userId: string, fields: Record<string, unknown>) {
  const { error } = await sb.from("google_connections")
    .update({ ...fields, sync_started_at: null, last_sync_at: nowIso(), updated_at: nowIso() })
    .eq("user_id", userId)
  if (error) console.error(`release failed for ${userId}: ${error.message}`)
}

async function saveState(run: Run, fields: Record<string, unknown>) {
  const { error } = await run.sb.from("google_connections")
    .update({ ...fields, updated_at: nowIso() })
    .eq("user_id", run.conn.user_id)
  if (error) throw new Error(`progress save failed: ${error.message}`)
}

// One contact per email: look first, insert if missing, and when the app or
// the Circleback processor created the same address in between, the unique
// index refuses the insert and the existing row is used.
async function findOrCreateContact(run: Run, email: string, name: string, threadId: string, at: number): Promise<Contact> {
  const { sb, conn } = run
  const lookup = async () => {
    const escaped = email.replace(/[\\%_]/g, (ch) => `\\${ch}`)
    const { data, error } = await sb.from("contacts").select("id, email, name, last_contact_date")
      .eq("user_id", conn.user_id).ilike("email", escaped)
    if (error) throw new Error(`contact lookup failed: ${error.message}`)
    return ((data ?? []) as Contact[]).find((c) => lower(c.email) === email) ?? null
  }
  const found = await lookup()
  if (found) return found

  const row = {
    id: crypto.randomUUID(), user_id: conn.user_id,
    name: name || nameFromEmail(email), email,
    stage: "needs_review", source: "gmail", source_ref: `gmail:${threadId}`,
    last_contact_date: localDate(at),
    created_at: nowIso(), updated_at: nowIso(),
  }
  const { error } = await sb.from("contacts").insert(row)
  if (!error) { run.counts.needsReview++; return row }
  if (error.code !== "23505") throw new Error(`contact insert failed: ${error.message}`)
  const raced = await lookup()
  if (!raced) throw new Error(`contact insert conflicted but no contact has ${email}`)
  return raced
}

// Saves one thread if anyone on it is a contact. New people only come from
// messages you sent on or after `newPeopleSince`.
async function applyThread(run: Run, s: ThreadSummary, newPeopleSince: number) {
  for (const [email, p] of s.newPeople) {
    if (p.at < newPeopleSince || run.contactsByEmail.has(email) || run.ignore.has(email)) continue
    const c = await findOrCreateContact(run, email, p.name, s.id, p.at)
    run.contactsByEmail.set(email, c)
  }

  const contactIds: string[] = []
  for (const email of s.participants) {
    const c = run.contactsByEmail.get(email)
    if (!c || contactIds.includes(c.id)) continue
    contactIds.push(c.id)
    const at = s.touches.get(email)
    if (at && (run.touchDates.get(c.id) ?? 0) < at) run.touchDates.set(c.id, at)
  }
  if (contactIds.length === 0) return

  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null)
  const { error } = await run.sb.from("email_threads").upsert({
    id: s.id, user_id: run.conn.user_id,
    subject: s.subject.slice(0, 500),
    participants: s.participants,
    contact_ids: contactIds,
    message_count: s.messageCount,
    first_message_at: iso(s.firstAt),
    last_message_at: iso(s.lastAt),
    last_direction: s.lastDirection,
    last_inbound_at: iso(s.lastInboundAt),
    last_outbound_at: iso(s.lastOutboundAt),
    updated_at: nowIso(),
  }, { onConflict: "user_id,id" })
  if (error) throw new Error(`email_threads write failed: ${error.message}`)
  run.counts.threads++
}

// Reads a batch of threads in parallel, then applies them one at a time so
// a new person shared by two threads is created once. Returns how many
// threads were read and the newest message among them, automated or not,
// which is what backfill paging needs.
async function processThreads(run: Run, ids: string[], newPeopleSince: number): Promise<{ read: number; newest: number }> {
  const fresh = ids.filter((id) => !run.seenThreads.has(id))
  fresh.forEach((id) => run.seenThreads.add(id))
  const results = await Promise.all(fresh.map(async (id) => {
    try {
      return await run.gmail.thread(id)
    } catch (err) {
      // A thread deleted between listing and reading is not an error.
      if ((err as any)?.status === 404) return null
      throw err
    }
  }))
  let read = 0, newest = 0
  for (const t of results) {
    if (!t) continue
    read++
    for (const m of t.messages ?? []) {
      if (!(m.labelIds ?? []).some((l: string) => SKIP_LABELS.has(l))) newest = Math.max(newest, Number(m.internalDate) || 0)
    }
    run.counts.messagesChecked += t.messages?.length ?? 0
    const s = summarizeThread(t, run.self)
    if (s) await applyThread(run, s, newPeopleSince)
  }
  return { read, newest }
}

// Backfill: threads you sent in, then threads in the Primary category,
// newest first, until a whole page is older than the cutoff. The page
// cursor is saved after every page.
async function backfill(run: Run, state: BackfillState): Promise<"done" | "partial"> {
  for (const label of BACKFILL_LABELS) {
    const lab = state.labels[label] ?? (state.labels[label] = { pageToken: null, done: false })
    while (!lab.done) {
      if (Date.now() > run.deadline) return "partial"
      let page: any
      try {
        page = await run.gmail.get("/threads", {
          labelIds: label, maxResults: "100", pageToken: lab.pageToken ?? "",
          fields: "threads(id),nextPageToken",
        })
      } catch (err) {
        // An account without inbox categories has no CATEGORY_PERSONAL.
        if ((err as any)?.status === 400 || (err as any)?.status === 404) { lab.done = true; break }
        throw err
      }
      const ids = (page.threads ?? []).map((t: any) => String(t.id))
      const { read, newest } = await processThreads(run, ids, state.cutoffMs)
      // Threads come newest first. Every thread on this page ending before
      // the cutoff means the rest are older too.
      const allOld = ids.length === 0 || (read > 0 && newest < state.cutoffMs)
      lab.pageToken = page.nextPageToken ?? null
      if (!lab.pageToken || allOld) lab.done = true
      await saveState(run, { sync_state: { ...(run.conn.sync_state ?? {}), backfill: state } })
    }
  }
  return "done"
}

// Incremental: every thread that gained a message since history_id.
// Threads left over when time runs out are kept in sync_state.pending with
// the history id to resume from once they are done.
async function incremental(run: Run): Promise<"done" | "partial"> {
  const state = run.conn.sync_state ?? {}
  let pending: { threadIds: string[]; historyId: string } | null = state.pending ?? null

  if (!pending) {
    const threadIds = new Set<string>()
    let pageToken = ""
    let newHistoryId = run.conn.history_id!
    do {
      const page = await run.gmail.get("/history", {
        startHistoryId: run.conn.history_id!, historyTypes: "messageAdded", maxResults: "500", pageToken,
        fields: "history(messagesAdded(message(id,threadId,labelIds))),historyId,nextPageToken",
      })
      for (const h of page.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          const m = added.message ?? {}
          if ((m.labelIds ?? []).some((l: string) => SKIP_LABELS.has(l))) continue
          if (m.threadId) threadIds.add(String(m.threadId))
        }
      }
      if (page.historyId) newHistoryId = String(page.historyId)
      pageToken = page.nextPageToken ?? ""
    } while (pageToken)
    pending = { threadIds: [...threadIds], historyId: newHistoryId }
  }

  const since = Date.now() - 30 * 86_400_000
  while (pending.threadIds.length > 0) {
    if (Date.now() > run.deadline) {
      await saveState(run, { sync_state: { ...state, pending } })
      return "partial"
    }
    const batch = pending.threadIds.splice(0, 25)
    await processThreads(run, batch, since)
  }
  const { pending: _done, ...rest } = state
  run.conn.sync_state = rest
  await saveState(run, { history_id: pending.historyId, sync_state: rest })
  run.conn.history_id = pending.historyId
  return "done"
}

async function startBackfill(run: Run, days: number): Promise<BackfillState> {
  const profile = await run.gmail.get("/profile")
  const state: BackfillState = {
    startHistoryId: String(profile.historyId),
    cutoffMs: Date.now() - days * 86_400_000,
    labels: Object.fromEntries(BACKFILL_LABELS.map((l) => [l, { pageToken: null, done: false }])),
  }
  run.conn.sync_state = { backfill: state }
  await saveState(run, { history_id: null, sync_state: run.conn.sync_state })
  return state
}

// Moves last_contact_date forward, never back.
async function writeContactDates(run: Run) {
  const byId = new Map<string, Contact>()
  run.contactsByEmail.forEach((c) => byId.set(c.id, c))
  for (const [id, at] of run.touchDates) {
    const date = localDate(at)
    const current = byId.get(id)?.last_contact_date ?? null
    if (current && current >= date) continue
    // A count, not the row: see claim() for why.
    const { count, error } = await run.sb.from("contacts")
      .update({ last_contact_date: date, updated_at: nowIso() }, { count: "exact" })
      .eq("user_id", run.conn.user_id).eq("id", id)
      .or(`last_contact_date.is.null,last_contact_date.lt.${date}`)
    if (error) throw new Error(`last contact update failed: ${error.message}`)
    run.counts.contactsUpdated += count ?? 0
  }
}

async function syncOne(sb: any, userId: string, deadline: number) {
  const conn = await claim(sb, userId)
  if (!conn) return { userId, status: "busy" }

  const counts = { threads: 0, needsReview: 0, contactsUpdated: 0, messagesChecked: 0 }
  let mode = conn.history_id ? "incremental" : "backfill"
  try {
    const accessToken = await accessTokenFor(conn)
    const [contactsRes, settingsRes] = await Promise.all([
      sb.from("contacts").select("id, email, name, last_contact_date").eq("user_id", userId),
      sb.from("app_state").select("value").eq("user_id", userId).eq("key", "settings").maybeSingle(),
    ])
    if (contactsRes.error) throw new Error(`contacts read failed: ${contactsRes.error.message}`)
    const contactsByEmail = new Map<string, Contact>()
    for (const c of (contactsRes.data ?? []) as Contact[]) {
      const e = lower(c.email)
      if (e && !contactsByEmail.has(e)) contactsByEmail.set(e, c)
    }
    const ignoreList = settingsRes.data?.value?.contactIgnore
    const run: Run = {
      sb, conn, gmail: makeGmail(accessToken),
      self: new Set([lower(conn.google_email), ...EXTRA_SELF]),
      ignore: new Set((Array.isArray(ignoreList) ? ignoreList : []).map(lower).filter(Boolean)),
      contactsByEmail, touchDates: new Map(), seenThreads: new Set(), counts, deadline,
    }

    let result: "done" | "partial"
    if (!conn.history_id) {
      const state: BackfillState = conn.sync_state?.backfill ?? await startBackfill(run, conn.backfill_days || 90)
      result = await backfill(run, state)
      if (result === "done") {
        // Everything since the backfill started comes from history.
        run.conn.sync_state = {}
        run.conn.history_id = state.startHistoryId
        await saveState(run, { history_id: state.startHistoryId, sync_state: {} })
        mode = "backfill+incremental"
        result = await incremental(run)
      }
    } else {
      try {
        result = await incremental(run)
      } catch (err) {
        if (!(err instanceof HistoryGone)) throw err
        // Gmail keeps about a week of history. After a longer pause, read
        // the recent past again instead.
        mode = "recovery"
        const state = await startBackfill(run, RECOVERY_DAYS)
        result = await backfill(run, state)
        if (result === "done") {
          await saveState(run, { history_id: state.startHistoryId, sync_state: {} })
        }
      }
    }
    await writeContactDates(run)

    const summary = { mode, partial: result === "partial", ...counts }
    await finish(sb, userId, { last_sync_status: "ok", last_sync_error: null, last_sync_counts: summary })
    return { userId, status: "ok", ...summary }
  } catch (err) {
    const reauth = err instanceof ReauthError
    const message = (err as Error)?.message ?? String(err)
    if (!reauth) console.error(`gmail-sync ${userId}:`, err)
    await finish(sb, userId, {
      last_sync_status: reauth ? "reauth_needed" : "error",
      last_sync_error: message.slice(0, 500),
      last_sync_counts: { mode, partial: true, ...counts },
    })
    return { userId, status: reauth ? "reauth_needed" : "error", error: message }
  }
}

async function syncAll(sb: any, deadline: number) {
  const { data, error } = await sb.from("google_connections").select("user_id").order("last_sync_at", { ascending: true, nullsFirst: true })
  if (error) throw new Error(`connections read failed: ${error.message}`)
  const results = []
  for (const { user_id } of data ?? []) {
    if (Date.now() > deadline) break
    results.push(await syncOne(sb, user_id, deadline))
  }
  return results
}

// ── Entry ─────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const started = Date.now()
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ ok: false, code: "method", error: "POST only" }, 405)

  try {
    if (!CLIENT_SECRET) throw new HttpError(503, "not_configured", "GOOGLE_CLIENT_SECRET is not set on this function yet.")
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } })
    const deadline = started + RUN_BUDGET_MS

    // The schedule: every connection, in the background.
    const secret = req.headers.get("x-sync-secret") ?? ""
    if (secret) {
      if (!sameSecret(secret, SYNC_SECRET)) throw new HttpError(401, "unauthorized", "Wrong sync secret.")
      const work = syncAll(sb, deadline).catch((err) => console.error("gmail-sync run failed:", err))
      const runtime = (globalThis as any).EdgeRuntime
      if (runtime?.waitUntil) {
        runtime.waitUntil(work)
        return json({ ok: true, started: true }, 202)
      }
      return json({ ok: true, results: await work })
    }

    // The app: the signed-in user, and wait for the result.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    if (!jwt) throw new HttpError(401, "unauthorized", "Sign in to SprintHQ first.")
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt)
    if (userErr || !userData?.user) throw new HttpError(401, "unauthorized", "Your SprintHQ session has expired. Sign in again.")

    const { data: conn, error } = await sb.from("google_connections").select("user_id").eq("user_id", userData.user.id).maybeSingle()
    if (error) throw new Error(`connection read failed: ${error.message}`)
    if (!conn) throw new HttpError(404, "not_connected", "Connect Google in Settings first.")

    const result = await syncOne(sb, userData.user.id, deadline)
    return json({ ok: result.status === "ok" || result.status === "busy", ...result })
  } catch (err) {
    if (err instanceof HttpError) return json({ ok: false, code: err.code, error: err.message }, err.status)
    console.error(err)
    return json({ ok: false, code: "error", error: String((err as Error)?.message ?? err) }, 500)
  }
})

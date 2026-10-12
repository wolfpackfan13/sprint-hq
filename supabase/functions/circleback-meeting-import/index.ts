// Circleback -> Sprint HQ: read one meeting on demand.
//
// The Relationships page calls this when you paste a Circleback meeting
// link. It reads the meeting through Circleback's API with a key kept here
// as a secret, so the key never reaches the browser, and returns only what
// the CRM needs: title, start time, notes, attendees and action items.
//
// Nothing is written to the database here. The app shows a preview, you
// pick who it belongs to, and the meeting saves through the normal sync.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   CIRCLEBACK_API_KEY  read-only key from Circleback → Settings → API keys
//   SAM_USER_ID         already set for circleback-meeting-processor
// Optional:
//   ALLOWED_ORIGINS     extra comma-separated origins, e.g. a custom domain
//
// Deploy with "Verify JWT" on. The function also checks the caller itself,
// because the Circleback key reads every meeting in Sam's account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SRK       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const SAM_USER_ID        = Deno.env.get("SAM_USER_ID") ?? ""
const CIRCLEBACK_API_KEY = Deno.env.get("CIRCLEBACK_API_KEY") ?? ""

const CIRCLEBACK_MCP_URL = "https://circleback.ai/api/mcp"
const CIRCLEBACK_TIMEOUT_MS = 20_000
const MEETING_ID = /^[A-Za-z0-9_-]{6,64}$/

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

// Accepts a full link (circleback.ai/meetings/<id>, app.circleback.ai/…,
// with or without query string) or a bare meeting id.
function meetingIdFrom(input: unknown): string | null {
  const text = String(input ?? "").trim()
  if (!text) return null
  const fromPath = text.match(/\/meetings\/([A-Za-z0-9_-]{6,64})/)
  if (fromPath) return fromPath[1]
  return MEETING_ID.test(text) ? text : null
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

// Circleback's API speaks JSON-RPC (the same endpoint its CLI uses). The
// reply is either plain JSON or a short event stream; both carry the tool's
// result as a JSON string in content[0].text.
async function readMeeting(meetingId: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CIRCLEBACK_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(CIRCLEBACK_MCP_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${CIRCLEBACK_API_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "ReadMeetings",
          arguments: { intent: "Load meeting notes into Sprint HQ's CRM", meetingIds: [meetingId] },
        },
      }),
    })
  } catch (err) {
    throw new HttpError(504, "circleback_unreachable", `Could not reach Circleback: ${String(err)}`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) throw new HttpError(502, "bad_key", "Circleback rejected the API key. Create a new one and update CIRCLEBACK_API_KEY.")
  if (res.status === 403) throw new HttpError(502, "bad_key", "This Circleback API key cannot read meetings.")
  if (res.status === 429) throw new HttpError(429, "rate_limited", "Circleback is rate limiting requests. Try again in a minute.")
  if (!res.ok) throw new HttpError(502, "circleback_error", `Circleback returned ${res.status}.`)

  const contentType = res.headers.get("content-type") ?? ""
  const raw = await res.text()
  const messages = contentType.includes("text/event-stream")
    ? raw.split("\n").filter((l) => l.startsWith("data: ")).map((l) => { try { return JSON.parse(l.slice(6)) } catch { return null } }).filter(Boolean)
    : [JSON.parse(raw)]

  let text = ""
  for (const msg of messages) {
    if (msg.error) throw new HttpError(502, "circleback_error", msg.error.message ?? "Circleback returned an error.")
    const result = msg.result
    if (!result) continue
    const part = (result.content ?? []).find((c: any) => c.type === "text")?.text ?? ""
    if (result.isError) {
      if (/not found|no meeting|access/i.test(part)) throw new HttpError(404, "not_found", "No meeting with that link in your Circleback account.")
      throw new HttpError(502, "circleback_error", part || "Circleback returned an error.")
    }
    text += part
  }

  let meetings: any[]
  try {
    const parsed = JSON.parse(text)
    meetings = Array.isArray(parsed) ? parsed : (parsed?.meetings ?? [parsed])
  } catch {
    throw new HttpError(502, "circleback_error", "Circleback's reply could not be read.")
  }
  const m = meetings.find((x) => x?.id === meetingId) ?? meetings[0]
  if (!m || !m.id) throw new HttpError(404, "not_found", "No meeting with that link in your Circleback account.")
  return m
}

// Only what the CRM uses. The recording URL Circleback returns is signed and
// expires within a day, so the app links to the meeting page instead.
function normalize(m: any) {
  return {
    id: m.id,
    title: m.name ?? "",
    startedAt: m.createdAt ?? null,
    durationSeconds: typeof m.duration === "number" ? Math.round(m.duration) : null,
    notes: m.notes ?? "",
    attendees: (m.attendees ?? []).map((a: any) => ({ name: a?.name ?? null, email: a?.email ?? null })),
    actionItems: (m.actionItems ?? []).map((ai: any) => ({
      title: ai?.title ?? "",
      description: ai?.description ?? "",
      assignee: ai?.assignee ? { name: ai.assignee.name ?? null, email: ai.assignee.email ?? null } : null,
      done: String(ai?.status ?? "").toUpperCase() === "DONE",
    })).filter((ai: any) => ai.title),
    tags: m.tags ?? [],
    url: `https://circleback.ai/meetings/${m.id}`,
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ ok: false, code: "method", error: "POST only" }, 405)

  try {
    if (!CIRCLEBACK_API_KEY) throw new HttpError(503, "not_configured", "CIRCLEBACK_API_KEY is not set on this function yet.")
    if (!SAM_USER_ID) throw new HttpError(503, "not_configured", "SAM_USER_ID is not set on this function.")

    // Who is asking. The key reads every meeting in Sam's Circleback account,
    // so only Sam's signed-in session may use it.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    if (!token) throw new HttpError(401, "unauthorized", "Sign in to SprintHQ first.")
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await sb.auth.getUser(token)
    if (userErr || !userData?.user) throw new HttpError(401, "unauthorized", "Your SprintHQ session has expired. Sign in again.")
    if (userData.user.id !== SAM_USER_ID) throw new HttpError(403, "forbidden", "This account cannot read Circleback meetings.")

    const body = await req.json().catch(() => ({}))
    const meetingId = meetingIdFrom(body.meetingId ?? body.link)
    if (!meetingId) throw new HttpError(400, "bad_link", "That doesn't look like a Circleback meeting link.")

    const meeting = normalize(await readMeeting(meetingId))
    return json({ ok: true, meeting })
  } catch (err) {
    if (err instanceof HttpError) return json({ ok: false, code: err.code, error: err.message }, err.status)
    return json({ ok: false, code: "error", error: String(err) }, 500)
  }
})

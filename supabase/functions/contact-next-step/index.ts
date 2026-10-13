// AI next step for one person on the Relationships page, for SprintHQ.
//
// The app sends a short brief it builds from what it already has on the
// device (stage, recent meetings and emails, open tasks, what's booked,
// referrals) and gets back a two-sentence summary and up to three next
// steps. The Anthropic key stays here as a function secret.
//
// POST { brief } -> { ok: true, summary, steps: [{ kind, title, why, ... }] }
//   kind  schedule  eventTitle, minutes (15|30|45|60), day (YYYY-MM-DD, optional)
//         email     threadId (one of the brief's email ids, optional)
//         task      dueInDays (0 to 30, optional)
//         invite    ask them to become a referral partner
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  already set for circleback-meeting-processor
//   SAM_USER_ID        already set for circleback-meeting-processor. Only
//                      this SprintHQ user can spend the Anthropic key here.
// Optional:
//   ALLOWED_ORIGINS    extra comma-separated origins, e.g. a custom domain
//
// Deploy as exactly contact-next-step (function names are case-sensitive),
// with "Verify JWT" on.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SRK      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
const SAM_USER_ID       = Deno.env.get("SAM_USER_ID") ?? ""
const MODEL             = "claude-sonnet-4-6"
const MAX_BRIEF_BYTES   = 40_000
const TIMEOUT_MS        = 30_000

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

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

// ── The ask ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You help Sam, a consultant who works with small business owners, decide the single most useful next step with one person in his relationships list.

Each person has two tracks. The business stage is where they are as a buyer: Nurturing, In conversation, Proposal out, Client, Past client, or Network (not buying). The referral track is separate: None, Invited (asked to become a referral partner), or Referral partner (has an agreement and a reward for clients they send). Asking someone for an intro is an action, not a stage. A referral partner is someone with an incentive to send clients; treat that relationship as a partnership, not a sales lead.

You get a brief in JSON. Use only what is in it. Never invent facts, names, dates, commitments, or numbers. If the history is thin, say so plainly and suggest a light first step.

Write the summary in two sentences at most: where things stand and what matters next. Then give one to three next steps, best first.

Rules for steps:
- If something is already booked with them, do not suggest scheduling. Suggest how to prepare for it, or an email or task that makes the meeting more useful.
- If they wrote last and have not had a reply, the first step is usually replying (kind "email", with that thread's id).
- Open action items and overdue tasks from past meetings come before new ideas.
- Suggest "invite" only for someone with no referral stage who has worked with Sam or knows his work well (a client, past client, or a warm network contact), and only when nothing more pressing is open.
- For a referral partner, think about keeping them close and making it easy to send people: a check-in, a thank-you after a referral, or settling a reward.
- Never repeat a step listed in "dismissed".
- Titles are short commands, under 60 characters, that name the person ("Reply to Dana about the pricing question").
- "why" is one short sentence that points to something in the brief.
- For "schedule", give a calendar eventTitle Sam would put on his calendar, a length in minutes (15, 30, 45 or 60), and a day only when the history points to one.
- For "task", give dueInDays when timing matters.

Voice: direct and warm, plain words, varied sentence length. No em dashes. No hype. Do not use these words: delve, tapestry, intricate, pivotal, crucial, vital, testament, landscape, foster, underscore, leverage, robust, seamless, transformative, groundbreaking, game-changer, unlock. Do not write "it's not X, it's Y" or "not just X but Y".

Answer by calling the next_step tool.`

const TOOL = {
  name: "next_step",
  description: "Return the summary and the next steps for this person.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Two sentences at most." },
      steps: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["schedule", "email", "task", "invite"] },
            title: { type: "string" },
            why: { type: "string" },
            eventTitle: { type: "string" },
            minutes: { type: "integer", enum: [15, 30, 45, 60] },
            day: { type: "string", description: "YYYY-MM-DD, after today" },
            threadId: { type: "string" },
            dueInDays: { type: "integer", minimum: 0, maximum: 30 },
          },
          required: ["kind", "title", "why"],
        },
      },
    },
    required: ["summary", "steps"],
  },
}

// ── Cleaning the answer ───────────────────────────────────────
const noDashes = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",")
const clean = (v: unknown, max: number) => {
  const s = noDashes(String(v ?? "").replace(/\s+/g, " ").trim())
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// deno-lint-ignore no-explicit-any
function tidy(raw: any, brief: any) {
  const today = isDate(brief?.today) ? brief.today : new Date().toISOString().slice(0, 10)
  const threadIds = new Set((brief?.emails ?? []).map((e: { id?: string }) => e?.id).filter(Boolean))
  const dismissed = new Set((brief?.dismissed ?? []).map((t: string) => String(t).trim().toLowerCase()))
  const booked = !!brief?.booked
  const seen = new Set<string>()
  // deno-lint-ignore no-explicit-any
  const steps = (Array.isArray(raw?.steps) ? raw.steps : []).map((s: any) => {
    const kind = ["schedule", "email", "task", "invite"].includes(s?.kind) ? s.kind : null
    const title = clean(s?.title, 80)
    if (!kind || !title) return null
    const key = title.toLowerCase()
    if (dismissed.has(key) || seen.has(key)) return null
    if (kind === "schedule" && booked) return null
    seen.add(key)
    // deno-lint-ignore no-explicit-any
    const step: Record<string, any> = { kind, title, why: clean(s?.why, 180) }
    if (kind === "schedule") {
      step.eventTitle = clean(s?.eventTitle, 80) || title
      step.minutes = [15, 30, 45, 60].includes(s?.minutes) ? s.minutes : 30
      if (isDate(s?.day) && s.day > today && s.day <= addDays(today, 60)) step.day = s.day
    }
    if (kind === "email" && threadIds.has(s?.threadId)) step.threadId = s.threadId
    if (kind === "task" && Number.isInteger(s?.dueInDays) && s.dueInDays >= 0 && s.dueInDays <= 30) step.dueInDays = s.dueInDays
    return step
  }).filter(Boolean).slice(0, 3)
  return { summary: clean(raw?.summary, 400), steps }
}

// deno-lint-ignore no-explicit-any
async function ask(brief: any) {
  if (!ANTHROPIC_API_KEY) throw new HttpError(500, "no_key", "The AI next step needs ANTHROPIC_API_KEY set in Supabase function secrets.")
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "next_step" },
        messages: [{ role: "user", content: `Today is ${brief.today}. Here is the brief:\n\n${JSON.stringify(brief, null, 1)}` }],
      }),
    })
  } catch {
    throw new HttpError(504, "ai_timeout", "The AI took too long. Try again in a minute.")
  } finally {
    clearTimeout(timer)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("Anthropic error", res.status, JSON.stringify(body).slice(0, 500))
    throw new HttpError(502, res.status === 429 ? "ai_busy" : "ai_error", res.status === 429 ? "The AI is busy. Try again in a minute." : "The AI didn't answer. Try again in a minute.")
  }
  // deno-lint-ignore no-explicit-any
  const use = (body?.content ?? []).find((c: any) => c?.type === "tool_use" && c?.name === "next_step")
  if (!use) throw new HttpError(502, "ai_error", "The AI didn't return a suggestion.")
  const out = tidy(use.input, brief)
  if (!out.steps.length) throw new HttpError(502, "ai_empty", "No new suggestion this time.")
  return out
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ ok: false, code: "method", error: "POST only" }, 405)

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    if (!jwt) throw new HttpError(401, "unauthorized", "Sign in to SprintHQ first.")
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt)
    if (userErr || !userData?.user) throw new HttpError(401, "unauthorized", "Your SprintHQ session has expired. Sign in again.")
    // The app is public, so any account could call this; only Sam's may.
    if (!SAM_USER_ID) throw new HttpError(500, "no_owner", "Set SAM_USER_ID in Supabase function secrets.")
    if (userData.user.id !== SAM_USER_ID) throw new HttpError(403, "forbidden", "The AI next step is only on for the owner of this SprintHQ.")

    const text = await req.text()
    if (text.length > MAX_BRIEF_BYTES) throw new HttpError(413, "too_big", "That brief is too long.")
    let body: { brief?: unknown } = {}
    try { body = JSON.parse(text) } catch { throw new HttpError(400, "bad_json", "Send JSON.") }
    // deno-lint-ignore no-explicit-any
    const brief = body?.brief as any
    if (!brief || typeof brief !== "object" || !brief.person) throw new HttpError(400, "bad_brief", "Missing the brief.")

    return json({ ok: true, ...(await ask(brief)) })
  } catch (err) {
    if (err instanceof HttpError) return json({ ok: false, code: err.code, error: err.message }, err.status)
    console.error(err)
    return json({ ok: false, code: "error", error: "Something went wrong on the server. The details are in the contact-next-step function logs in Supabase." }, 500)
  }
})

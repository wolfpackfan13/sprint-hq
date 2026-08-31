// Circleback -> Sprint HQ meeting processor.
//
// Deployed as edge function `circleback-meeting-processor`, called by the
// Circleback webhook.
//
// Idempotency lives in the circleback_processed ledger, not in the caller.
// The meeting is CLAIMED before any work happens, so a retry that arrives
// while the first invocation is still talking to Claude is turned away
// instead of inserting a second batch. Requires migrations/002 and 003.
//
// Every "already handled" path returns 200. A webhook that gets a non-2xx
// retries, and a retry is exactly what we are trying to stop.
//
// This function cannot create the follow-up Gmail draft: it has no Gmail
// credentials. It parks the email on the ledger and exposes two admin
// actions so a separate pass (the circleback-post-call-followup scheduled
// task, which does have Gmail) can pick it up and mark it done.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SRK      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SAM_USER_ID       = Deno.env.get("SAM_USER_ID")!

// Gates the admin actions below. Unset = actions disabled (fail closed).
// They return meeting email bodies, and the anon key is public.
const ADMIN_SECRET = Deno.env.get("CIRCLEBACK_ADMIN_SECRET") ?? ""

// A claim older than this is assumed dead (function timed out, cold start
// killed it) and may be taken over by a later delivery.
const STALE_CLAIM_MS = 10 * 60 * 1000

// Sam's own addresses — never the recipient of his own follow-up.
const SELF_ADDRESSES = ["sam.blinson@gmail.com"]

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
// Offered to Claude when no address matches. Keep in sync with the above.
const COMPANY_CHOICES = [
  { id: "co_1782329982318_4ia", name: "Apex Property Media", hint: "photo editing, CTA site, credits, photographers, David Millary, Brian Evans, inuaai" },
  { id: "refuge-homes",  name: "Refuge Homes",    hint: "faith-based affordable housing fund, Dana, Blake, LPs, investors, DAFs" },
  { id: "flip-projects", name: "Flip Projects",   hint: "fix-and-flip, 210 East Crestview Smithfield, Alejandro, contractors" },
  { id: "content",       name: "Content & Brand", hint: "samblinson.com, coaching, personal brand" },
  { id: "mayfly",        name: "Mayfly Project",  hint: "Mayfly" },
  { id: "personal",      name: "Personal",        hint: "personal, family, non-business" },
  { id: "admin",         name: "Admin",           hint: "bookkeeping, taxes, insurance, internal admin" },
]

const SYSTEM_PROMPT = `
You are Sam Blinson's chief of staff. Sam just finished a call (captured by Circleback). Do FOUR jobs and return ONLY valid JSON — no markdown fences, no preamble.

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
Using the attendees and the PRIOR RELATIONSHIP CONTEXT provided, classify the relationship and therefore the right follow-up email type. Choose exactly one type: "warm_existing_client" | "new_prospect" | "peer_partner" | "vendor" | "internal_team". Give a one-line rationale.

JOB 3 — FOLLOW-UP EMAIL DRAFT:
Write the follow-up email in Sam's voice, matching the relationship type. For warm existing clients/partners: warm but professional, no stiff formality. Recap the key DECISIONS made on the call, confirm who owns what next, and close with one clear next step. 150–250 words, plain text, tight, no filler. Address the primary counterpart by first name. Sign as "Sam".

JOB 4 — COMPANY:
Pick the company this call belongs to from the COMPANY OPTIONS list in the payload. Return its exact id string. If the call does not clearly belong to any of them, return null. Do not guess from a single passing mention.

Return ONLY this JSON shape:
{
  "tasks": [ { "title": "", "notes": "", "priority": "high|medium|low", "due_date": "YYYY-MM-DD or null", "inferred": false } ],
  "relationship": { "type": "", "rationale": "" },
  "email": { "subject": "", "body": "" },
  "company_id": "<id or null>"
}`.trim()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

// ── Company resolution ────────────────────────────────────────
// Deterministic first: an attendee address is evidence, not inference.
function companyFromAttendees(attendees: any[]): string | null {
  for (const a of attendees) {
    const email = String(a?.email ?? "").trim().toLowerCase()
    if (!email || SELF_ADDRESSES.includes(email)) continue
    if (COMPANY_BY_EMAIL[email]) return COMPANY_BY_EMAIL[email]
    const domain = email.split("@")[1]
    if (domain && COMPANY_BY_DOMAIN[domain]) return COMPANY_BY_DOMAIN[domain]
  }
  return null
}

// Best guess at who the follow-up is addressed to: first external attendee.
function primaryCounterpart(attendees: any[]): string | null {
  for (const a of attendees) {
    const email = String(a?.email ?? "").trim().toLowerCase()
    if (email && !SELF_ADDRESSES.includes(email)) return email
  }
  return null
}

serve(async (req: Request) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SRK)
  let claimed: { userId: string; linkId: string } | null = null

  try {
    const payload = await req.json()

    // ── Admin actions for the draft pass ────────────────────────
    // Gated on a shared secret: these return email bodies, and the anon
    // key that reaches this function is public.
    if (payload.action === "pending_drafts" || payload.action === "mark_draft") {
      if (!ADMIN_SECRET) return json({ error: "admin actions disabled: CIRCLEBACK_ADMIN_SECRET not set" }, 503)
      if (payload.secret !== ADMIN_SECRET) return json({ error: "unauthorized" }, 401)
      const userId = payload.user_id ?? SAM_USER_ID

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

      const linkId = String(payload.link_id ?? "").trim()
      if (!linkId) return json({ error: "link_id required" }, 400)
      const { error } = await sb
        .from("circleback_processed")
        .update({ draft_id: payload.draft_id ?? null, draft_created_at: new Date().toISOString() })
        .eq("user_id", userId).eq("link_id", linkId)
      if (error) return json({ error: "update failed", detail: error }, 500)
      return json({ ok: true, link_id: linkId, marked: true })
    }

    // ── Normal webhook path ─────────────────────────────────────
    // The scheduled task posts { meeting: {...}, company_id, attendees, ... }.
    // The Circleback webhook posts its own shape. Accept either, rather than
    // silently reading undefined off payload.meeting and tagging every task
    // with an empty linkId.
    const m = payload.meeting ?? payload.data ?? payload ?? {}

    const linkId = String(m.linkId ?? m.link_id ?? m.id ?? m.meetingId ?? payload.id ?? "").trim()
    const userId = payload.user_id ?? SAM_USER_ID

    // Without a linkId there is no dedup key, and an untagged batch can never
    // be attributed to a meeting or cleaned up. Refuse rather than pollute.
    // 400 is deliberate: this is a payload-shape bug to fix, not a transient
    // failure worth retrying.
    if (!linkId) {
      return json({
        error: "missing linkId",
        hint: "no linkId/link_id/id found on payload.meeting, payload.data, or payload",
        received_keys: Object.keys(payload ?? {}),
        meeting_keys: Object.keys(m ?? {}),
      }, 400)
    }

    // ── Claim the meeting before doing any work ──────────────────
    const { error: claimErr } = await sb
      .from("circleback_processed")
      .insert({
        user_id: userId, link_id: linkId, status: "processing",
        meeting_title: m.title ?? null,
        raw_payload: payload,   // so the real webhook shape is finally visible
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
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .eq("user_id", userId).eq("link_id", linkId)
        .eq("processed_at", existing!.processed_at)
        .select("link_id")
      if (!taken || taken.length === 0) {
        return json({ ok: true, skipped: "in_flight", link_id: linkId, tasks_created: 0 })
      }
    }

    claimed = { userId, linkId }

    // ── Build the review input ───────────────────────────────────
    const title        = m.title ?? "Untitled Meeting"
    const date         = m.date ?? new Date().toISOString().split("T")[0]
    const recordingUrl = m.recording_url ?? m.recordingUrl ?? ""
    const notes        = m.notes ?? ""
    const transcript   = m.transcript ?? ""
    const actionItems  = (m.action_items ?? m.actionItems ?? []) as any[]
    const attendees    = (payload.attendees ?? m.attendees ?? []) as any[]
    const relationship = payload.relationship_context ?? "(none provided)"
    const today        = payload.today ?? new Date().toISOString().split("T")[0]
    const dryRun       = payload.dry_run === true

    // Explicit company on the payload wins, then an attendee address match,
    // then Claude's pick from the list (applied after the review).
    const explicitCompany = payload.company_id ?? null
    const matchedCompany  = explicitCompany ?? companyFromAttendees(attendees)

    const aiLines = actionItems.map((i: any) => `- [${i.assignee?.name ?? i.assignee ?? "unassigned"}] ${i.title ?? ""}${i.description ? ": " + i.description : ""}`)
    const attLines = attendees.map((a: any) => `- ${a.name ?? "?"} (${a.email ?? "no email"})`)

    const userMessage = [
      `TODAY: ${today}`,
      `Meeting: ${title}`,
      `Date: ${date}`,
      recordingUrl ? `Recording: ${recordingUrl}` : "",
      "",
      "--- COMPANY OPTIONS (for JOB 4) ---",
      matchedCompany
        ? `Already resolved from attendee addresses: ${matchedCompany}. Return this id.`
        : COMPANY_CHOICES.map((c) => `- id:"${c.id}" name:"${c.name}" — ${c.hint}`).join("\n"),
      "",
      "--- ATTENDEES ---",
      attLines.length ? attLines.join("\n") : "None listed",
      "",
      "--- PRIOR RELATIONSHIP CONTEXT (from email history) ---",
      relationship,
      "",
      "--- CIRCLEBACK NOTES ---",
      notes || "(none)",
      "",
      "--- CIRCLEBACK ACTION ITEMS (with assignees) ---",
      aiLines.length ? aiLines.join("\n") : "None",
      "",
      transcript ? `--- FULL TRANSCRIPT ---\n${transcript}` : "",
    ].filter(Boolean).join("\n").trim()

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
    })
    const claudeData = await claudeRes.json()
    const rawOutput: string = claudeData.content?.[0]?.text ?? ""
    if (!rawOutput) {
      await release(sb, claimed, "failed")
      return json({ error: "empty claude output", claude: claudeData }, 502)
    }

    let analysis: { tasks: any[]; relationship: any; email: any; company_id?: string | null }
    try {
      analysis = JSON.parse(rawOutput.replace(/```json|```/g, "").trim())
    } catch {
      await release(sb, claimed, "failed")
      return json({ error: "parse failed", raw: rawOutput }, 500)
    }

    // Only accept a company id that is actually one of ours.
    const claudeCompany = COMPANY_CHOICES.some((c) => c.id === analysis.company_id)
      ? analysis.company_id! : null
    const companyId = matchedCompany ?? claudeCompany

    const tasks = analysis.tasks ?? []
    let tasksCreated = 0
    const insertedRows: any[] = []

    if (tasks.length > 0 && !dryRun) {
      const rows = tasks.map((t: any) => ({
        id: crypto.randomUUID(), user_id: userId,
        title: t.title,
        notes: [t.notes ?? "", `From: ${title} (${date}) · Circleback`, recordingUrl, `[circleback:${linkId}]`].filter(Boolean).join("\n"),
        company_id: companyId,
        status: "todo", priority: t.priority ?? "medium",
        due_date: (t.due_date && t.due_date !== "null") ? t.due_date : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }))
      const { error } = await sb.from("tasks").insert(rows)
      if (error) {
        await release(sb, claimed, "failed")
        return json({ error: "supabase insert failed", detail: error }, 500)
      }
      tasksCreated = rows.length
      insertedRows.push(...rows.map((r) => ({ id: r.id, title: r.title, priority: r.priority, due_date: r.due_date })))
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
        draft_to: primaryCounterpart(attendees),
        processed_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("link_id", linkId)
    }

    return json({
      ok: true, meeting: title, link_id: linkId, dry_run: dryRun,
      tasks_created: tasksCreated,
      company_id: companyId,
      company_source: explicitCompany ? "payload" : matchedCompany ? "attendee_domain" : claudeCompany ? "claude" : "unresolved",
      tasks: dryRun ? tasks : insertedRows,
      relationship: analysis.relationship ?? null,
      email: analysis.email ?? null,
    })
  } catch (err) {
    if (claimed) await release(sb, claimed, "failed")
    return json({ error: String(err) }, 500)
  }
})

async function release(sb: any, c: { userId: string; linkId: string }, status: string, tasksCreated = 0) {
  await sb.from("circleback_processed")
    .update({ status, tasks_created: tasksCreated, processed_at: new Date().toISOString() })
    .eq("user_id", c.userId).eq("link_id", c.linkId)
}

async function releaseRow(sb: any, c: { userId: string; linkId: string }) {
  await sb.from("circleback_processed")
    .delete().eq("user_id", c.userId).eq("link_id", c.linkId)
}

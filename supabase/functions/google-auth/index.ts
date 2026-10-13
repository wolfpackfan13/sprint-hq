// Google sign-in held on the server, for SprintHQ.
//
// The app opens Google's consent window once (the authorization code flow).
// This function swaps that one-time code for a long-lived Google key (a
// refresh token), encrypts it, and keeps it in google_connections. After
// that, the app asks here for an hour-long pass whenever Calendar, Prep My
// Day or Drive backup needs one, so no device has to sign in to Google
// again. gmail-sync uses the same stored key for the hourly email sync.
//
// Actions (POST, JSON body { action, ... }), all for the signed-in user:
//   status      what is connected, and how the last email sync went
//   connect     { code, clientId } -> stores the key, returns a first pass
//   token       returns a fresh hour-long pass
//   disconnect  revokes the key with Google and deletes it
//
// The key never leaves this function or gmail-sync. It is encrypted with
// AES-GCM under a key derived from GOOGLE_CLIENT_SECRET (or GOOGLE_TOKEN_KEY
// when set), so a database export on its own cannot use it.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_SECRET  from the same Google Cloud OAuth client as the
//                         Client ID saved in SprintHQ Settings
// Optional:
//   GOOGLE_TOKEN_KEY      encryption key material. Changing it, or the
//                         client secret when this is unset, means
//                         connecting Google once more.
//   ALLOWED_ORIGINS       extra comma-separated origins, e.g. a custom domain
//
// Deployed as Google-auth (the app calls that exact name; function names
// are case-sensitive). Deploy with "Verify JWT" on. Requires migrations
// 006 and 007.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""
const TOKEN_KEY     = Deno.env.get("GOOGLE_TOKEN_KEY") ?? ""

const GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"
const CALENDAR_PRIMARY  = "https://www.googleapis.com/calendar/v3/calendars/primary"
const GMAIL_SCOPE       = "https://www.googleapis.com/auth/gmail.metadata"
const GOOGLE_TIMEOUT_MS = 15_000

const CLIENT_ID = /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/

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

const nowIso = () => new Date().toISOString()

// ── Encryption ────────────────────────────────────────────────
// Stored as "v1.<iv>.<ciphertext>", both base64url. gmail-sync has the
// same three functions; keep them in step.
const b64u = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function tokenKey(): Promise<CryptoKey> {
  const material = TOKEN_KEY || CLIENT_SECRET
  if (!material) throw new HttpError(503, "not_configured", "GOOGLE_CLIENT_SECRET is not set on this function yet.")
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(material), "HKDF", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("sprinthq"), info: new TextEncoder().encode("google-refresh-token-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  )
}

async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(), new TextEncoder().encode(plain))
  return `v1.${b64u(iv)}.${b64u(new Uint8Array(ct))}`
}

async function decryptToken(stored: string): Promise<string> {
  const [v, iv, ct] = String(stored).split(".")
  if (v !== "v1" || !iv || !ct) throw new HttpError(409, "reauth_needed", "The stored Google key is unreadable. Connect Google again.")
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await tokenKey(), unb64u(ct))
    return new TextDecoder().decode(plain)
  } catch {
    // The encryption key changed (client secret rotated, GOOGLE_TOKEN_KEY set).
    throw new HttpError(409, "reauth_needed", "The stored Google key no longer matches this function's secret. Connect Google again.")
  }
}

// ── Google calls ──────────────────────────────────────────────
async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    throw new HttpError(502, "google_unreachable", "Couldn't reach Google. Try again in a minute.")
  } finally {
    clearTimeout(timer)
  }
}

async function tokenRequest(params: Record<string, string>) {
  const res = await googleFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

async function revoke(token: string) {
  try {
    await googleFetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    })
  } catch {
    // Best effort. The row is deleted either way.
  }
}

// Whose account this is. Gmail's profile names it; the primary calendar's
// id is the same address when Gmail access was not granted.
async function accountEmail(accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  for (const url of [GMAIL_PROFILE_URL, CALENDAR_PRIMARY]) {
    const res = await googleFetch(url, { headers })
    if (!res.ok) continue
    const body = await res.json().catch(() => ({}))
    const email = String(body.emailAddress ?? body.id ?? "").trim().toLowerCase()
    if (email.includes("@")) return email
  }
  throw new HttpError(502, "no_email", "Google didn't say which account this is. Connect again and leave Gmail or Calendar ticked.")
}

function describeTokenError(body: any): HttpError {
  const err = String(body?.error ?? "")
  if (err === "invalid_client" || err === "unauthorized_client") {
    return new HttpError(503, "bad_client_secret", "GOOGLE_CLIENT_SECRET doesn't match the Client ID in Settings. Copy the secret from the same OAuth client.")
  }
  if (err === "redirect_uri_mismatch") {
    return new HttpError(400, "redirect_mismatch", "Google refused the sign-in origin. Check that this site is listed under Authorized JavaScript origins for the OAuth client.")
  }
  if (err === "invalid_grant") {
    return new HttpError(400, "bad_code", "That Google sign-in expired before it reached SprintHQ. Tap Connect Google again.")
  }
  return new HttpError(502, "google_error", `Google refused the sign-in (${err || "unknown error"}).`)
}

// ── Actions ───────────────────────────────────────────────────
type Connection = {
  user_id: string; google_email: string; refresh_token: string; scopes: string
  client_id: string | null; connected_at: string; history_id: string | null
  last_sync_at: string | null; last_sync_status: string | null; last_sync_error: string | null
  last_sync_counts: Record<string, unknown> | null; sync_started_at: string | null
}

async function loadConnection(sb: any, userId: string): Promise<Connection | null> {
  const { data, error } = await sb.from("google_connections").select("*").eq("user_id", userId).maybeSingle()
  if (error) {
    if (/does not exist|schema cache/i.test(error.message ?? "")) {
      throw new HttpError(503, "not_migrated", "Run migrations 006 and 007 in Supabase first.")
    }
    throw new Error(`google_connections read failed: ${error.message}`)
  }
  return data as Connection | null
}

function statusOf(row: Connection | null) {
  if (!row) return { ok: true, connected: false }
  const scopes = (row.scopes || "").split(/\s+/).filter(Boolean)
  return {
    ok: true,
    connected: true,
    email: row.google_email,
    scopes,
    gmail: scopes.includes(GMAIL_SCOPE),
    connectedAt: row.connected_at,
    backfillDone: !!row.history_id,
    syncing: !!row.sync_started_at,
    lastSync: row.last_sync_at || row.last_sync_status
      ? { at: row.last_sync_at, status: row.last_sync_status, error: row.last_sync_error, counts: row.last_sync_counts ?? {} }
      : null,
  }
}

async function connect(sb: any, userId: string, body: any) {
  const code = String(body.code ?? "")
  const clientId = String(body.clientId ?? "").trim()
  if (!code || code.length > 2048) throw new HttpError(400, "bad_code", "Google didn't send a sign-in code. Tap Connect Google again.")
  if (!CLIENT_ID.test(clientId)) throw new HttpError(400, "bad_client_id", "The Google Client ID in Settings doesn't look right.")
  if (!CLIENT_SECRET) throw new HttpError(503, "not_configured", "GOOGLE_CLIENT_SECRET is not set on this function yet.")

  // A popup code flow is exchanged with the fixed redirect "postmessage".
  const res = await tokenRequest({
    code, client_id: clientId, client_secret: CLIENT_SECRET,
    redirect_uri: "postmessage", grant_type: "authorization_code",
  })
  if (!res.ok) throw describeTokenError(res.body)
  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, scope } = res.body

  // Google only hands out a refresh token when the account approves
  // SprintHQ fresh. Earlier one-hour sign-ins count as approval, so the first
  // try can come back without one. Revoking clears that approval, and the
  // next Connect shows the consent screen and returns a key.
  if (!refreshToken) {
    if (accessToken) await revoke(accessToken)
    throw new HttpError(409, "retry_consent", "Google needs you to approve SprintHQ once more. Tap Connect Google again.")
  }

  const email = await accountEmail(accessToken)
  const existing = await loadConnection(sb, userId)
  const sameAccount = existing?.google_email === email

  const row = {
    user_id: userId,
    google_email: email,
    refresh_token: await encryptToken(refreshToken),
    scopes: String(scope ?? ""),
    client_id: clientId,
    connected_at: nowIso(),
    // Same account: carry on from where email sync left off.
    history_id: sameAccount ? existing!.history_id : null,
    sync_state: sameAccount ? undefined : {},
    last_sync_status: sameAccount && existing!.last_sync_status !== "reauth_needed" ? existing!.last_sync_status : null,
    last_sync_error: null,
    updated_at: nowIso(),
  }
  if (row.sync_state === undefined) delete (row as any).sync_state
  const { error } = await sb.from("google_connections").upsert(row, { onConflict: "user_id" })
  if (error) throw new Error(`google_connections write failed: ${error.message}`)

  // A key for a different account or OAuth client is no longer needed.
  // Same account and client: leave it alone. Revoking ends the whole
  // approval, which would take the new key with it.
  if (existing?.refresh_token && (!sameAccount || existing.client_id !== clientId)) {
    try { await revoke(await decryptToken(existing.refresh_token)) } catch { /* unreadable or already gone */ }
  }

  const saved = await loadConnection(sb, userId)
  return { ...statusOf(saved), accessToken, expiresIn: Number(expiresIn) || 3599 }
}

async function token(sb: any, userId: string) {
  const row = await loadConnection(sb, userId)
  if (!row) throw new HttpError(404, "not_connected", "Google isn't connected on the server. Connect it in Settings.")
  if (!row.client_id) throw new HttpError(409, "reauth_needed", "Connect Google again to finish setup.")

  let refreshToken: string
  try {
    refreshToken = await decryptToken(row.refresh_token)
  } catch (err) {
    await markReauth(sb, userId, (err as Error).message)
    throw err
  }

  const res = await tokenRequest({
    client_id: row.client_id, client_secret: CLIENT_SECRET,
    refresh_token: refreshToken, grant_type: "refresh_token",
  })
  if (!res.ok) {
    if (res.body?.error === "invalid_grant") {
      const msg = "Google withdrew SprintHQ's access (password change, removed in your Google account, or unused for six months). Connect Google again."
      await markReauth(sb, userId, msg)
      throw new HttpError(409, "reauth_needed", msg)
    }
    throw describeTokenError(res.body)
  }
  return {
    ok: true,
    accessToken: res.body.access_token,
    expiresIn: Number(res.body.expires_in) || 3599,
    email: row.google_email,
    scopes: String(res.body.scope ?? row.scopes ?? "").split(/\s+/).filter(Boolean),
  }
}

async function markReauth(sb: any, userId: string, message: string) {
  await sb.from("google_connections")
    .update({ last_sync_status: "reauth_needed", last_sync_error: message, updated_at: nowIso() })
    .eq("user_id", userId)
}

async function disconnect(sb: any, userId: string) {
  const row = await loadConnection(sb, userId)
  if (row?.refresh_token) {
    try { await revoke(await decryptToken(row.refresh_token)) } catch { /* unreadable: delete anyway */ }
  }
  const { error } = await sb.from("google_connections").delete().eq("user_id", userId)
  if (error) throw new Error(`google_connections delete failed: ${error.message}`)
  return { ok: true, connected: false }
}

// ── Entry ─────────────────────────────────────────────────────
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
    const userId = userData.user.id

    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case "status":     return json(statusOf(await loadConnection(sb, userId)))
      case "connect":    return json(await connect(sb, userId, body))
      case "token":      return json(await token(sb, userId))
      case "disconnect": return json(await disconnect(sb, userId))
      default: throw new HttpError(400, "bad_action", "Unknown action.")
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ ok: false, code: err.code, error: err.message }, err.status)
    console.error(err)
    return json({ ok: false, code: "error", error: String((err as Error)?.message ?? err) }, 500)
  }
})

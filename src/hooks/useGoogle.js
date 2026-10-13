import { useState, useCallback, useRef, useEffect } from 'react'
import { calUtils } from '../utils/dateUtils'
import { supabase } from '../utils/supabase'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.metadata'
const SCOPES = [
  CALENDAR_SCOPE,
  'https://www.googleapis.com/auth/drive.file',
  // Headers and labels only. Message bodies stay in Gmail.
  GMAIL_SCOPE,
].join(' ')

// How Google access works
//
// Server mode (the google-auth function is deployed):
//   Connect opens Google's consent window once. The function keeps a
//   long-lived Google key and hands out hour-long passes, so Calendar, Prep
//   My Day and Drive backup get a fresh pass on their own, on every device
//   signed in to SprintHQ. The same key runs the hourly Gmail sync.
//
// One-hour mode (the function is not deployed yet):
//   Google's pass lasts an hour and is renewed with one tap (Refresh Google).
//   "Linked" (settings.googleConnected) and "token is fresh" are separate,
//   so an expired pass offers Refresh instead of a full reconnect.
//
// In both modes every Google reply is checked, and an error becomes a
// sentence the screen can show instead of an empty calendar.
//
// Google's window must open inside the tap that asks for it, or the browser
// blocks it as an unwanted pop-up. connect() and renew() are called straight
// from click handlers, never after a timer or an await.

const FRESH_MARGIN_MS = 60 * 1000

export function tokenIsFresh(settings) {
  return !!settings.googleToken && !!settings.googleTokenExpiry &&
    Date.now() < settings.googleTokenExpiry - FRESH_MARGIN_MS
}

// Thrown when a request needs a fresh token. Screens show the Refresh
// prompt for this case rather than an error message.
class NeedsRenewal extends Error {
  constructor() { super('Google sign-in needs a refresh'); this.needsRenewal = true }
}

function mapEvent(ev) {
  return {
    id: ev.id,
    title: ev.summary || 'No title',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    allDay: !ev.start?.dateTime,
    location: ev.location || '',
    description: ev.description || '',
    attendees: (ev.attendees || []).map(a => a.email),
    htmlLink: ev.htmlLink,
  }
}

function describeSignInError(type) {
  switch (type) {
    case 'popup_failed_to_open':
      return 'The browser blocked the Google sign-in window. Allow pop-ups for this site, then tap again.'
    case 'popup_closed':
      return 'The Google window closed before sign-in finished. Tap again to retry.'
    case 'access_denied':
      return 'Google sign-in was cancelled.'
    case 'interaction_required':
    case 'consent_required':
    case 'login_required':
      return 'Google needs you to sign in again. Tap Reconnect.'
    default:
      return `Google sign-in did not finish (${type}). Tap again to retry.`
  }
}

// Calls one of our edge functions. Never throws.
// Returns { ok: true, data } or { ok: false, code, error, data? }.
async function invokeFn(name, body) {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (error) {
      let payload = null
      try { payload = await error.context?.json?.() } catch { payload = null }
      // The Supabase gateway answers NOT_FOUND (upper case) when the function
      // has not been deployed; ours answer in lower case.
      const code = payload?.code === 'NOT_FOUND' ? 'not_deployed'
        : payload?.code || payload?.status || (error.name === 'FunctionsFetchError' ? 'offline' : 'error')
      return { ok: false, code, error: payload?.error || payload?.message || error.message, data: payload }
    }
    if (data?.ok === false) return { ok: false, code: data.code || data.status || 'error', error: data.error, data }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, code: 'offline', error: err.message }
  }
}

const UNAVAILABLE = ['not_deployed', 'not_migrated']

function serverFromStatus(d) {
  return {
    checked: true,
    available: true,
    connected: !!d.connected,
    email: d.email || '',
    gmail: !!d.gmail,
    scopes: d.scopes || [],
    backfillDone: !!d.backfillDone,
    syncing: !!d.syncing,
    lastSync: d.lastSync || null,
    reauth: d.lastSync?.status === 'reauth_needed',
  }
}

export function useGoogle(settings, { saveSettings, saveGoogleToken, expireGoogleToken, clearGoogleToken, onEmailSynced }) {
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [calendarError, setCalendarError] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [signingIn, setSigningIn] = useState(false)
  const [calendarScopeMissing, setCalendarScopeMissing] = useState(false)
  const [server, setServer] = useState({ checked: false, available: false, connected: false })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // Callbacks read the latest values through refs, so a token saved a
  // moment ago is used right away, before React has re-rendered.
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const serverRef = useRef(server)
  serverRef.current = server
  const onSyncedRef = useRef(onEmailSynced)
  onSyncedRef.current = onEmailSynced

  const tokenClientRef = useRef({ clientId: null, client: null })
  const tokenPromiseRef = useRef(null)

  const serverMode = server.connected && !server.reauth
  const isReady = () => !!(window.google && settings.googleClientId)
  // Linked on this device or on the server. The pass may still need renewing.
  const isConnected = () => !!settings.googleConnected || server.connected
  const hasFreshToken = tokenIsFresh(settings)
  const reconnectNeeded = server.connected && server.reauth
  // Waits for the server check, so a device that is about to get a pass from
  // the server doesn't flash the Refresh banner first.
  const needsRenewal = (server.checked && !!settings.googleConnected && !hasFreshToken && !server.connected) || reconnectNeeded

  // ── Server connection ─────────────────────────────────────
  const refreshServerStatus = useCallback(async () => {
    const r = await invokeFn('google-auth', { action: 'status' })
    if (r.ok) {
      const st = serverFromStatus(r.data)
      setServer(st)
      // Linked on the server means linked on every device.
      if (st.connected && !st.reauth && (!settingsRef.current.googleConnected || settingsRef.current.googleEmail !== st.email)) {
        saveSettings({ googleConnected: true, googleEmail: st.email })
      }
      return st
    }
    if (UNAVAILABLE.includes(r.code)) setServer({ checked: true, available: false, connected: false, unavailable: r.code })
    else setServer(prev => ({ ...prev, checked: true }))
    return null
  }, [saveSettings])

  useEffect(() => { refreshServerStatus() }, [refreshServerStatus])

  // One request at a time; every caller waiting on a pass shares it.
  const getServerToken = useCallback(() => {
    if (tokenPromiseRef.current) return tokenPromiseRef.current
    const p = (async () => {
      const r = await invokeFn('google-auth', { action: 'token' })
      if (r.ok && r.data?.accessToken) {
        saveGoogleToken(r.data.accessToken, r.data.expiresIn)
        settingsRef.current = {
          ...settingsRef.current,
          googleToken: r.data.accessToken,
          googleTokenExpiry: Date.now() + (r.data.expiresIn || 3599) * 1000,
          googleConnected: true,
        }
        setAuthError(null)
        return r.data.accessToken
      }
      if (r.code === 'reauth_needed') {
        setServer(s => ({ ...s, reauth: true }))
        setAuthError(r.error || 'Google withdrew SprintHQ\'s access. Tap Reconnect.')
      } else if (r.code === 'not_connected') {
        setServer(s => ({ ...s, connected: false }))
      } else {
        setAuthError(r.error || 'Couldn\'t get a Google pass from the server. Try again in a minute.')
      }
      return null
    })().finally(() => { tokenPromiseRef.current = null })
    tokenPromiseRef.current = p
    return p
  }, [saveGoogleToken])

  // Server mode: fetch a pass as soon as the stored one is stale. Failures
  // wait 30 seconds before the next try.
  const lastAutoRef = useRef(0)
  useEffect(() => {
    if (!serverMode || hasFreshToken) return
    if (Date.now() - lastAutoRef.current < 30_000) return
    lastAutoRef.current = Date.now()
    getServerToken()
  }, [serverMode, hasFreshToken, getServerToken])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)
    const r = await invokeFn('gmail-sync', {})
    setSyncing(false)
    setSyncResult(r.ok ? r.data : { status: r.code, error: r.error })
    await refreshServerStatus()
    if (r.ok) onSyncedRef.current?.()
    return r
  }, [refreshServerStatus])

  // ── One-hour mode ─────────────────────────────────────────
  // Ask Google which account this is, so later refreshes can skip the
  // account chooser. The primary calendar's id is the account email.
  const learnAccountEmail = useCallback(async (accessToken) => {
    try {
      const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!resp.ok) return
      const data = await resp.json()
      if (data?.id && data.id.includes('@')) saveSettings({ googleEmail: data.id })
    } catch {
      // Not essential. Refresh still works, it just may show the chooser.
    }
  }, [saveSettings])

  const getTokenClient = useCallback((clientId) => {
    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2 || !clientId) return null
    if (tokenClientRef.current.client && tokenClientRef.current.clientId === clientId) {
      return tokenClientRef.current.client
    }
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      include_granted_scopes: true,
      callback: (resp) => {
        setSigningIn(false)
        if (resp.error) {
          setAuthError(describeSignInError(resp.error))
          return
        }
        const calendarGranted = typeof oauth2.hasGrantedAllScopes === 'function'
          ? oauth2.hasGrantedAllScopes(resp, CALENDAR_SCOPE)
          : true
        setCalendarScopeMissing(!calendarGranted)
        setAuthError(calendarGranted ? null
          : 'Google connected, but calendar access was left unticked. Tap Reconnect and tick the box for Google Calendar.')
        setCalendarError(null)
        saveGoogleToken(resp.access_token, resp.expires_in)
        if (calendarGranted && !settingsRef.current.googleEmail) learnAccountEmail(resp.access_token)
      },
      error_callback: (err) => {
        setSigningIn(false)
        setAuthError(describeSignInError(err?.type || 'unknown'))
      },
    })
    tokenClientRef.current = { clientId, client }
    return client
  }, [saveGoogleToken, learnAccountEmail])

  const signInBlocked = (id) => {
    if (!id) return 'Add your Google Client ID in Settings first.'
    if (!window.google?.accounts?.oauth2) return 'Google sign-in is still loading. Give it a few seconds and tap again.'
    return null
  }

  // Opens Google's window. Call straight from a click handler.
  //   fresh: true  -> full sign-in with account chooser and consent
  //   fresh: false -> quick refresh, no consent screen when already granted
  const requestToken = useCallback(({ clientId, fresh }) => {
    const id = clientId || settingsRef.current.googleClientId
    const blocked = signInBlocked(id)
    if (blocked) { setAuthError(blocked); return }
    try {
      const client = getTokenClient(id)
      if (!client) {
        setAuthError('Could not start Google sign-in. Check that the Client ID in Settings is correct.')
        return
      }
      setAuthError(null)
      setSigningIn(true)
      const hint = settingsRef.current.googleEmail
      const options = fresh
        ? { prompt: 'consent' }
        : { prompt: calendarScopeMissing ? 'consent' : '' }
      if (hint) options.login_hint = hint
      client.requestAccessToken(options)
    } catch (err) {
      setSigningIn(false)
      setAuthError('Google sign-in error: ' + err.message)
    }
  }, [getTokenClient, calendarScopeMissing])

  // Server mode connect: Google's window returns a one-time code, and
  // google-auth swaps it for the long-lived key. Call from a click handler.
  const requestCode = useCallback((clientId) => {
    const id = clientId || settingsRef.current.googleClientId
    const blocked = signInBlocked(id)
    if (blocked) { setAuthError(blocked); return }
    try {
      const hint = settingsRef.current.googleEmail || serverRef.current.email
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: id,
        scope: SCOPES,
        ux_mode: 'popup',
        // Only these scopes on the stored key, not anything granted before.
        include_granted_scopes: false,
        ...(hint ? { login_hint: hint } : {}),
        callback: async (resp) => {
          if (resp.error) {
            setSigningIn(false)
            setAuthError(describeSignInError(resp.error))
            return
          }
          const r = await invokeFn('google-auth', { action: 'connect', code: resp.code, clientId: id })
          setSigningIn(false)
          if (!r.ok) {
            // Google's earlier approval was cleared to get a key; the old
            // one-hour pass went with it.
            if (r.code === 'retry_consent') expireGoogleToken()
            setAuthError(r.error || 'Google sign-in did not finish. Tap Connect Google again.')
            return
          }
          const d = r.data
          saveGoogleToken(d.accessToken, d.expiresIn)
          saveSettings({ googleConnected: true, googleEmail: d.email })
          setServer(serverFromStatus(d))
          setCalendarError(null)
          setCalendarScopeMissing(!(d.scopes || []).includes(CALENDAR_SCOPE))
          if (!d.gmail) {
            setAuthError('Google is connected, but Gmail was left unticked, so email sync is off. Tap Reconnect Google and tick Gmail to turn it on.')
          } else {
            setAuthError(null)
            syncNow()
          }
        },
        error_callback: (err) => {
          setSigningIn(false)
          setAuthError(describeSignInError(err?.type || 'unknown'))
        },
      })
      setAuthError(null)
      setSigningIn(true)
      client.requestCode()
    } catch (err) {
      setSigningIn(false)
      setAuthError('Google sign-in error: ' + err.message)
    }
  }, [saveGoogleToken, saveSettings, expireGoogleToken, syncNow])

  // Connect from Settings. Pass the Client ID from the input so it works in
  // the same tap that saves it.
  const connect = useCallback((clientId) => {
    const id = typeof clientId === 'string' ? clientId : undefined
    if (serverRef.current.available) requestCode(id)
    else requestToken({ clientId: id, fresh: true })
  }, [requestCode, requestToken])

  // The Refresh / Reconnect button on Calendar and Prep My Day.
  const renew = useCallback(() => {
    const s = serverRef.current
    if (s.available && (s.reauth || calendarScopeMissing)) { requestCode(); return }
    if (s.connected) { getServerToken(); return }
    requestToken({ fresh: false })
  }, [requestCode, requestToken, getServerToken, calendarScopeMissing])

  const disconnect = useCallback(async () => {
    if (serverRef.current.connected) {
      // Revokes the stored key with Google, which also ends this pass.
      await invokeFn('google-auth', { action: 'disconnect' })
    } else {
      const token = settingsRef.current.googleToken
      if (window.google?.accounts?.oauth2 && token) window.google.accounts.oauth2.revoke(token)
    }
    clearGoogleToken()
    setCalendarEvents([])
    setCalendarError(null)
    setAuthError(null)
    setCalendarScopeMissing(false)
    setSyncResult(null)
    setServer(s => ({ ...s, connected: false, reauth: false, email: '', lastSync: null, gmail: false }))
  }, [clearGoogleToken])

  // ── Google API calls ──────────────────────────────────────
  const describeApiError = useCallback((status, body) => {
    const err = body?.error || {}
    const message = typeof err === 'string' ? err : (err.message || '')
    const reasons = (err.errors || []).map(e => e.reason).concat(
      (err.details || []).map(d => d.reason).filter(Boolean)
    )
    const has = (r) => reasons.includes(r)
    if (status === 403 && (has('insufficientPermissions') || has('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || /insufficient authentication scopes/i.test(message))) {
      setCalendarScopeMissing(true)
      return 'SprintHQ can reach your Google account but not your calendar. Tap Reconnect and tick the box for Google Calendar.'
    }
    if (status === 403 && (has('accessNotConfigured') || has('SERVICE_DISABLED') || /has not been used|is disabled/i.test(message))) {
      return 'The Google Calendar API is switched off in your Google Cloud project. Turn it on at console.cloud.google.com under APIs & Services, Library, Google Calendar API, then refresh.'
    }
    if (status === 429 || has('rateLimitExceeded') || has('userRateLimitExceeded')) {
      return 'Google is limiting requests right now. Try again in a minute.'
    }
    return `Google returned an error (${status})${message ? `: ${message}` : ''}`
  }, [])

  // A fresh pass: the stored one, or one from the server, or NeedsRenewal.
  const currentToken = useCallback(async () => {
    const s = settingsRef.current
    if (tokenIsFresh(s)) return s.googleToken
    if (serverRef.current.connected && !serverRef.current.reauth) {
      const token = await getServerToken()
      if (token) return token
      throw new NeedsRenewal()
    }
    if (s.googleToken) expireGoogleToken()
    throw new NeedsRenewal()
  }, [getServerToken, expireGoogleToken])

  const authFetch = useCallback(async (url) => {
    let token = await currentToken()
    for (let attempt = 0; ; attempt++) {
      let resp
      try {
        resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      } catch {
        throw new Error('Could not reach Google. Check your connection and refresh.')
      }
      if (resp.status === 401) {
        expireGoogleToken()
        settingsRef.current = { ...settingsRef.current, googleToken: null, googleTokenExpiry: null }
        // Server mode: one more try with a pass straight from the server.
        if (attempt === 0 && serverRef.current.connected && !serverRef.current.reauth) {
          token = await currentToken()
          continue
        }
        throw new NeedsRenewal()
      }
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(describeApiError(resp.status, body))
      return body
    }
  }, [currentToken, expireGoogleToken, describeApiError])

  // Returns the events, or null when they could not be loaded (the reason is
  // in calendarError, or needsRenewal is true).
  const loadEvents = useCallback(async (url) => {
    if (!settingsRef.current.googleConnected && !serverRef.current.connected) return null
    setLoadingCalendar(true)
    setCalendarError(null)
    try {
      const data = await authFetch(url)
      const events = (data.items || []).map(mapEvent)
      setCalendarEvents(events)
      return events
    } catch (err) {
      if (!err.needsRenewal) setCalendarError(err.message)
      return null
    } finally {
      setLoadingCalendar(false)
    }
  }, [authFetch])

  const fetchCalendarRange = useCallback((startDate, endDate) => {
    const timeMin = new Date(startDate + 'T00:00:00').toISOString()
    const timeMax = new Date(endDate + 'T23:59:59').toISOString()
    return loadEvents(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`
    )
  }, [loadEvents])

  const fetchCalendarEvents = useCallback((daysAhead = 14) => {
    const now = new Date().toISOString()
    const end = new Date(Date.now() + daysAhead * 86400000).toISOString()
    return loadEvents(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=50`
    )
  }, [loadEvents])

  const backupToDrive = useCallback(async (data) => {
    if (!settingsRef.current.googleConnected && !serverRef.current.connected) return { success: false, error: 'Not connected' }
    let token
    try {
      token = await currentToken()
    } catch {
      return { success: false, error: 'Google sign-in needs a refresh. Tap Refresh Google, then back up again.' }
    }
    try {
      const filename = `sprintHQ_backup_${new Date().toISOString().split('T')[0]}.json`
      const content = JSON.stringify(data, null, 2)
      const metadata = { name: filename, mimeType: 'application/json' }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([content], { type: 'application/json' }))
      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (resp.status === 401) {
        expireGoogleToken()
        return { success: false, error: 'Google sign-in needs a refresh. Tap Refresh Google, then back up again.' }
      }
      const result = await resp.json().catch(() => ({}))
      if (!resp.ok) return { success: false, error: result?.error?.message || `Drive returned ${resp.status}` }
      return { success: true, fileId: result.id, filename }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [currentToken, expireGoogleToken])

  // Headers only (gmail.metadata). Gmail search (q=) is not allowed with this
  // scope, so the inbox is picked by label.
  const fetchRecentEmails = useCallback(async (maxResults = 20) => {
    if (!settingsRef.current.googleConnected && !serverRef.current.connected) return []
    try {
      const listData = await authFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`
      )
      const messages = listData.messages || []
      const details = await Promise.all(
        messages.slice(0, 10).map(m =>
          authFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
        )
      )
      return details.map(d => {
        const headers = d.payload?.headers || []
        const get = (name) => headers.find(h => h.name === name)?.value || ''
        return { id: d.id, subject: get('Subject'), from: get('From'), date: get('Date'), snippet: d.snippet }
      })
    } catch {
      return []
    }
  }, [authFetch])

  // Local dates, so events after 8 PM Eastern still count as today.
  const today = calUtils.localToday()
  const todayEvents = calendarEvents.filter(ev => (ev.start || '').split('T')[0] === today)
  const upcomingEvents = calendarEvents.filter(ev => (ev.start || '').split('T')[0] > today)

  return {
    isReady,
    isConnected,
    hasFreshToken,
    needsRenewal,
    reconnectNeeded,
    signingIn,
    authError,
    calendarScopeMissing,
    connect,
    renew,
    disconnect,
    server,
    syncing: syncing || !!server.syncing,
    syncResult,
    syncNow,
    refreshServerStatus,
    calendarEvents,
    todayEvents,
    upcomingEvents,
    loadingCalendar,
    calendarError,
    fetchCalendarEvents,
    fetchCalendarRange,
    backupToDrive,
    fetchRecentEmails,
  }
}

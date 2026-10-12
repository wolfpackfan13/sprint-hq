import { useState, useCallback, useRef } from 'react'
import { calUtils } from '../utils/dateUtils'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const SCOPES = [
  CALENDAR_SCOPE,
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

// How Google access works in a browser-only app
//
// Google hands back an access token that lasts one hour. There is no server
// here to hold a refresh token, so the token cannot be renewed in the
// background. What this hook does instead:
//
//   - "Linked" (settings.googleConnected) and "token is fresh" are separate.
//     An expired token leaves the device linked, so screens offer a one-tap
//     Refresh instead of sending you back to Settings to start over.
//   - Refresh asks Google with prompt '' and the account's email as a hint,
//     so Google skips the consent screen and the account chooser. The window
//     opens and closes on its own.
//   - Every Google reply is checked. An error is turned into a sentence the
//     screen can show, instead of an empty calendar.
//
// The sign-in window must open inside the tap that asks for it, or the
// browser treats it as an unwanted pop-up and blocks it. connect() and
// renew() are therefore called directly from click handlers, never after a
// timer or an await.

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

export function useGoogle(settings, { saveSettings, saveGoogleToken, expireGoogleToken, clearGoogleToken }) {
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [calendarError, setCalendarError] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [signingIn, setSigningIn] = useState(false)
  const [calendarScopeMissing, setCalendarScopeMissing] = useState(false)

  // Callbacks read settings through this ref so a token saved a moment ago
  // is used right away, before React has re-rendered.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const tokenClientRef = useRef({ clientId: null, client: null })

  const isReady = () => !!(window.google && settings.googleClientId)
  // Linked on this device. The token itself may still need a refresh.
  const isConnected = () => !!settings.googleConnected
  const hasFreshToken = tokenIsFresh(settings)
  const needsRenewal = !!settings.googleConnected && !hasFreshToken

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

  // Opens Google's window. Call straight from a click handler.
  //   fresh: true  -> full sign-in with account chooser and consent
  //   fresh: false -> quick refresh, no consent screen when already granted
  const requestToken = useCallback(({ clientId, fresh }) => {
    const id = clientId || settingsRef.current.googleClientId
    if (!id) {
      setAuthError('Add your Google Client ID in Settings first.')
      return
    }
    if (!window.google?.accounts?.oauth2) {
      setAuthError('Google sign-in is still loading. Give it a few seconds and tap again.')
      return
    }
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

  // First-time connect from Settings. Pass the Client ID from the input so
  // it works in the same tap that saves it.
  const connect = useCallback((clientId) => {
    requestToken({ clientId: typeof clientId === 'string' ? clientId : undefined, fresh: true })
  }, [requestToken])

  // One-tap refresh once the hour is up.
  const renew = useCallback(() => {
    requestToken({ fresh: false })
  }, [requestToken])

  const disconnect = useCallback(() => {
    const token = settingsRef.current.googleToken
    if (window.google?.accounts?.oauth2 && token) {
      window.google.accounts.oauth2.revoke(token)
    }
    clearGoogleToken()
    setCalendarEvents([])
    setCalendarError(null)
    setAuthError(null)
    setCalendarScopeMissing(false)
  }, [clearGoogleToken])

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

  const authFetch = useCallback(async (url) => {
    const s = settingsRef.current
    if (!tokenIsFresh(s)) {
      if (s.googleToken) expireGoogleToken()
      throw new NeedsRenewal()
    }
    let resp
    try {
      resp = await fetch(url, { headers: { Authorization: `Bearer ${s.googleToken}` } })
    } catch {
      throw new Error('Could not reach Google. Check your connection and refresh.')
    }
    if (resp.status === 401) {
      expireGoogleToken()
      throw new NeedsRenewal()
    }
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(describeApiError(resp.status, body))
    return body
  }, [expireGoogleToken, describeApiError])

  // Returns the events, or null when they could not be loaded (the reason is
  // in calendarError, or needsRenewal is true).
  const loadEvents = useCallback(async (url) => {
    if (!settingsRef.current.googleConnected) return null
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
    const s = settingsRef.current
    if (!s.googleConnected) return { success: false, error: 'Not connected' }
    if (!tokenIsFresh(s)) {
      if (s.googleToken) expireGoogleToken()
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
        headers: { Authorization: `Bearer ${s.googleToken}` },
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
  }, [expireGoogleToken])

  const fetchRecentEmails = useCallback(async (maxResults = 20) => {
    if (!settingsRef.current.googleConnected) return []
    try {
      const listData = await authFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`
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
    signingIn,
    authError,
    calendarScopeMissing,
    connect,
    renew,
    disconnect,
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

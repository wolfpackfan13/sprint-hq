import { useState, useCallback, useRef } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

export function useGoogle(settings, saveGoogleToken, clearGoogleToken) {
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [calendarError, setCalendarError] = useState(null)
  const tokenClientRef = useRef(null)

  const isReady = () => !!(window.google && settings.googleClientId)
  const isConnected = () => settings.googleConnected && !!settings.googleToken

  const initTokenClient = useCallback(() => {
    if (!window.google?.accounts?.oauth2 || !settings.googleClientId) return null
    if (tokenClientRef.current) return tokenClientRef.current
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: settings.googleClientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { clearGoogleToken(); return }
        saveGoogleToken(resp.access_token, resp.expires_in)
      },
    })
    return tokenClientRef.current
  }, [settings.googleClientId, saveGoogleToken, clearGoogleToken])

  const connect = useCallback(() => {
    // Guard 1: Client ID must be present
    if (!settings.googleClientId) {
      alert('Paste your Google Client ID and click "Save Settings" first, then Connect.')
      return
    }
    // Guard 2: Google script must be loaded
    if (!window.google?.accounts?.oauth2) {
      alert('Google sign-in is still loading. Wait a few seconds and try again. If this keeps happening, refresh the page.')
      return
    }
    try {
      const client = initTokenClient()
      if (client) {
        client.requestAccessToken()
      } else {
        alert('Could not start Google sign-in. Make sure your Client ID is saved and correct.')
      }
    } catch (err) {
      alert('Google sign-in error: ' + err.message)
    }
  }, [settings.googleClientId, initTokenClient])

  const disconnect = useCallback(() => {
    if (window.google?.accounts?.oauth2 && settings.googleToken) {
      window.google.accounts.oauth2.revoke(settings.googleToken)
    }
    clearGoogleToken()
    setCalendarEvents([])
  }, [settings.googleToken, clearGoogleToken])

  const authFetch = useCallback(async (url) => {
    if (!settings.googleToken) throw new Error('Not connected')
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${settings.googleToken}` }
    })
    if (resp.status === 401) { clearGoogleToken(); throw new Error('Token expired') }
    return resp.json()
  }, [settings.googleToken, clearGoogleToken])

  const fetchCalendarEvents = useCallback(async (daysAhead = 14) => {
    if (!isConnected()) return
    setLoadingCalendar(true)
    setCalendarError(null)
    try {
      const now = new Date().toISOString()
      const end = new Date(Date.now() + daysAhead * 86400000).toISOString()
      const data = await authFetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=50`
      )
      const events = (data.items || []).map(ev => ({
        id: ev.id,
        title: ev.summary || 'No title',
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        allDay: !ev.start?.dateTime,
        location: ev.location || '',
        description: ev.description || '',
        attendees: (ev.attendees || []).map(a => a.email),
        htmlLink: ev.htmlLink,
      }))
      setCalendarEvents(events)
      return events
    } catch (err) {
      setCalendarError(err.message)
      return []
    } finally {
      setLoadingCalendar(false)
    }
  }, [authFetch, isConnected])

  const backupToDrive = useCallback(async (data) => {
    if (!isConnected()) return { success: false, error: 'Not connected' }
    try {
      const filename = `sprintHQ_backup_${new Date().toISOString().split('T')[0]}.json`
      const content = JSON.stringify(data, null, 2)
      const metadata = { name: filename, mimeType: 'application/json' }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([content], { type: 'application/json' }))
      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.googleToken}` },
        body: form,
      })
      const result = await resp.json()
      return { success: true, fileId: result.id, filename }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [settings.googleToken, isConnected])

  const fetchRecentEmails = useCallback(async (maxResults = 20) => {
    if (!isConnected()) return []
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
  }, [authFetch, isConnected])

  const todayEvents = calendarEvents.filter(ev => {
    const evDate = (ev.start || '').split('T')[0]
    return evDate === new Date().toISOString().split('T')[0]
  })

  const upcomingEvents = calendarEvents.filter(ev => {
    const evDate = (ev.start || '').split('T')[0]
    return evDate > new Date().toISOString().split('T')[0]
  })

  return {
    isReady,
    isConnected,
    connect,
    disconnect,
    calendarEvents,
    todayEvents,
    upcomingEvents,
    loadingCalendar,
    calendarError,
    fetchCalendarEvents,
    backupToDrive,
    fetchRecentEmails,
  }
}

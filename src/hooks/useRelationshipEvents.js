import { useState, useEffect, useCallback, useRef } from 'react'

const PAST_DAYS = 14
const AHEAD_DAYS = 90
const REFRESH_MS = 15 * 60 * 1000

// The calendar window Relationships works from: two weeks back (meetings
// that may still need notes) and three months ahead (next touches).
// Separate from the Calendar page's own list, which follows whatever range
// that page is showing.
//
// events is null until the first successful read, so callers can tell
// "nothing on the calendar" from "couldn't read the calendar".
export function useRelationshipEvents(google, { enabled = true } = {}) {
  const [events, setEvents] = useState(null)
  const [loadedAt, setLoadedAt] = useState(0)
  // false when the calendar had more events than one read takes.
  const [complete, setComplete] = useState(true)
  const listRef = useRef(google.listEvents)
  listRef.current = google.listEvents
  const busy = useRef(false)
  const loadedAtRef = useRef(0)
  loadedAtRef.current = loadedAt

  const connected = google.isConnected()
  const freshPass = google.hasFreshToken || (google.server?.connected && !google.server?.reauth)

  const reload = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const now = Date.now()
      const list = await listRef.current(
        new Date(now - PAST_DAYS * 86400000).toISOString(),
        new Date(now + AHEAD_DAYS * 86400000).toISOString(),
      )
      if (list) { setEvents(list); setComplete(!list.truncated); setLoadedAt(Date.now()) }
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !connected || !freshPass) return
    reload()
    const timer = setInterval(reload, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAtRef.current > 5 * 60 * 1000) reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, connected, freshPass, reload])

  // After Schedule it: show the new event right away, before the next read.
  const addLocal = useCallback((ev) => {
    if (!ev) return
    setEvents(list => [...(list || []).filter(e => e.id !== ev.id), ev])
  }, [])
  const removeLocal = useCallback((id) => {
    setEvents(list => (list ? list.filter(e => e.id !== id) : list))
  }, [])

  return { events, complete, loadedAt, reload, addLocal, removeLocal }
}

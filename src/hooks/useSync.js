import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'
import { storage } from '../utils/storage'
import { TABLE_STORAGE_KEY, SINGLETON_KEYS } from '../utils/dataMap'
import {
  pullAllFromCloud, migrateBlobToTables,
  syncTableChange, syncSingleton, purgeRemoteDeviceLocal, pullTables,
  missingColumns, recheckMissingColumns,
} from '../utils/dataEngine'

const LIST_KEYS = Object.values(TABLE_STORAGE_KEY)

export function useSync() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [lastSynced, setLastSynced] = useState(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  // Why changes aren't saving, and columns the database doesn't have yet.
  const [syncError, setSyncError] = useState(null)
  const [schemaGaps, setSchemaGaps] = useState([])
  const [pending, setPending] = useState(0)
  const pullingRef = useRef(false)
  const queueRef = useRef([])
  const flushTimer = useRef(null)
  const flushingRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    setSession(data.session)
    return { success: true }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setInitialLoadDone(false)
  }, [])

  const initialLoad = useCallback(async () => {
    if (!session?.user) return
    pullingRef.current = true
    setSyncStatus('syncing')
    try {
      const found = await pullAllFromCloud(session.user.id)
      if (!found) {
        await migrateBlobToTables(session.user.id)
        await pullAllFromCloud(session.user.id)
      }
      await purgeRemoteDeviceLocal(session.user.id)
      setLastSynced(new Date())
      setSyncStatus('synced')
    } catch (err) {
      console.error('Initial sync failed:', err.message)
      setSyncStatus('error')
    } finally {
      pullingRef.current = false
      setInitialLoadDone(true)
    }
  }, [session])

  useEffect(() => {
    if (session?.user && !initialLoadDone && !pullingRef.current) initialLoad()
  }, [session, initialLoadDone, initialLoad])

  const flush = useCallback(async () => {
    if (!session?.user || queueRef.current.length === 0) return
    const batch = queueRef.current
    queueRef.current = []
    flushingRef.current = true
    setSyncStatus('syncing')
    // One table failing doesn't hold the others. Its later changes wait
    // behind it, in order, so an older copy never lands after a newer one.
    const failedKeys = new Set()
    const retry = []
    let lastErr = null
    for (const change of batch) {
      const { key, next, prev } = change
      if (failedKeys.has(key)) { retry.push(change); continue }
      try {
        if (LIST_KEYS.includes(key)) {
          await syncTableChange(session.user.id, key, next, prev)
        } else if (SINGLETON_KEYS.includes(key)) {
          await syncSingleton(session.user.id, key, next)
        }
      } catch (err) {
        console.error(`Sync push failed for ${key}:`, err.message)
        failedKeys.add(key)
        retry.push(change)
        lastErr = err
      }
    }
    flushingRef.current = false
    setSchemaGaps(missingColumns())
    if (retry.length) {
      queueRef.current = [...retry, ...queueRef.current]
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
      setSyncError(navigator.onLine ? (lastErr?.message || 'Supabase refused a change.') : null)
    } else {
      setLastSynced(new Date())
      setSyncStatus('synced')
      setSyncError(null)
    }
    setPending(queueRef.current.length)
  }, [session])

  // While anything is waiting: retry every minute, check whether a missing
  // column has been added, and warn before the page is closed or reloaded,
  // since unsaved changes live only in this window.
  useEffect(() => {
    if (!session?.user || !initialLoadDone) return
    const tick = async () => {
      if (queueRef.current.length && !flushingRef.current && !flushTimer.current) flush()
      if (missingColumns().length) {
        const restored = await recheckMissingColumns(session.user.id)
        if (restored.length) console.info('Columns now in Supabase:', restored.join(', '))
        setSchemaGaps(missingColumns())
      }
    }
    const t = setInterval(tick, 60 * 1000)
    return () => clearInterval(t)
  }, [session, initialLoadDone, flush])

  useEffect(() => {
    const warn = (e) => {
      if (!queueRef.current.length && !flushTimer.current && !flushingRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  useEffect(() => {
    if (!session?.user || !initialLoadDone) return
    const onChange = (e) => {
      const { key } = e.detail || {}
      if (!key) return
      if (!LIST_KEYS.includes(key) && !SINGLETON_KEYS.includes(key)) return
      queueRef.current.push(e.detail)
      setPending(queueRef.current.length)
      setSyncStatus('syncing')
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(() => { flushTimer.current = null; flush() }, 1200)
    }
    window.addEventListener('sprintHQ:changed', onChange)
    return () => window.removeEventListener('sprintHQ:changed', onChange)
  }, [session, initialLoadDone, flush])

  useEffect(() => {
    const onOnline = () => { if (session?.user && initialLoadDone) flush() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, initialLoadDone, flush])

  // Re-read tables the server changed. Skipped while local changes are still
  // waiting to go up, so a pull never overwrites an edit that hasn't synced.
  const refreshFromCloud = useCallback(async (tables) => {
    if (!session?.user || !initialLoadDone || pullingRef.current) return null
    if (queueRef.current.length > 0 || flushTimer.current || flushingRef.current) return null
    try {
      const out = await pullTables(session.user.id, tables)
      setLastSynced(new Date())
      return out
    } catch (err) {
      console.warn('Refresh failed:', err.message)
      return null
    }
  }, [session, initialLoadDone])

  return {
    session,
    authLoading,
    isAuthed: !!session?.user,
    userEmail: session?.user?.email,
    signIn, signOut,
    syncStatus, lastSynced, initialLoadDone, syncError, schemaGaps, pending,
    queueSync: () => {},
    pushToCloud: flush,
    refreshFromCloud,
  }
}

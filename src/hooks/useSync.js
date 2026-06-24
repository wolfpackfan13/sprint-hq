import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, SYNCED_KEYS } from '../utils/supabase'
import { storage } from '../utils/storage'

// Gathers the whole app dataset from localStorage into one object
function gatherLocalData() {
  const data = {}
  SYNCED_KEYS.forEach(k => { data[k] = storage.get(k, null) })
  return data
}

// Writes a fetched dataset object back into localStorage
function applyDataToLocal(data) {
  if (!data) return
  SYNCED_KEYS.forEach(k => {
    if (data[k] !== undefined && data[k] !== null) storage.set(k, data[k])
  })
}

function hasAnyLocalData() {
  return SYNCED_KEYS.some(k => storage.get(k, null) !== null)
}

export function useSync() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | synced | error | offline
  const [lastSynced, setLastSynced] = useState(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const saveTimer = useRef(null)
  const pullingRef = useRef(false)

  // ── Auth bootstrap ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
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

  // ── Pull from cloud, with first-time migration of local data ──
  const pullFromCloud = useCallback(async () => {
    if (!session?.user) return
    pullingRef.current = true
    setSyncStatus('syncing')
    try {
      const { data: row, error } = await supabase
        .from('app_data')
        .select('data, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error) throw error

      if (row && row.data && Object.keys(row.data).length > 0) {
        // Cloud has data — it's the source of truth on load
        applyDataToLocal(row.data)
        setLastSynced(new Date())
        setSyncStatus('synced')
      } else {
        // No cloud data yet — first time. Migrate whatever's local up to the cloud.
        if (hasAnyLocalData()) {
          await pushToCloud(true)
        } else {
          setSyncStatus('synced')
        }
      }
      setInitialLoadDone(true)
    } catch (err) {
      setSyncStatus('error')
      setInitialLoadDone(true) // let the app run on local data even if cloud fails
    } finally {
      pullingRef.current = false
    }
  }, [session])

  // ── Push to cloud ──
  const pushToCloud = useCallback(async (silent = false) => {
    if (!session?.user) return
    if (!silent) setSyncStatus('syncing')
    try {
      const payload = gatherLocalData()
      const { error } = await supabase
        .from('app_data')
        .upsert({ user_id: session.user.id, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
      setLastSynced(new Date())
      setSyncStatus('synced')
      return { success: true }
    } catch (err) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
      return { error: err.message }
    }
  }, [session])

  // ── On login, pull once ──
  useEffect(() => {
    if (session?.user && !initialLoadDone && !pullingRef.current) {
      pullFromCloud()
    }
  }, [session, initialLoadDone, pullFromCloud])

  // ── Debounced push: call this after any data change ──
  const queueSync = useCallback(() => {
    if (!session?.user || !initialLoadDone) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSyncStatus('syncing')
    saveTimer.current = setTimeout(() => { pushToCloud(true) }, 1500)
  }, [session, initialLoadDone, pushToCloud])

  // ── Re-push when coming back online ──
  useEffect(() => {
    const onOnline = () => { if (session?.user && initialLoadDone) pushToCloud(true) }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, initialLoadDone, pushToCloud])

  return {
    session,
    authLoading,
    isAuthed: !!session?.user,
    userEmail: session?.user?.email,
    signIn,
    signOut,
    syncStatus,
    lastSynced,
    initialLoadDone,
    queueSync,
    pushToCloud,
    pullFromCloud,
  }
}

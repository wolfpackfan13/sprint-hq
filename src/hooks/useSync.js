import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'
import { storage } from '../utils/storage'
import { TABLE_STORAGE_KEY, SINGLETON_KEYS } from '../utils/dataMap'
import {
  pullAllFromCloud, migrateBlobToTables,
  syncTableChange, syncSingleton,
} from '../utils/dataEngine'

const LIST_KEYS = Object.values(TABLE_STORAGE_KEY)

export function useSync() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [lastSynced, setLastSynced] = useState(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const pullingRef = useRef(false)
  const queueRef = useRef([])
  const flushTimer = useRef(null)

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
    setSyncStatus('syncing')
    try {
      for (const change of batch) {
        const { key, next, prev } = change
        if (LIST_KEYS.includes(key)) {
          await syncTableChange(session.user.id, key, next, prev)
        } else if (SINGLETON_KEYS.includes(key)) {
          await syncSingleton(session.user.id, key, next)
        }
      }
      setLastSynced(new Date())
      setSyncStatus('synced')
    } catch (err) {
      console.error('Sync push failed:', err.message)
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
      queueRef.current = [...batch, ...queueRef.current]
    }
  }, [session])

  useEffect(() => {
    if (!session?.user || !initialLoadDone) return
    const onChange = (e) => {
      const { key } = e.detail || {}
      if (!key) return
      if (!LIST_KEYS.includes(key) && !SINGLETON_KEYS.includes(key)) return
      queueRef.current.push(e.detail)
      setSyncStatus('syncing')
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(flush, 1200)
    }
    window.addEventListener('sprintHQ:changed', onChange)
    return () => window.removeEventListener('sprintHQ:changed', onChange)
  }, [session, initialLoadDone, flush])

  useEffect(() => {
    const onOnline = () => { if (session?.user && initialLoadDone) flush() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, initialLoadDone, flush])

  return {
    session,
    authLoading,
    isAuthed: !!session?.user,
    userEmail: session?.user?.email,
    signIn, signOut,
    syncStatus, lastSynced, initialLoadDone,
    queueSync: () => {},
    pushToCloud: flush,
  }
}

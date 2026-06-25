import { supabase } from './supabase'
import { storage } from './storage'
import { FIELD_MAPS, TABLE_STORAGE_KEY, SINGLETON_KEYS, toRow, fromRow } from './dataMap'

const TABLES = Object.keys(TABLE_STORAGE_KEY)

// ── Pull everything from cloud into localStorage ──
// Returns true if any cloud data existed.
export async function pullAllFromCloud(userId) {
  let foundAny = false

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    if (error) throw error
    if (data && data.length > 0) {
      foundAny = true
      const objs = data.map(r => fromRow(table, r))
      storage.setLocalOnly(TABLE_STORAGE_KEY[table], objs)
    } else {
      // keep whatever's local if cloud empty for this table
    }
  }

  // Singletons from app_state
  const { data: stateRows, error: stateErr } = await supabase.from('app_state').select('*').eq('user_id', userId)
  if (stateErr) throw stateErr
  if (stateRows && stateRows.length > 0) {
    foundAny = true
    stateRows.forEach(r => storage.setLocalOnly(r.key, r.value))
  }

  return foundAny
}

// ── One-time migration: old single-blob (app_data) -> new tables ──
export async function migrateBlobToTables(userId) {
  // Read the old blob if it exists
  const { data: blobRow } = await supabase.from('app_data').select('data').eq('user_id', userId).maybeSingle()
  const blob = blobRow?.data
  if (!blob || Object.keys(blob).length === 0) {
    // Nothing in the old blob — fall back to migrating whatever is local
    return migrateLocalToTables(userId)
  }

  // Push each list table
  for (const table of TABLES) {
    const key = TABLE_STORAGE_KEY[table]
    const arr = blob[key]
    if (Array.isArray(arr) && arr.length > 0) {
      const rows = arr.map(o => toRow(table, o, userId))
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }
  }
  // Singletons
  const stateRows = SINGLETON_KEYS
    .filter(k => blob[k] !== undefined && blob[k] !== null)
    .map(k => ({ user_id: userId, key: k, value: blob[k] }))
  if (stateRows.length > 0) {
    const { error } = await supabase.from('app_state').upsert(stateRows, { onConflict: 'user_id,key' })
    if (error) throw error
  }
  return true
}

// Migrate whatever is currently in localStorage up to the tables
export async function migrateLocalToTables(userId) {
  let pushed = false
  for (const table of TABLES) {
    const arr = storage.get(TABLE_STORAGE_KEY[table], null)
    if (Array.isArray(arr) && arr.length > 0) {
      const rows = arr.map(o => toRow(table, o, userId))
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
      if (error) throw error
      pushed = true
    }
  }
  const stateRows = SINGLETON_KEYS
    .map(k => ({ k, v: storage.get(k, null) }))
    .filter(x => x.v !== null && x.v !== undefined)
    .map(x => ({ user_id: userId, key: x.k, value: x.v }))
  if (stateRows.length > 0) {
    const { error } = await supabase.from('app_state').upsert(stateRows, { onConflict: 'user_id,key' })
    if (error) throw error
    pushed = true
  }
  return pushed
}

// ── Diff-based push: compare a table's previous vs next array,
// upsert changed/added rows, delete removed ones ──
export async function syncTableChange(userId, storageKey, nextArray, prevArray) {
  const table = Object.keys(TABLE_STORAGE_KEY).find(t => TABLE_STORAGE_KEY[t] === storageKey)
  if (!table) return

  const next = Array.isArray(nextArray) ? nextArray : []
  const prev = Array.isArray(prevArray) ? prevArray : []

  const nextById = new Map(next.map(o => [o.id, o]))
  const prevById = new Map(prev.map(o => [o.id, o]))

  // Upsert added or changed
  const toUpsert = []
  for (const obj of next) {
    const before = prevById.get(obj.id)
    if (!before || JSON.stringify(before) !== JSON.stringify(obj)) {
      toUpsert.push(toRow(table, obj, userId))
    }
  }
  if (toUpsert.length > 0) {
    const { error } = await supabase.from(table).upsert(toUpsert, { onConflict: 'id' })
    if (error) throw error
  }

  // Delete removed
  const toDelete = []
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) toDelete.push(id)
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', toDelete).eq('user_id', userId)
    if (error) throw error
  }
}

// ── Singleton push ──
export async function syncSingleton(userId, key, value) {
  const { error } = await supabase.from('app_state')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
  if (error) throw error
}

export { TABLES, SINGLETON_KEYS }

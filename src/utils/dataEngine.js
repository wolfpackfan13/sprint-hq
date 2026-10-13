import { supabase } from './supabase'
import { storage } from './storage'
import { FIELD_MAPS, TABLE_STORAGE_KEY, PULL_ONLY_TABLES, SINGLETON_KEYS, DEVICE_LOCAL_FIELDS, toRow, fromRow, stripDeviceLocal, mergeDeviceLocal } from './dataMap'

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

  // Read-only tables. Not having one yet (migration not run) is not an
  // error: the app simply has nothing to show from it.
  for (const table of Object.keys(PULL_ONLY_TABLES)) {
    const objs = await pullReadOnly(userId, table)
    if (objs) storage.setLocalOnly(PULL_ONLY_TABLES[table], objs)
  }

  // Singletons from app_state
  const { data: stateRows, error: stateErr } = await supabase.from('app_state').select('*').eq('user_id', userId)
  if (stateErr) throw stateErr
  if (stateRows && stateRows.length > 0) {
    foundAny = true
    stateRows.forEach(r => {
      const local = storage.get(r.key, null)
      storage.setLocalOnly(r.key, mergeDeviceLocal(r.key, r.value, local))
    })
  }

  return foundAny
}

async function pullReadOnly(userId, table) {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    .order('last_message_at', { ascending: false }).limit(2000)
  if (error) {
    console.warn(`Skipped ${table}: ${error.message}`)
    return null
  }
  return (data || []).map(r => fromRow(table, r))
}

// Re-reads a few tables after the server changed them (the Gmail sync adds
// people and moves last contact dates). Writes to localStorage without a
// sync event and returns { storageKey: objects } for the hooks to adopt.
export async function pullTables(userId, tables) {
  const out = {}
  for (const table of tables) {
    if (PULL_ONLY_TABLES[table]) {
      const objs = await pullReadOnly(userId, table)
      if (objs) { storage.setLocalOnly(PULL_ONLY_TABLES[table], objs); out[PULL_ONLY_TABLES[table]] = objs }
      continue
    }
    const key = TABLE_STORAGE_KEY[table]
    if (!key) continue
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    if (error) throw error
    const objs = (data || []).map(r => fromRow(table, r))
    storage.setLocalOnly(key, objs)
    out[key] = objs
  }
  return out
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
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw error
    }
  }
  // Singletons
  const stateRows = SINGLETON_KEYS
    .filter(k => blob[k] !== undefined && blob[k] !== null)
    .map(k => ({ user_id: userId, key: k, value: stripDeviceLocal(k, blob[k]) }))
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
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw error
      pushed = true
    }
  }
  const stateRows = SINGLETON_KEYS
    .map(k => ({ k, v: storage.get(k, null) }))
    .filter(x => x.v !== null && x.v !== undefined)
    .map(x => ({ user_id: userId, key: x.k, value: stripDeviceLocal(x.k, x.v) }))
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
    const { error } = await supabase.from(table).upsert(toUpsert, { onConflict: 'user_id,id' })
    if (error) {
      // 23505: a row repeats an email or Circleback meeting that is already
      // saved under another id, usually one the Circleback processor added
      // since this device last loaded. Save the other rows one at a time and
      // leave that one on this device; the next full load brings in the
      // saved copy. Re-queueing it would stall every change after it.
      if (error.code !== '23505') throw error
      for (const row of toUpsert) {
        const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: 'user_id,id' })
        if (rowErr && rowErr.code !== '23505') throw rowErr
        if (rowErr) console.warn(`Sync skipped a ${table} row that duplicates one already saved (${row.id}): ${rowErr.message}`)
      }
    }
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
    .upsert({ user_id: userId, key, value: stripDeviceLocal(key, value) }, { onConflict: 'user_id,key' })
  if (error) throw error
}

// One-time cleanup: overwrite any singleton rows that were written before the
// device-local filter existed, so previously synced credentials stop sitting
// in the database. Safe to run on every login.
export async function purgeRemoteDeviceLocal(userId) {
  for (const key of Object.keys(DEVICE_LOCAL_FIELDS)) {
    const local = storage.get(key, null)
    if (!local) continue
    await syncSingleton(userId, key, local)
  }
}

export { TABLES, SINGLETON_KEYS }

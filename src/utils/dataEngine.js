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
// ── Columns the database doesn't have yet ──
// When the app ships ahead of a migration, Supabase refuses any row that
// carries the new column. Rather than refuse the whole save (and hold every
// change behind it), the column is left out from then on and reported, so
// everything else keeps saving and the app can say which migration to run.
const missingCols = {} // table -> Set of column names
const isMissingColumn = (err) => err && (err.code === 'PGRST204' || err.code === '42703')
const columnIn = (err) => {
  const m = /'([a-z0-9_]+)' column|column [a-z0-9_]+\.([a-z0-9_]+)|column "([a-z0-9_]+)"/i.exec(err?.message || '')
  return m ? (m[1] || m[2] || m[3]) : null
}
const withoutMissing = (table, row) => {
  const skip = missingCols[table]
  if (!skip || !skip.size) return row
  const out = { ...row }
  skip.forEach(c => { delete out[c] })
  return out
}
// "contacts.notes_log", one per column the database doesn't have.
export const missingColumns = () => Object.entries(missingCols).flatMap(([t, s]) => [...s].map(c => `${t}.${c}`))

// After a migration runs: find the columns that exist now and send the
// values this device saved without them, so nothing typed in the meantime
// is lost. Only that column is sent (plus the row's keys), so other fields
// changed on the server since are left alone. Returns the columns restored.
export async function recheckMissingColumns(userId) {
  const restored = []
  for (const [table, cols] of Object.entries(missingCols)) {
    for (const col of [...cols]) {
      const { error } = await supabase.from(table).select(`id,${col}`).limit(0)
      if (error) continue
      cols.delete(col)
      restored.push(`${table}.${col}`)
      const appKey = Object.keys(FIELD_MAPS[table]).find(k => FIELD_MAPS[table][k] === col)
      const local = storage.get(TABLE_STORAGE_KEY[table], []) || []
      const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
      const rows = local.filter(o => o?.id && appKey && !empty(o[appKey]))
        .map(o => ({ user_id: userId, id: o.id, [col]: o[appKey] }))
      for (let i = 0; i < rows.length; i += 200) {
        const { error: upErr } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict: 'user_id,id' })
        if (upErr) console.warn(`Couldn't send saved ${table}.${col} values: ${upErr.message}`)
      }
    }
  }
  return restored
}

async function upsertRows(table, rows) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const list = rows.map(r => withoutMissing(table, r))
    const { error } = await supabase.from(table).upsert(list, { onConflict: 'user_id,id' })
    if (!error) return
    const col = isMissingColumn(error) ? columnIn(error) : null
    if (col && !(missingCols[table] && missingCols[table].has(col))) {
      ;(missingCols[table] = missingCols[table] || new Set()).add(col)
      console.warn(`Supabase has no ${table}.${col} column yet; saving ${table} without it until the migration runs.`)
      continue
    }
    // 23505: a row repeats an email or Circleback meeting that is already
    // saved under another id, usually one the Circleback processor added
    // since this device last loaded. Save the other rows one at a time and
    // leave that one on this device; the next full load brings in the
    // saved copy. Re-queueing it would stall every change after it.
    if (error.code !== '23505') throw error
    for (const row of list) {
      const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: 'user_id,id' })
      if (rowErr && rowErr.code !== '23505') throw rowErr
      if (rowErr) console.warn(`Sync skipped a ${table} row that duplicates one already saved (${row.id}): ${rowErr.message}`)
    }
    return
  }
  throw new Error(`Saving ${table} kept failing on missing columns.`)
}

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
  if (toUpsert.length > 0) await upsertRows(table, toUpsert)

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

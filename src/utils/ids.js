// Collision-resistant ID generation.
//
// The old `${prefix}_${Date.now()}` scheme produced identical IDs whenever two
// records were created in the same millisecond. Because `id` is a primary key,
// a collision meant a failed insert rather than a duplicate row. UUIDs remove
// the problem entirely.
//
// Existing records keep their old IDs. This only affects newly created ones.

function randomUUID() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()

  // Fallback for older browsers / non-secure contexts.
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Last resort. Not cryptographically random, but still far wider than a timestamp.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}

// genId('task') -> 'task_9f1c3e2a-...'
export function genId(prefix) {
  const id = randomUUID()
  return prefix ? `${prefix}_${id}` : id
}

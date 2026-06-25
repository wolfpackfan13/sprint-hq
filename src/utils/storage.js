// Local-first storage. Every write emits 'sprintHQ:changed' with the key,
// the new value, and the previous value, so the sync engine can diff and
// push only what changed. setLocalOnly writes without emitting (used when
// applying data pulled from the cloud, to avoid echo loops).

function emitChange(key, next, prev) {
  try {
    window.dispatchEvent(new CustomEvent('sprintHQ:changed', { detail: { key, next, prev } }))
  } catch {
    // ignore (non-browser env)
  }
}

export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(`sprintHQ_${key}`)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  },

  set(key, value) {
    let prev = null
    try {
      const existing = localStorage.getItem(`sprintHQ_${key}`)
      prev = existing ? JSON.parse(existing) : null
    } catch { prev = null }
    try {
      localStorage.setItem(`sprintHQ_${key}`, JSON.stringify(value))
      emitChange(key, value, prev)
      return true
    } catch {
      return false
    }
  },

  // Write without emitting a sync event (used when applying cloud data)
  setLocalOnly(key, value) {
    try {
      localStorage.setItem(`sprintHQ_${key}`, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(`sprintHQ_${key}`)
      emitChange(key, null, null)
      return true
    } catch {
      return false
    }
  },

  clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sprintHQ_'))
        .forEach(k => localStorage.removeItem(k))
      return true
    } catch {
      return false
    }
  }
}

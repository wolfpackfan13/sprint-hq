// Local-first storage. Every write also emits a 'sprintHQ:changed' event
// so the sync layer can push to the cloud (debounced).

function emitChange(key) {
  try {
    window.dispatchEvent(new CustomEvent('sprintHQ:changed', { detail: { key } }))
  } catch {
    // window may not exist in some environments; ignore
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
    try {
      localStorage.setItem(`sprintHQ_${key}`, JSON.stringify(value))
      emitChange(key)
      return true
    } catch {
      return false
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(`sprintHQ_${key}`)
      emitChange(key)
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

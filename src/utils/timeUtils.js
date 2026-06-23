export const timeUtils = {
  // seconds -> "1h 23m" or "45m" or "30s"
  formatDuration(seconds) {
    if (!seconds || seconds < 1) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m`
    return `${s}s`
  },

  // seconds -> "01:23:45" clock format for active timer
  formatClock(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const pad = (n) => String(n).padStart(2, '0')
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
    return `${pad(m)}:${pad(s)}`
  },

  // seconds -> decimal hours, e.g. 5400 -> 1.5
  toHours(seconds) {
    return Math.round((seconds / 3600) * 100) / 100
  },

  // total seconds across timeEntries array
  totalSeconds(timeEntries = []) {
    return timeEntries.reduce((sum, e) => sum + (e.seconds || 0), 0)
  },
}

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

  // An entry can override its client's billable flag and rate. Null means inherit.
  isBillable(entry, company) {
    if (entry && entry.billable !== undefined && entry.billable !== null) return !!entry.billable
    return !!(company && company.billable)
  },

  rateFor(entry, company) {
    if (entry && entry.rate !== undefined && entry.rate !== null && entry.rate !== '') return Number(entry.rate)
    return Number((company && company.hourlyRate) || 0)
  },

  amountFor(entry, company) {
    if (!this.isBillable(entry, company)) return 0
    return this.toHours(entry.seconds || 0) * this.rateFor(entry, company)
  },

  // ── Local date/time helpers (entries store ISO, the ledger edits local) ──
  pad2(n) { return String(n).padStart(2, '0') },

  localDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d)) return ''
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`
  },

  localTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d)) return ''
    return `${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}`
  },

  toISO(dateStr, timeStr) {
    if (!dateStr) return null
    const d = new Date(`${dateStr}T${timeStr || '12:00'}:00`)
    return isNaN(d) ? null : d.toISOString()
  },

  // "1.5" or "1:30" -> 5400 seconds
  parseHours(input) {
    if (input === '' || input === null || input === undefined) return 0
    const raw = String(input).trim()
    if (raw.includes(':')) {
      const [h, m] = raw.split(':')
      return (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60
    }
    const n = parseFloat(raw)
    return isNaN(n) ? 0 : Math.round(n * 3600)
  },
}

export const dateUtils = {
  // Get today as YYYY-MM-DD string
  today() {
    return new Date().toISOString().split('T')[0]
  },

  // Format a date string for display
  format(dateStr, style = 'medium') {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T12:00:00')
    if (style === 'short') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (style === 'long') return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (style === 'weekday') return date.toLocaleDateString('en-US', { weekday: 'short' })
    if (style === 'full') return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  },

  // Is a date string today?
  isToday(dateStr) {
    if (!dateStr) return false
    return dateStr === this.today()
  },

  // Is a date string in the current calendar week (Mon-Sun)?
  isThisWeek(dateStr) {
    if (!dateStr) return false
    const today = new Date()
    const date = new Date(dateStr + 'T12:00:00')
    const startOfWeek = new Date(today)
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day // Mon start
    startOfWeek.setDate(today.getDate() + diff)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    return date >= startOfWeek && date <= endOfWeek
  },

  // Is a task missed (due date past, not done)?
  isMissed(task) {
    if (!task.dueDate || task.status === 'done') return false
    return task.dueDate < this.today()
  },

  // How many days overdue?
  daysOverdue(dateStr) {
    if (!dateStr) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dateStr + 'T12:00:00')
    const diff = today - due
    return Math.max(0, Math.floor(diff / 86400000))
  },

  // Get current sprint week number (1-12) given a start date
  sprintWeek(startDateStr) {
    if (!startDateStr) return 1
    const start = new Date(startDateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysDiff = Math.floor((today - start) / 86400000)
    if (daysDiff < 0) return 1
    return Math.min(12, Math.floor(daysDiff / 7) + 1)
  },

  // Get sprint progress as 0-1
  sprintProgress(startDateStr) {
    if (!startDateStr) return 0
    const start = new Date(startDateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysDiff = Math.floor((today - start) / 86400000)
    if (daysDiff < 0) return 0
    return Math.min(1, daysDiff / 84)
  },

  // Get sprint end date given start
  sprintEndDate(startDateStr) {
    if (!startDateStr) return ''
    const start = new Date(startDateStr + 'T00:00:00')
    start.setDate(start.getDate() + 83)
    return start.toISOString().split('T')[0]
  },

  // Get start date for a given sprint week number
  weekStartDate(sprintStart, weekNum) {
    if (!sprintStart) return ''
    const start = new Date(sprintStart + 'T00:00:00')
    start.setDate(start.getDate() + (weekNum - 1) * 7)
    return start.toISOString().split('T')[0]
  },

  // Get days in current week grouped as array of {date, label}
  thisWeekDays() {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return {
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
      }
    })
  },

  // Get a date X days from today
  addDays(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }
}

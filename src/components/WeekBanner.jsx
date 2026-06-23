import { dateUtils } from '../utils/dateUtils'

export function WeekBanner({ sprint, currentWeek, progress, onEdit }) {
  if (!sprint) return null
  const pct = Math.round(progress * 100)
  const weeksLeft = 12 - currentWeek

  return (
    <div className="bg-white border-b border-surface-300 px-4 py-2.5 flex-shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={onEdit} className="font-display font-semibold text-sm text-navy-800 hover:text-gold-600 transition-colors">
          {sprint.name}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-400">{weeksLeft > 0 ? `${weeksLeft}w left` : 'Final week'}</span>
          <span className="text-xs font-display font-bold text-gold-600">Wk {currentWeek}/12</span>
          <span className="text-xs font-bold text-gold-600">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-glow transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #C47D0E, #F4A825, #F7BC55)' }}
        />
      </div>
    </div>
  )
}

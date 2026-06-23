import { dateUtils } from '../utils/dateUtils'

export function WeekBanner({ sprint, currentWeek, progress, onEdit }) {
  if (!sprint) return null

  const pct = Math.round(progress * 100)
  const weeksLeft = 12 - currentWeek
  const endDate = dateUtils.sprintEndDate(sprint.startDate)

  return (
    <div className="bg-navy-900 border-b border-navy-700 px-4 py-3 flex-shrink-0">
      {/* Top row: sprint name + week indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="font-display font-semibold text-sm text-white hover:text-gold-400 transition-colors"
          >
            {sprint.name}
          </button>
          <span className="text-navy-400 text-xs">·</span>
          <span className="text-xs font-medium text-gold-500 font-display">
            Week {currentWeek} <span className="text-navy-400">of 12</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-400">
            {weeksLeft > 0 ? `${weeksLeft}w left` : 'Final week'}
          </span>
          <span className="text-xs font-bold text-gold-500 font-display">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-glow transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #C47D0E, #F4A825, #F7BC55)',
          }}
        />
      </div>

      {/* Bottom: goal snippet */}
      {sprint.goal && (
        <p className="text-xs text-navy-400 mt-1.5 truncate">
          ◎ {sprint.goal}
        </p>
      )}
    </div>
  )
}

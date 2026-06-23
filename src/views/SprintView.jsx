import { useState } from 'react'
import { Target, Edit3, Check, ChevronRight } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function SprintView({ sprint, currentWeek, progress, tasks, onUpdateWeekGoal, onUpdateGoal, onReset }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(sprint?.goal || '')
  const [editingWeek, setEditingWeek] = useState(null)
  const [weekGoalDraft, setWeekGoalDraft] = useState('')

  const saveGoal = () => {
    onUpdateGoal(goalDraft)
    setEditingGoal(false)
  }

  const startEditWeek = (weekNum) => {
    setEditingWeek(weekNum)
    setWeekGoalDraft(sprint.weeklyGoals?.[weekNum] || '')
  }

  const saveWeekGoal = () => {
    if (editingWeek) {
      onUpdateWeekGoal(editingWeek, weekGoalDraft)
      setEditingWeek(null)
    }
  }

  const getWeekTaskCount = (weekNum) => {
    const weekStart = dateUtils.weekStartDate(sprint.startDate, weekNum)
    const weekEnd = dateUtils.weekStartDate(sprint.startDate, weekNum + 1)
    return tasks.filter(t => t.dueDate >= weekStart && t.dueDate < weekEnd).length
  }

  const getWeekCompletedCount = (weekNum) => {
    const weekStart = dateUtils.weekStartDate(sprint.startDate, weekNum)
    const weekEnd = dateUtils.weekStartDate(sprint.startDate, weekNum + 1)
    return tasks.filter(t =>
      t.dueDate >= weekStart && t.dueDate < weekEnd && t.status === 'done'
    ).length
  }

  const isPastWeek = (weekNum) => weekNum < currentWeek
  const isCurrentWeek = (weekNum) => weekNum === currentWeek
  const isFutureWeek = (weekNum) => weekNum > currentWeek

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-white text-xl">12-Week Sprint</h1>
            <p className="text-navy-400 text-sm mt-0.5">
              {dateUtils.format(sprint.startDate, 'short')} — {dateUtils.format(dateUtils.sprintEndDate(sprint.startDate), 'short')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-gold-500 text-lg">
              Wk {currentWeek}<span className="text-navy-400 text-sm font-normal">/12</span>
            </p>
            <p className="text-xs text-navy-400">{Math.round(progress * 100)}% through</p>
          </div>
        </div>

        {/* 12-week goal */}
        <div className="mt-4 bg-navy-800 border border-navy-700 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Target size={14} className="text-gold-500" />
              <span className="text-xs font-display font-semibold text-gold-500 uppercase tracking-wide">12-Week Goal</span>
            </div>
            <button
              onClick={() => { setEditingGoal(true); setGoalDraft(sprint.goal || '') }}
              className="p-1 text-navy-500 hover:text-white transition-colors flex-shrink-0"
            >
              <Edit3 size={13} />
            </button>
          </div>
          {editingGoal ? (
            <div className="mt-2">
              <textarea
                value={goalDraft}
                onChange={e => setGoalDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.metaKey && saveGoal()}
                rows={2}
                autoFocus
                className="w-full bg-navy-900 border border-gold-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none"
                placeholder="What's the one thing you're driving toward?"
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={saveGoal}
                  className="flex items-center gap-1 text-xs bg-gold-500 text-navy-900 px-3 py-1.5 rounded-lg font-semibold"
                >
                  <Check size={12} /> Save
                </button>
                <button
                  onClick={() => setEditingGoal(false)}
                  className="text-xs text-navy-400 px-3 py-1.5 rounded-lg hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white mt-1.5 leading-relaxed">
              {sprint.goal || <span className="text-navy-600 italic">Click ✏️ to set your 12-week goal</span>}
            </p>
          )}
        </div>
      </div>

      {/* 12-Week Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <p className="text-xs font-medium text-navy-400 uppercase tracking-wide mb-3">Weekly Breakdown</p>
        <div className="space-y-2">
          {Array.from({ length: 12 }, (_, i) => {
            const weekNum = i + 1
            const weekStart = dateUtils.weekStartDate(sprint.startDate, weekNum)
            const taskCount = getWeekTaskCount(weekNum)
            const doneCount = getWeekCompletedCount(weekNum)
            const weekGoal = sprint.weeklyGoals?.[weekNum] || ''
            const isCurrent = isCurrentWeek(weekNum)
            const isPast = isPastWeek(weekNum)
            const isFuture = isFutureWeek(weekNum)

            return (
              <div
                key={weekNum}
                className={`border rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-navy-800 border-gold-700'
                    : isPast
                    ? 'bg-navy-900 border-navy-800'
                    : 'bg-navy-900 border-navy-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Week badge */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold flex-shrink-0 ${
                    isCurrent
                      ? 'bg-gold-500 text-navy-900'
                      : isPast
                      ? 'bg-forest-700 text-forest-300'
                      : 'bg-navy-700 text-navy-500'
                  }`}>
                    {weekNum}
                  </div>

                  {/* Week info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-display font-semibold ${
                        isCurrent ? 'text-gold-400' : isPast ? 'text-navy-300' : 'text-navy-500'
                      }`}>
                        {isCurrent ? '← Current' : `Wk ${weekNum}`}
                      </span>
                      <span className="text-[11px] text-navy-600">
                        {dateUtils.format(weekStart, 'short')}
                      </span>
                    </div>
                    {weekGoal ? (
                      <p className="text-xs text-navy-400 mt-0.5 truncate">{weekGoal}</p>
                    ) : !isFuture ? (
                      <button
                        onClick={() => startEditWeek(weekNum)}
                        className="text-[11px] text-navy-700 hover:text-navy-500 transition-colors mt-0.5"
                      >
                        + Set week goal
                      </button>
                    ) : null}
                  </div>

                  {/* Task count + edit */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {taskCount > 0 && (
                      <span className={`text-[11px] font-medium ${
                        isPast && doneCount < taskCount ? 'text-red-400' : 'text-navy-500'
                      }`}>
                        {doneCount}/{taskCount}
                      </span>
                    )}
                    {(isCurrent || !isFuture) && (
                      <button
                        onClick={() => startEditWeek(weekNum)}
                        className="p-1 text-navy-600 hover:text-gold-500 transition-colors"
                      >
                        <Edit3 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline week goal editor */}
                {editingWeek === weekNum && (
                  <div className="px-4 pb-3 border-t border-navy-700 pt-3">
                    <input
                      type="text"
                      value={weekGoalDraft}
                      onChange={e => setWeekGoalDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveWeekGoal()
                        if (e.key === 'Escape') setEditingWeek(null)
                      }}
                      placeholder={`Week ${weekNum} focus / goal`}
                      autoFocus
                      className="w-full bg-navy-950 border border-gold-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        onClick={saveWeekGoal}
                        className="flex items-center gap-1 text-xs bg-gold-500 text-navy-900 px-2.5 py-1 rounded-lg font-semibold"
                      >
                        <Check size={11} /> Save
                      </button>
                      <button
                        onClick={() => setEditingWeek(null)}
                        className="text-xs text-navy-500 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Danger zone */}
        <div className="mt-8 border-t border-navy-800 pt-4">
          <button
            onClick={() => {
              if (window.confirm('Start a new sprint? Your current tasks will remain but sprint data will reset.')) {
                onReset()
              }
            }}
            className="text-xs text-navy-600 hover:text-red-400 transition-colors"
          >
            Start a new sprint →
          </button>
        </div>
      </div>
    </div>
  )
}

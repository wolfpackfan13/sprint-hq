import { useState } from 'react'
import { Target, Calendar, ChevronRight } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function SprintSetup({ onSave }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(dateUtils.today())
  const [goal, setGoal] = useState('')
  const [step, setStep] = useState(1)

  const endDate = dateUtils.sprintEndDate(startDate)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      startDate,
      goal: goal.trim(),
      weeklyGoals: {},
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-bold text-navy-900 text-2xl">S</span>
          </div>
          <h1 className="font-display font-bold text-white text-2xl">SprintHQ</h1>
          <p className="text-navy-400 text-sm mt-1">Your 12-week personal OS</p>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center">
              <Target size={16} className="text-navy-900" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white text-base">Set Up Your Sprint</h2>
              <p className="text-navy-400 text-xs">12 weeks. One focused push.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Sprint name */}
            <div>
              <label className="block text-xs font-medium text-navy-400 uppercase tracking-wide mb-1.5">
                Sprint Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Q3 2026 · Launch Sprint"
                autoFocus
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-4 py-3 text-white placeholder-navy-600 text-sm font-medium focus:outline-none focus:border-gold-500 transition-colors"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs font-medium text-navy-400 uppercase tracking-wide mb-1.5">
                Start Date
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-navy-900 border border-navy-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold-500 transition-colors"
                />
                {endDate && (
                  <div className="flex items-center gap-1.5 text-xs text-navy-400 flex-shrink-0">
                    <Calendar size={12} />
                    <span>ends {dateUtils.format(endDate, 'short')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 12-week goal */}
            <div>
              <label className="block text-xs font-medium text-navy-400 uppercase tracking-wide mb-1.5">
                12-Week Goal <span className="text-navy-600 normal-case">(optional)</span>
              </label>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="The one thing you're driving toward in 12 weeks..."
                rows={2}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-4 py-3 text-white placeholder-navy-600 text-sm focus:outline-none focus:border-gold-500 transition-colors resize-none"
              />
            </div>

            {/* Week preview */}
            {startDate && (
              <div className="bg-navy-900 rounded-xl p-3 border border-navy-700">
                <p className="text-xs text-navy-400 mb-2 font-medium">Your 12-week window</p>
                <div className="grid grid-cols-12 gap-1">
                  {Array.from({ length: 12 }, (_, i) => {
                    const weekStart = dateUtils.weekStartDate(startDate, i + 1)
                    const isPast = weekStart < dateUtils.today()
                    const isCurrent = i + 1 === dateUtils.sprintWeek(startDate)
                    return (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full ${
                          isCurrent ? 'bg-gold-500' : isPast ? 'bg-forest-600' : 'bg-navy-700'
                        }`}
                        title={`Week ${i + 1}: ${dateUtils.format(weekStart, 'short')}`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-navy-500">Wk 1</span>
                  <span className="text-[10px] text-navy-500">Wk 12</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className={`w-full py-3.5 rounded-xl font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                name.trim()
                  ? 'bg-gold-500 text-navy-900 hover:bg-gold-400 active:scale-95'
                  : 'bg-navy-700 text-navy-500 cursor-not-allowed'
              }`}
            >
              Start Sprint
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-navy-600 mt-4">
          All data stored locally on your device
        </p>
      </div>
    </div>
  )
}

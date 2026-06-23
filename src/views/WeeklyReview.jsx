import { useState } from 'react'
import { RotateCcw, CheckCircle2, TrendingUp, Calendar, ArrowRight, Star } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'

export function WeeklyReview({ tasks, companies, currentWeek, sprint, onEditTask, onAddTask }) {
  const [step, setStep] = useState(0)

  const weekDays = dateUtils.thisWeekDays()
  const weekStart = weekDays[0].date
  const weekEnd = weekDays[6].date

  const weekTasks = tasks.filter(t => t.dueDate >= weekStart && t.dueDate <= weekEnd)
  const completed = weekTasks.filter(t => t.status === 'done')
  const incomplete = weekTasks.filter(t => t.status === 'todo')
  const completionRate = weekTasks.length > 0 ? Math.round((completed.length / weekTasks.length) * 100) : 0

  // 12 Week Year scoring: % of weekly tactics completed
  const score = completionRate
  const scoreColor = score >= 85 ? '#2D7A50' : score >= 70 ? '#F4A825' : '#EF4444'
  const scoreLabel = score >= 85 ? 'On track' : score >= 70 ? 'Acceptable' : 'Off track'

  // Time by client this week
  const timeByClient = companies.map(co => {
    const secs = tasks.filter(t => t.companyId === co.id).reduce((s, t) =>
      s + (t.timeEntries || []).filter(e => { const d = e.end?.split('T')[0]; return d >= weekStart && d <= weekEnd }).reduce((ss, e) => ss + e.seconds, 0), 0)
    return { company: co, secs }
  }).filter(c => c.secs > 0).sort((a, b) => b.secs - a.secs)

  const steps = [
    {
      title: 'Score Your Week',
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <div className="relative inline-flex items-center justify-center mb-3">
              <svg width="120" height="120" className="-rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#F0F2F8" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(score/100) * 327} 327`} />
              </svg>
              <div className="absolute">
                <span className="font-display font-bold text-3xl" style={{ color: scoreColor }}>{score}%</span>
              </div>
            </div>
            <p className="font-display font-bold text-navy-900">{scoreLabel}</p>
            <p className="text-sm text-navy-500 mt-1">{completed.length} of {weekTasks.length} tasks completed</p>
            {sprint && <p className="text-xs text-navy-400 mt-2">Week {currentWeek} of 12</p>}
          </div>
          <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
            <p className="text-xs text-navy-600 leading-relaxed">
              <span className="font-semibold text-gold-700">12 Week Year benchmark:</span> Aim for 85%+ weekly execution.
              It's about completing the tactics you committed to — not perfection.
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'Triage What Slipped',
      icon: RotateCcw,
      content: (
        <div className="space-y-3">
          {incomplete.length === 0 ? (
            <div className="card p-6 text-center">
              <CheckCircle2 size={32} className="text-forest-400 mx-auto mb-2" />
              <p className="font-display font-semibold text-navy-700">Nothing slipped — clean week!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-navy-500">{incomplete.length} task{incomplete.length !== 1 ? 's' : ''} didn't get done. Decide on each:</p>
              {incomplete.map(t => {
                const co = companies.find(c => c.id === t.companyId)
                return (
                  <div key={t.id} className="card p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {co && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${co.color}15`, color: co.color }}>{co.emoji} {co.name}</span>}
                      <span className="text-sm text-navy-700 flex-1">{t.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onEditTask({ ...t, dueDate: dateUtils.addDays(7 - new Date().getDay() + 1) })} className="text-[11px] btn-ghost px-2.5 py-1 flex items-center gap-1"><ArrowRight size={10} /> Next week</button>
                      <button onClick={() => onEditTask({ ...t, dueDate: dateUtils.today() })} className="text-[11px] btn-ghost px-2.5 py-1">Today</button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )
    },
    {
      title: 'Where Your Time Went',
      icon: Calendar,
      content: (
        <div className="space-y-3">
          {timeByClient.length === 0 ? (
            <div className="card p-6 text-center text-navy-400 text-sm">No time tracked this week</div>
          ) : (
            timeByClient.map(tc => {
              const totalSecs = timeByClient.reduce((s, c) => s + c.secs, 0)
              const pct = Math.round((tc.secs / totalSecs) * 100)
              return (
                <div key={tc.company.id} className="card p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-navy-700">{tc.company.emoji} {tc.company.name}</span>
                    <span className="text-xs text-navy-400">{timeUtils.formatDuration(tc.secs)} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tc.company.color }} />
                  </div>
                </div>
              )
            })
          )}
          <p className="text-xs text-navy-400 text-center pt-2">Is this where you wanted your time to go?</p>
        </div>
      )
    },
    {
      title: 'Set Next Week',
      icon: Star,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-navy-500">What are the 3 outcomes that will define next week?</p>
          <div className="space-y-2">
            {[1,2,3].map(n => (
              <button key={n} onClick={() => onAddTask({ dueDate: dateUtils.addDays(7 - new Date().getDay() + 1), isTop3: true, priority: 'high' })}
                className="w-full card p-3 text-left text-sm text-navy-500 hover:border-gold-300 transition-colors flex items-center gap-2">
                <Star size={14} className="text-gold-400" />
                Add priority #{n} for next week
              </button>
            ))}
          </div>
          <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 mt-3">
            <p className="text-sm font-display font-semibold text-forest-700">Review complete 🎉</p>
            <p className="text-xs text-navy-600 mt-1">You scored {score}% this week. Next week's tactics are set. Go execute.</p>
          </div>
        </div>
      )
    }
  ]

  const currentStep = steps[step]
  const Icon = currentStep.icon

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <h1 className="font-display font-bold text-navy-900 text-xl">Weekly Review</h1>
        <p className="text-navy-500 text-sm mt-0.5">{dateUtils.format(weekStart, 'short')} — {dateUtils.format(weekEnd, 'short')}</p>
        {/* Step dots */}
        <div className="flex gap-1.5 mt-3">
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-gold-500' : i < step ? 'w-1.5 bg-forest-400' : 'w-1.5 bg-surface-300'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center"><Icon size={16} className="text-gold-600" /></div>
          <h2 className="font-display font-bold text-navy-800">{currentStep.title}</h2>
          <span className="text-xs text-navy-400 ml-auto">Step {step + 1}/{steps.length}</span>
        </div>
        {currentStep.content}
      </div>

      <div className="px-4 py-3 border-t border-surface-200 flex-shrink-0 flex gap-3">
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="flex-1 btn-ghost py-2.5 text-sm">Back</button>}
        {step < steps.length - 1
          ? <button onClick={() => setStep(s => s + 1)} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5">Next <ArrowRight size={14} /></button>
          : <button onClick={() => setStep(0)} className="flex-1 btn-ghost py-2.5 text-sm">Start over</button>}
      </div>
    </div>
  )
}

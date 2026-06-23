import { useState } from 'react'
import { Target, Calendar, ChevronRight } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function SprintSetup({ onSave }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(dateUtils.today())
  const [goal, setGoal] = useState('')
  const endDate = dateUtils.sprintEndDate(startDate)

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-bold text-navy-900 text-2xl">S</span>
          </div>
          <h1 className="font-display font-bold text-navy-900 text-2xl">SprintHQ</h1>
          <p className="text-navy-500 text-sm mt-1">Your 12-week personal OS</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center">
              <Target size={16} className="text-gold-600" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-navy-900">Set Up Your Sprint</h2>
              <p className="text-navy-400 text-xs">12 weeks. One focused push.</p>
            </div>
          </div>
          <div className="space-y-4">
            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Sprint name (e.g. Q3 2026)" autoFocus className="w-full input-base px-4 py-3 text-sm font-medium"/>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Calendar size={13} className="absolute left-3 top-3 text-navy-400 pointer-events-none"/>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full input-base pl-9 pr-3 py-2.5 text-sm"/>
              </div>
              {endDate && <span className="text-xs text-navy-400 flex-shrink-0">ends {dateUtils.format(endDate,'short')}</span>}
            </div>
            <textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="12-week goal (optional)" rows={2} className="w-full input-base px-4 py-2.5 text-sm resize-none"/>
            {startDate && (
              <div className="bg-surface-100 rounded-xl p-3 border border-surface-300">
                <p className="text-xs text-navy-400 mb-2">Your 12-week window</p>
                <div className="grid grid-cols-12 gap-1">
                  {Array.from({length:12},(_,i)=>{
                    const ws = dateUtils.weekStartDate(startDate,i+1)
                    const isPast = ws < dateUtils.today()
                    const isCurrent = i+1 === dateUtils.sprintWeek(startDate)
                    return <div key={i} className={`h-1.5 rounded-full ${isCurrent?'bg-gold-500':isPast?'bg-forest-400':'bg-surface-300'}`}/>
                  })}
                </div>
              </div>
            )}
            <button onClick={() => name.trim() && onSave({ name:name.trim(), startDate, goal:goal.trim(), weeklyGoals:{}, createdAt:new Date().toISOString() })}
              disabled={!name.trim()} className="w-full py-3.5 btn-primary text-sm flex items-center justify-center gap-2">
              Start Sprint <ChevronRight size={16}/>
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-navy-400 mt-4">All data stored locally on your device</p>
      </div>
    </div>
  )
}

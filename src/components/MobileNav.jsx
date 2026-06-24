import { useState } from 'react'
import { Zap, CalendarDays, FolderKanban, Target, Clipboard, Users, Clock, Sparkles, FileText, Calendar, RotateCcw, MoreHorizontal, X, Archive, CalendarClock, Building2 } from 'lucide-react'

const PRIMARY = [
  { id: 'do',       label: 'Today',    icon: Zap },
  { id: 'week',     label: 'Week',     icon: CalendarDays },
  { id: 'clients',  label: 'Clients',  icon: Building2 },
  { id: 'meetings', label: 'Meetings', icon: Clipboard },
]

const MORE = [
  { id: 'prep', label: 'Prep My Day', icon: CalendarClock },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'goals',         label: 'Goals',         icon: Target },
  { id: 'sprint',        label: '12-Week Sprint',icon: Calendar },
  { id: 'relationships', label: 'Relationships', icon: Users },
  { id: 'hours',         label: 'Hours & Invoices', icon: Clock },
  { id: 'review',        label: 'Weekly Review',  icon: RotateCcw },
  { id: 'archive',       label: 'Completed',      icon: Archive },
  { id: 'briefing',      label: 'AI Briefing',    icon: Sparkles },
  { id: 'notes',         label: 'Notes',          icon: FileText },
]

export function MobileNav({ activeView, setActiveView, missedCount }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const inMore = MORE.some(m => m.id === activeView)

  const pick = (id) => { setActiveView(id); setSheetOpen(false) }

  return (
    <>
      {/* Bottom sheet for "More" */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 bg-navy-900/40 z-50 flex items-end" onClick={() => setSheetOpen(false)}>
          <div className="bg-white rounded-t-2xl w-full p-4 safe-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-navy-900">More</p>
              <button onClick={() => setSheetOpen(false)} className="p-1.5 text-navy-400"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => pick(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${activeView === id ? 'bg-gold-50 border-gold-300 text-gold-700' : 'border-surface-300 text-navy-500'}`}>
                  <Icon size={18} />
                  <span className="text-[10px] font-display font-semibold text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-300 safe-bottom z-40">
        <div className="flex items-stretch h-14">
          {PRIMARY.map(({ id, label, icon: Icon }) => {
            const isActive = activeView === id
            const badge = id === 'do' && missedCount > 0
            return (
              <button key={id} onClick={() => setActiveView(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${isActive ? 'text-gold-600' : 'text-navy-400'}`}>
                <div className="relative">
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                  {badge && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center"><span className="text-white text-[8px] font-bold">{missedCount > 9 ? '!' : missedCount}</span></span>}
                </div>
                <span className="text-[9px] font-display font-semibold">{label}</span>
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gold-500 rounded-full" />}
              </button>
            )
          })}
          <button onClick={() => setSheetOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${inMore ? 'text-gold-600' : 'text-navy-400'}`}>
            <MoreHorizontal size={19} strokeWidth={inMore ? 2.5 : 1.8} />
            <span className="text-[9px] font-display font-semibold">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}

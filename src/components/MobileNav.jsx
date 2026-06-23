import { Calendar, CalendarDays, AlertCircle, FileText, Target } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'week', label: 'Week', icon: CalendarDays },
  { id: 'missed', label: 'Missed', icon: AlertCircle },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'sprint', label: 'Sprint', icon: Target },
]

export function MobileNav({ activeView, setActiveView, missedCount }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-navy-700 safe-bottom z-40">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id
          const hasBadge = id === 'missed' && missedCount > 0

          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${
                isActive ? 'text-gold-500' : 'text-navy-400 active:text-navy-300'
              }`}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">{missedCount > 9 ? '!' : missedCount}</span>
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium font-display ${isActive ? 'text-gold-500' : ''}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gold-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

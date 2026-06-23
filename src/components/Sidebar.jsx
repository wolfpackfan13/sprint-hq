import { CalendarDays, Calendar, AlertCircle, FileText, Target, Settings, CheckSquare } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'week', label: 'This Week', icon: CalendarDays },
  { id: 'missed', label: 'Missed', icon: AlertCircle },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'sprint', label: '12-Week Sprint', icon: Target },
]

export function Sidebar({ activeView, setActiveView, missedCount, completedToday, onSettings }) {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-navy-900 border-r border-navy-700 h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-navy-700">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gold-500 flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-navy-900 text-sm">S</span>
          </div>
          <div>
            <p className="font-display font-bold text-white text-base leading-none">SprintHQ</p>
            <p className="text-navy-400 text-xs mt-0.5">Personal OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id
          const badge = id === 'missed' && missedCount > 0 ? missedCount : null

          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-navy-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1 text-left font-display">{label}</span>
              {badge && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-navy-900 text-gold-500' : 'bg-red-500 text-white'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom stats */}
      <div className="px-5 py-4 border-t border-navy-700">
        <div className="flex items-center gap-2 text-xs text-navy-400 mb-3">
          <CheckSquare size={12} />
          <span>{completedToday} completed today</span>
        </div>
        <button
          onClick={onSettings}
          className="flex items-center gap-2 text-xs text-navy-400 hover:text-white transition-colors"
        >
          <Settings size={12} />
          <span>Sprint Settings</span>
        </button>
      </div>
    </aside>
  )
}

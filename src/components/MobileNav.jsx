import { LayoutDashboard, Calendar, AlertCircle, Clipboard, MoreHorizontal } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Home',     icon: LayoutDashboard },
  { id: 'today',     label: 'Today',    icon: Calendar },
  { id: 'missed',    label: 'Missed',   icon: AlertCircle },
  { id: 'meetings',  label: 'Meetings', icon: Clipboard },
  { id: 'more',      label: 'More',     icon: MoreHorizontal },
]

const MORE_ITEMS = ['week','goals','relationships','briefing','notes','sprint','settings']

export function MobileNav({ activeView, setActiveView, missedCount }) {
  const isMore = MORE_ITEMS.includes(activeView)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-300 safe-bottom z-40">
      <div className="flex items-stretch h-14">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id || (id === 'more' && isMore)
          const hasBadge = id === 'missed' && missedCount > 0
          return (
            <button key={id} onClick={() => setActiveView(id === 'more' ? 'goals' : id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                isActive ? 'text-gold-600' : 'text-navy-400'
              }`}>
              <div className="relative">
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">{missedCount > 9 ? '!' : missedCount}</span>
                  </span>
                )}
              </div>
              <span className="text-[9px] font-display font-semibold">{label}</span>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gold-500 rounded-full" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

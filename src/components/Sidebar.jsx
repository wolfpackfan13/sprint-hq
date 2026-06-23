import { Zap, CalendarDays, FolderKanban, Target, Clipboard, Users, Clock, Sparkles, FileText, Settings, CheckSquare, Calendar, RotateCcw } from 'lucide-react'

const GROUPS = [
  {
    label: 'Do',
    items: [
      { id: 'do',       label: 'Today',     icon: Zap },
    ],
  },
  {
    label: 'Plan',
    items: [
      { id: 'week',     label: 'This Week',  icon: CalendarDays },
      { id: 'projects', label: 'Projects',   icon: FolderKanban },
      { id: 'goals',    label: 'Goals',      icon: Target },
      { id: 'sprint',   label: '12-Wk Sprint', icon: Calendar },
    ],
  },
  {
    label: 'Track',
    items: [
      { id: 'meetings',      label: 'Meetings',     icon: Clipboard },
      { id: 'relationships', label: 'Relationships',icon: Users },
      { id: 'hours',         label: 'Hours & Invoices', icon: Clock },
      { id: 'review',        label: 'Weekly Review',icon: RotateCcw },
    ],
  },
  {
    label: 'Assist',
    items: [
      { id: 'briefing', label: 'AI Briefing', icon: Sparkles },
      { id: 'notes',    label: 'Notes',       icon: FileText },
    ],
  },
]

export function Sidebar({ activeView, setActiveView, missedCount, completedToday, onSettings }) {
  return (
    <aside className="hidden md:flex flex-col w-52 bg-white border-r border-surface-300 h-full flex-shrink-0">
      <div className="px-5 py-4 border-b border-surface-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gold-500 flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-navy-900 text-sm">S</span>
          </div>
          <div>
            <p className="font-display font-bold text-navy-900 text-sm leading-none">SprintHQ</p>
            <p className="text-navy-400 text-[11px] mt-0.5">Personal OS</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-bold text-navy-300 uppercase tracking-widest mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ id, label, icon: Icon }) => {
                const isActive = activeView === id
                const badge = id === 'do' && missedCount > 0 ? missedCount : null
                return (
                  <button key={id} onClick={() => setActiveView(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive ? 'bg-gold-50 text-gold-700 border border-gold-200' : 'text-navy-500 hover:text-navy-800 hover:bg-surface-100 border border-transparent'
                    }`}>
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 text-left font-display">{label}</span>
                    {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{badge}</span>}
                    {id === 'briefing' && <span className="text-[9px] bg-gold-100 text-gold-600 px-1 py-0.5 rounded font-bold">AI</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-surface-200">
        <div className="flex items-center gap-1.5 text-xs text-navy-400 mb-2">
          <CheckSquare size={11} /> <span>{completedToday} done today</span>
        </div>
        <button onClick={onSettings} className="flex items-center gap-1.5 text-xs text-navy-400 hover:text-navy-700 transition-colors">
          <Settings size={11} /> Settings
        </button>
      </div>
    </aside>
  )
}

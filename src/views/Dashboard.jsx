import { Calendar, AlertCircle, Users, Target, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

function StatCard({ icon: Icon, label, value, color, onClick, urgent }) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left flex-1 min-w-0 transition-all hover:shadow-card-hover ${urgent ? 'border-red-200 bg-red-50' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${urgent ? 'bg-red-100' : 'bg-surface-200'}`}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className={`font-display font-bold text-2xl ${urgent ? 'text-red-600' : 'text-navy-900'}`}>{value}</p>
      <p className="text-xs text-navy-500 mt-0.5">{label}</p>
    </button>
  )
}

export function Dashboard({
  tasks, todayTasks, missedTasks, allThisWeekTasks,
  meetings, contacts, goals, vision,
  companies, activeClient,
  completedToday, currentWeek, progress,
  todayEvents, calendarConnected,
  setActiveView, onAddTask,
}) {
  const today = dateUtils.today()
  const todayLabel = dateUtils.format(today, 'full')
  const todoToday = todayTasks.filter(t => t.status === 'todo').length
  const missedCount = missedTasks.filter(t => t.status === 'todo').length
  const pendingActionItems = meetings.flatMap(m =>
    (m.actionItems || []).filter(ai => !ai.done && !ai.taskId)
  ).length

  const todayMeetings = meetings.filter(m => m.date === today)
  const upcoming3Days = tasks.filter(t =>
    t.dueDate > today && t.dueDate <= dateUtils.addDays(3) && t.status === 'todo'
  ).sort((a,b) => a.dueDate > b.dueDate ? 1 : -1).slice(0, 5)

  const recentMeetings = [...meetings].sort((a,b) => b.date > a.date ? 1 : -1).slice(0, 3)

  const getCompany = (id) => companies.find(c => c.id === id)

  const filterByClient = (items, key = 'companyId') =>
    activeClient ? items.filter(i => i[key] === activeClient) : items

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
        {/* Greeting */}
        <div className="mb-5">
          <h1 className="font-display font-bold text-navy-900 text-2xl">Good {getGreeting()}</h1>
          <p className="text-navy-500 text-sm mt-0.5">{todayLabel}</p>
          {currentWeek && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-surface-300 rounded-full">
                <div
                  className="h-full bg-gold-500 rounded-full progress-glow transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className="text-xs font-display font-semibold text-gold-600">
                Week {currentWeek}/12
              </span>
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="flex gap-3 mb-5">
          <StatCard
            icon={Calendar}
            label="Due today"
            value={todoToday}
            color="#F4A825"
            onClick={() => setActiveView('today')}
          />
          <StatCard
            icon={CheckCircle2}
            label="Done today"
            value={completedToday}
            color="#2D7A50"
            onClick={() => setActiveView('today')}
          />
          <StatCard
            icon={AlertCircle}
            label="Missed"
            value={missedCount}
            color="#EF4444"
            onClick={() => setActiveView('missed')}
            urgent={missedCount > 0}
          />
        </div>

        {/* Today's Calendar Events */}
        {calendarConnected && todayEvents.length > 0 && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-display font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar size={12} className="text-blue-500" /> Calendar Today
              </p>
            </div>
            <div className="space-y-2">
              {todayEvents.slice(0, 3).map(ev => (
                <div key={ev.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-sm text-navy-700 flex-1 truncate">{ev.title}</span>
                  {ev.start && !ev.allDay && (
                    <span className="text-xs text-navy-400 flex-shrink-0">
                      {new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Meetings */}
        {todayMeetings.length > 0 && (
          <div className="card p-4 mb-4">
            <p className="text-xs font-display font-semibold text-navy-500 uppercase tracking-wide mb-3">Meetings Today</p>
            {todayMeetings.map(m => {
              const co = getCompany(m.companyId)
              return (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: co?.color || '#9BA5BB' }} />
                  <span className="text-sm text-navy-700 flex-1">{m.title}</span>
                  {m.time && <span className="text-xs text-navy-400">{m.time}</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* Pending Action Items Alert */}
        {pendingActionItems > 0 && (
          <button
            onClick={() => setActiveView('meetings')}
            className="w-full card p-3 mb-4 border-gold-300 bg-gold-50 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p className="text-sm font-display font-medium text-gold-700">
                {pendingActionItems} action item{pendingActionItems !== 1 ? 's' : ''} from meetings need attention
              </p>
            </div>
            <ChevronRight size={16} className="text-gold-600" />
          </button>
        )}

        {/* Upcoming 3 days */}
        {upcoming3Days.length > 0 && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-display font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={12} /> Up Next (3 days)
              </p>
              <button onClick={() => setActiveView('week')} className="text-xs text-gold-600 hover:text-gold-700 font-medium">
                See week →
              </button>
            </div>
            <div className="space-y-2">
              {upcoming3Days.map(t => {
                const co = getCompany(t.companyId)
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-surface-400 flex-shrink-0" />
                    <span className="text-sm text-navy-700 flex-1 truncate">{t.title}</span>
                    {co && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ backgroundColor: `${co.color}15`, color: co.color }}>
                        {co.name}
                      </span>
                    )}
                    <span className="text-xs text-navy-400 flex-shrink-0">{dateUtils.format(t.dueDate, 'short')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Goals + Active */}
        {goals.filter(g => g.status === 'active').length > 0 && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-display font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <Target size={12} className="text-gold-500" /> Active Goals
              </p>
              <button onClick={() => setActiveView('goals')} className="text-xs text-gold-600 font-medium">
                All goals →
              </button>
            </div>
            <div className="space-y-2">
              {goals.filter(g => g.status === 'active').slice(0, 3).map(g => {
                const co = getCompany(g.companyId)
                return (
                  <div key={g.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                    <span className="text-sm text-navy-700 flex-1 truncate">{g.title}</span>
                    {co && (
                      <span className="text-[10px] font-medium flex-shrink-0" style={{ color: co.color }}>
                        {co.name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick add */}
        <button
          onClick={() => onAddTask({ dueDate: today })}
          className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
        >
          + Add Task for Today
        </button>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

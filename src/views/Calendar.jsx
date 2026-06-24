import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Calendar as CalIcon, MapPin, Users, ExternalLink, X, Plus, Clock, Link2 } from 'lucide-react'
import { calUtils, dateUtils } from '../utils/dateUtils'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5) // 5 AM – 10 PM

function eventColor(ev) {
  // Time blocks created by the app get gold; real meetings get blue
  return ev.isTimeBlock ? '#F4A825' : '#3B82F6'
}

// Position an event in the day/week hour grid
function eventStyle(ev, hourHeight = 48) {
  if (ev.allDay) return null
  const start = new Date(ev.start)
  const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 3600000)
  const startH = start.getHours() + start.getMinutes() / 60
  const endH = end.getHours() + end.getMinutes() / 60
  const top = (startH - 5) * hourHeight
  const height = Math.max(22, (endH - startH) * hourHeight)
  return { top: `${top}px`, height: `${height}px` }
}

function EventDetail({ event, companies, projects, onClose, onCreateTask, meetingNote, onSaveNote }) {
  const [note, setNote] = useState(meetingNote || '')
  if (!event) return null
  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: eventColor(event) }} />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-navy-900 leading-tight">{event.title}</h2>
              <p className="text-xs text-navy-500 mt-0.5">
                {event.allDay ? 'All day' : `${calUtils.timeLabel(event.start)} – ${calUtils.timeLabel(event.end)}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700 flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          {event.location && <div className="flex items-center gap-2 text-sm text-navy-600"><MapPin size={13} className="text-navy-400" /> {event.location}</div>}
          {event.attendees?.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-navy-600"><Users size={13} className="text-navy-400 mt-0.5" /> <span className="flex-1">{event.attendees.slice(0, 5).join(', ')}{event.attendees.length > 5 ? ` +${event.attendees.length - 5}` : ''}</span></div>
          )}
          {event.description && <p className="text-sm text-navy-600 leading-relaxed border-t border-surface-200 pt-3">{event.description}</p>}

          {/* Notes for this event (stored in app) */}
          <div className="border-t border-surface-200 pt-3">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">My Notes</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => onSaveNote(event.id, note)} placeholder="Prep notes, agenda, follow-ups..." rows={3} className="w-full input-base px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => onCreateTask(event)} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"><Plus size={14} /> Create prep task</button>
            {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2.5 text-sm flex items-center gap-1"><ExternalLink size={14} /></a>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Calendar({ google, companies, projects, settings, onCreateTask, eventNotes, onSaveEventNote, onOpenSettings }) {
  const [view, setView] = useState('day') // day | week | month
  const [anchor, setAnchor] = useState(dateUtils.today())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const isConnected = google.isConnected()

  const loadRange = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    let start, end
    if (view === 'day') { start = anchor; end = anchor }
    else if (view === 'week') { const wd = calUtils.weekDays(anchor); start = wd[0]; end = wd[6] }
    else { const grid = calUtils.monthGrid(anchor); start = grid[0].date; end = grid[41].date }
    const evs = await google.fetchCalendarRange(start, end)
    setEvents(evs || [])
    setLoading(false)
  }, [view, anchor, isConnected, google])

  useEffect(() => { loadRange() }, [view, anchor, isConnected])

  const navigate = (dir) => {
    if (view === 'day') setAnchor(calUtils.addDays(anchor, dir))
    else if (view === 'week') setAnchor(calUtils.addDays(anchor, dir * 7))
    else { const d = new Date(anchor + 'T12:00:00'); d.setMonth(d.getMonth() + dir); setAnchor(d.toISOString().split('T')[0]) }
  }

  const eventsForDay = (dateStr) => events.filter(ev => {
    const evDate = (ev.start || '').split('T')[0]
    if (ev.allDay) return evDate === dateStr
    return evDate === dateStr
  })

  const headerLabel = view === 'day' ? calUtils.dayLabel(anchor)
    : view === 'week' ? `${dateUtils.format(calUtils.weekDays(anchor)[0], 'short')} – ${dateUtils.format(calUtils.weekDays(anchor)[6], 'short')}`
    : calUtils.monthLabel(anchor)

  const handleCreateTask = (event) => {
    onCreateTask({ title: `Prep: ${event.title}`, dueDate: (event.start || '').split('T')[0] || dateUtils.today(), priority: 'medium', notes: `From calendar: ${event.title}` })
    setSelectedEvent(null)
  }

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="card p-6 max-w-sm text-center">
          <CalIcon size={32} className="text-blue-400 mx-auto mb-3" />
          <p className="font-display font-semibold text-navy-800 mb-1">Connect Google Calendar</p>
          <p className="text-sm text-navy-500 mb-4">View your meetings and time blocks here once Google is connected.</p>
          <button onClick={onOpenSettings} className="btn-primary px-4 py-2 text-sm">Open Settings →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display font-bold text-navy-900 text-xl">Calendar</h1>
          <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
            {['day', 'week', 'month'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-xs font-display font-semibold px-3 py-1.5 rounded-md capitalize transition-all ${view === v ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500'}`}>{v}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 text-navy-500 hover:text-navy-800 rounded-lg hover:bg-surface-100"><ChevronLeft size={18} /></button>
            <button onClick={() => setAnchor(dateUtils.today())} className="text-xs btn-ghost px-3 py-1.5">Today</button>
            <button onClick={() => navigate(1)} className="p-1.5 text-navy-500 hover:text-navy-800 rounded-lg hover:bg-surface-100"><ChevronRight size={18} /></button>
            <span className="font-display font-semibold text-navy-800 text-sm ml-1">{headerLabel}</span>
          </div>
          <button onClick={loadRange} className="p-1.5 text-navy-400 hover:text-gold-600" title="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-5xl mx-auto w-full">
        {view === 'day' && <DayView dateStr={anchor} events={eventsForDay(anchor)} onSelect={setSelectedEvent} />}
        {view === 'week' && <WeekView anchor={anchor} events={events} onSelect={setSelectedEvent} />}
        {view === 'month' && <MonthView anchor={anchor} events={events} onSelectDay={(d) => { setAnchor(d); setView('day') }} />}
      </div>

      {selectedEvent && (
        <EventDetail event={selectedEvent} companies={companies} projects={projects}
          meetingNote={eventNotes?.[selectedEvent.id] || ''} onSaveNote={onSaveEventNote}
          onClose={() => setSelectedEvent(null)} onCreateTask={handleCreateTask} />
      )}
    </div>
  )
}

function DayView({ dateStr, events, onSelect }) {
  const allDay = events.filter(e => e.allDay)
  const timed = events.filter(e => !e.allDay)
  return (
    <div>
      {allDay.length > 0 && (
        <div className="mb-2 space-y-1">
          {allDay.map(ev => (
            <button key={ev.id} onClick={() => onSelect(ev)} className="w-full text-left text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: `${eventColor(ev)}15`, color: eventColor(ev) }}>{ev.title}</button>
          ))}
        </div>
      )}
      <div className="relative" style={{ height: `${HOURS.length * 48}px` }}>
        {HOURS.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: `${i * 48}px`, height: '48px' }}>
            <span className="text-[10px] text-navy-400 w-12 flex-shrink-0 -mt-1.5">{calUtils.hourLabel(h)}</span>
            <div className="flex-1 border-t border-surface-200 h-full" />
          </div>
        ))}
        <div className="absolute left-12 right-0 top-0 bottom-0">
          {timed.map(ev => {
            const st = eventStyle(ev)
            if (!st) return null
            return (
              <button key={ev.id} onClick={() => onSelect(ev)} className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-2" style={{ ...st, backgroundColor: `${eventColor(ev)}18`, borderColor: eventColor(ev) }}>
                <p className="text-xs font-semibold truncate" style={{ color: eventColor(ev) }}>{ev.title}</p>
                <p className="text-[10px] text-navy-400 truncate">{calUtils.timeLabel(ev.start)}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekView({ anchor, events, onSelect }) {
  const days = calUtils.weekDays(anchor)
  const today = dateUtils.today()
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map(d => {
            const isToday = d === today
            return (
              <div key={d} className={`text-center py-1.5 rounded-lg ${isToday ? 'bg-gold-50' : ''}`}>
                <p className={`text-[10px] font-display font-bold uppercase ${isToday ? 'text-gold-600' : 'text-navy-400'}`}>{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</p>
                <p className={`text-sm font-display font-bold ${isToday ? 'text-gold-600' : 'text-navy-700'}`}>{new Date(d + 'T12:00:00').getDate()}</p>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => {
            const dayEvents = events.filter(ev => (ev.start || '').split('T')[0] === d).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
            return (
              <div key={d} className="min-h-[120px] space-y-1">
                {dayEvents.map(ev => (
                  <button key={ev.id} onClick={() => onSelect(ev)} className="w-full text-left rounded-md px-1.5 py-1 border-l-2" style={{ backgroundColor: `${eventColor(ev)}15`, borderColor: eventColor(ev) }}>
                    {!ev.allDay && <p className="text-[9px] text-navy-400">{calUtils.timeLabel(ev.start)}</p>}
                    <p className="text-[10px] font-medium truncate" style={{ color: eventColor(ev) }}>{ev.title}</p>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthView({ anchor, events, onSelectDay }) {
  const grid = calUtils.monthGrid(anchor)
  const today = dateUtils.today()
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const countFor = (d) => events.filter(ev => (ev.start || '').split('T')[0] === d).length
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dows.map(d => <p key={d} className="text-[10px] font-display font-bold text-navy-400 text-center uppercase">{d}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map(cell => {
          const count = countFor(cell.date)
          const isToday = cell.date === today
          return (
            <button key={cell.date} onClick={() => onSelectDay(cell.date)} className={`aspect-square rounded-lg p-1.5 flex flex-col items-center justify-start transition-all ${cell.inMonth ? 'hover:bg-surface-100' : 'opacity-30'} ${isToday ? 'bg-gold-50 ring-1 ring-gold-300' : ''}`}>
              <span className={`text-xs font-display font-semibold ${isToday ? 'text-gold-600' : 'text-navy-700'}`}>{cell.day}</span>
              {count > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-blue-400" />)}
                  {count > 3 && <span className="text-[8px] text-navy-400">+{count - 3}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

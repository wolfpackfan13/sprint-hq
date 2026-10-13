import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronUp, Pencil, Loader2, CalendarDays, Lock } from 'lucide-react'
import { Sheet } from './bits'
import { contactLink, firstNameOf, localDateOf } from '../../utils/relationships'
import { calUtils } from '../../utils/dateUtils'

const DAY_START = 9 * 60   // 9:00
const DAY_END = 17 * 60    // 5:00 PM, last meeting ends by then
const STEP = 30
const LENGTHS = [15, 30, 45, 60]

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
const timeLabel = (mins) => new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dayChip = (day) => {
  const d = new Date(day + 'T12:00:00')
  return { dow: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate() }
}
const isWeekend = (day) => [0, 6].includes(new Date(day + 'T12:00:00').getDay())
const longDay = (day) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

// The next weekdays to offer, starting today if there's still a workday left.
function candidateDays(preferred, count = 6) {
  const now = new Date()
  const today = calUtils.localToday()
  let day = now.getHours() * 60 + now.getMinutes() < DAY_END - 90 ? today : calUtils.addDays(today, 1)
  const out = []
  while (out.length < count) {
    if (!isWeekend(day)) out.push(day)
    day = calUtils.addDays(day, 1)
  }
  if (preferred && preferred >= today && !out.includes(preferred)) out.splice(0, 0, preferred)
  return out.slice(0, count)
}

// Open start times on a day, given that day's events.
function openTimes(day, events, minutes) {
  const busy = (events || [])
    .filter(ev => !ev.allDay && ev.selfStatus !== 'declined' && localDateOf(ev.start) === day)
    .map(ev => {
      const s = new Date(ev.start), e = new Date(ev.end)
      return [s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes() || 24 * 60]
    })
  const now = new Date()
  const earliest = day === calUtils.localToday() ? now.getHours() * 60 + now.getMinutes() + 60 : 0
  const out = []
  for (let t = DAY_START; t + minutes <= DAY_END; t += STEP) {
    if (t < earliest) continue
    if (busy.some(([a, b]) => t < b && t + minutes > a)) continue
    out.push(t)
  }
  return out
}

// Book (or move) a person's next touch on Google Calendar. Opens with a time
// already picked; everything else is behind "Pick a different time".
export function ScheduleSheet({ contact, step, event, google, onDone, onClose }) {
  const first = firstNameOf(contact)
  const rescheduling = !!event
  const eventMinutes = event && event.start?.includes('T') ? Math.round((new Date(event.end) - new Date(event.start)) / 60000) : null
  const [invite, setInvite] = useState(rescheduling ? (event.attendees || []).length > 0 : !!contact.email)
  const [title, setTitle] = useState(() => event?.title || step?.eventTitle
    || (step?.kind === 'schedule' && step?.title && !/^book /i.test(step.title) ? step.title : `Follow-up with ${first}`))
  const [editingTitle, setEditingTitle] = useState(false)
  const [minutes, setMinutes] = useState(eventMinutes && LENGTHS.includes(eventMinutes) ? eventMinutes : (LENGTHS.includes(step?.minutes) ? step.minutes : 30))
  const [meet, setMeet] = useState(rescheduling ? !!event.meetLink : true)
  const [days] = useState(() => candidateDays(step?.day))
  const [day, setDay] = useState(null)
  const [time, setTime] = useState(null)
  const [picking, setPicking] = useState(false)
  const [eventsByDay, setEventsByDay] = useState({})
  const [readFailed, setReadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [needsPermission, setNeedsPermission] = useState(false)
  const started = useRef(false)

  // Read the calendar for the offered days once, then pick the first open
  // slot (10 AM when it's free) from tomorrow on.
  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      // A suggested day can sit weeks past the rest, so read from the
      // earliest offered day to the latest.
      const sorted = [...days].sort()
      const startIso = new Date(sorted[0] + 'T00:00:00').toISOString()
      const endIso = new Date(calUtils.addDays(sorted[sorted.length - 1], 1) + 'T00:00:00').toISOString()
      const list = await google.listEvents(startIso, endIso)
      const others = (list || []).filter(ev => !event || ev.id !== event.id)
      const byDay = {}
      days.forEach(d => { byDay[d] = others.filter(ev => localDateOf(ev.start) === d) })
      setEventsByDay(byDay)
      setReadFailed(!list)
      // Today stays on offer, but the time picked for you starts tomorrow:
      // an invite for an hour from now is rarely what you want.
      const today = calUtils.localToday()
      const autoDays = days.filter(d => d !== today || step?.day === today)
      // Moving: don't offer the time it already has.
      const cur = event?.start?.includes('T') ? new Date(event.start) : null
      const curDay = cur ? localDateOf(event.start) : ''
      const curMins = cur ? cur.getHours() * 60 + cur.getMinutes() : -1
      for (const d of (autoDays.length ? autoDays : days)) {
        const open = openTimes(d, byDay[d], minutes).filter(t => d !== curDay || t !== curMins)
        if (open.length) { setDay(d); setTime(open.includes(600) ? 600 : open[0]); return }
      }
      setDay(days[0]); setTime(DAY_START + 60)
      setPicking(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const times = useMemo(() => (day ? openTimes(day, eventsByDay[day], minutes) : []), [day, eventsByDay, minutes])
  useEffect(() => {
    if (day && time != null && times.length && !times.includes(time)) setTime(times[0])
  }, [times, day, time])

  const pickDay = (d) => {
    setDay(d)
    const open = openTimes(d, eventsByDay[d], minutes)
    setTime(open.includes(600) ? 600 : (open[0] ?? DAY_START + 60))
  }

  const ready = !!day && time != null && !!title.trim()

  const save = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null); setNeedsPermission(false)
    const start = new Date(`${day}T${hhmm(time)}:00`)
    const end = new Date(start.getTime() + minutes * 60000)
    const details = {
      title: title.trim(),
      description: `Next touch with ${contact.name || first}, set from SprintHQ.\n${contactLink(contact.id)}`,
      start: start.toISOString(),
      end: end.toISOString(),
      attendees: invite && contact.email ? [contact.email] : [],
      meet: invite && meet,
    }
    const r = rescheduling
      ? await google.moveEvent(event.id, { start: details.start, end: details.end, title: details.title !== event.title ? details.title : '' })
      : await google.createEvent(details)
    setSaving(false)
    if (!r.ok) {
      setNeedsPermission(!!r.needsPermission)
      setError(r.error || 'Google did not take the event. Try again.')
      return
    }
    if (rescheduling) {
      const moved = r.event || { ...event, title: details.title, start: details.start, end: details.end }
      onDone({ event: moved, rescheduled: true, invited: (moved.attendees || []).length > 0 })
      return
    }
    const ev = r.event || { id: undefined, title: details.title, start: details.start, end: details.end, attendees: details.attendees, description: details.description, organizerSelf: true }
    onDone({ event: ev, rescheduled: false, invited: details.attendees.length > 0 })
  }

  const blockedUpFront = google.calendarWriteMissing && !needsPermission

  return (
    <Sheet
      title={rescheduling ? `Reschedule with ${first}` : `Schedule with ${first}`}
      subtitle={rescheduling ? event.title : null}
      onClose={onClose} labelId="schedule-title"
      footer={
        <div className="space-y-2">
          {(needsPermission || blockedUpFront) ? (
            <button onClick={() => google.allowCalendarWrites()} className="w-full py-3 btn-primary text-sm flex items-center justify-center gap-1.5">
              <Lock size={14} /> Allow SprintHQ to add events
            </button>
          ) : (
            <button onClick={save} disabled={!ready || saving} className="w-full py-3 btn-primary text-sm flex items-center justify-center gap-1.5">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Adding to your calendar</> : rescheduling ? 'Move it' : 'Add to calendar'}
            </button>
          )}
          <p className="text-xs text-navy-600 text-center">
            {(needsPermission || blockedUpFront)
              ? 'Google asks once. Tick the box for calendar events, then tap Add to calendar again.'
              : rescheduling
                ? ((event.attendees || []).length ? 'Everyone on the invite gets the new time.' : 'Only your calendar changes.')
                : invite && contact.email ? `Invite goes to ${contact.email}` : 'A reminder on your calendar only. Nobody is invited.'}
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-[14px] border-[1.5px] border-gold-500 bg-gold-50 p-3.5 flex gap-3 items-start">
          {day ? (
            <div className="w-12 h-[54px] flex-shrink-0 rounded-[10px] border border-[#FBE3B4] bg-white flex flex-col items-center justify-center" aria-hidden="true">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#8A5500]">{dayChip(day).dow}</span>
              <span className="font-display text-xl font-bold text-navy-900 leading-none mt-0.5">{dayChip(day).num}</span>
            </div>
          ) : (
            <div className="w-12 h-[54px] flex-shrink-0 rounded-[10px] bg-white flex items-center justify-center"><Loader2 size={18} className="animate-spin text-[#A86800]" /></div>
          )}
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <>
                <label htmlFor="sched-title-input" className="sr-only">Event title</label>
                <input id="sched-title-input" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setEditingTitle(false)} autoFocus
                  className="w-full input-base px-2.5 py-1.5 text-[15px] font-semibold bg-white" />
              </>
            ) : (
              <p className="text-[15px] font-semibold text-navy-900">{title}</p>
            )}
            <p className="text-[13px] text-navy-700 mt-0.5">
              {day && time != null ? `${longDay(day)} · ${timeLabel(time)} to ${timeLabel(time + minutes)}` : 'Finding an open time…'}
            </p>
            <p className="text-xs text-navy-600 mt-0.5">
              {readFailed ? "Couldn't read your calendar, so check this time is free." : 'Open on your calendar'}{!rescheduling && invite && meet ? ' · Google Meet added' : ''}
            </p>
          </div>
          {!editingTitle && (
            <button onClick={() => setEditingTitle(true)} aria-label="Edit title" className="w-9 h-9 -mt-1.5 -mr-1.5 flex items-center justify-center text-navy-600 rounded-lg hover:bg-white"><Pencil size={15} /></button>
          )}
        </div>

        {!rescheduling && <div className="flex items-center gap-3 min-h-[52px]">
          <div className="flex-1 min-w-0">
            <p id="sched-invite" className="text-sm font-semibold text-navy-900">Invite {first}</p>
            <p className="text-xs text-navy-600 mt-0.5">{contact.email ? 'Turn off to put a reminder on your calendar only' : `No email saved for ${first}, so this is a reminder for you`}</p>
          </div>
          <button role="switch" aria-checked={invite} aria-labelledby="sched-invite" disabled={!contact.email}
            onClick={() => setInvite(v => !v)}
            className={`w-12 h-7 p-[3px] rounded-full flex transition-colors disabled:opacity-50 ${invite ? 'bg-forest-600 justify-end' : 'bg-surface-400 justify-start'}`}>
            <span className="w-[22px] h-[22px] rounded-full bg-white shadow" />
          </button>
        </div>}

        <button onClick={() => setPicking(p => !p)} aria-expanded={picking}
          className="w-full flex items-center justify-between min-h-[44px] border-t border-surface-200 text-sm font-medium text-navy-800">
          Pick a different time {picking ? <ChevronUp size={16} className="text-navy-500" /> : <ChevronDown size={16} className="text-navy-500" />}
        </button>

        {picking && (
          <div className="space-y-4 pb-1">
            <div>
              <p id="sched-day" className="text-xs font-semibold text-navy-600 mb-1.5">Day</p>
              <div role="group" aria-labelledby="sched-day" className="grid grid-cols-6 gap-1.5">
                {days.map(d => {
                  const chip = dayChip(d)
                  return (
                    <button key={d} aria-pressed={day === d} onClick={() => pickDay(d)}
                      className={`min-h-[52px] rounded-[10px] border flex flex-col items-center justify-center ${day === d ? 'border-gold-500 bg-gold-50 text-[#8A5500]' : 'border-surface-300 bg-white text-navy-800'}`}>
                      <span className="text-[11px]">{chip.dow}</span>
                      <span className="font-display font-semibold">{chip.num}</span>
                    </button>
                  )
                })}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[13px] text-navy-700">
                <CalendarDays size={14} className="text-navy-500" /> Another day
                <input type="date" min={calUtils.localToday()} onChange={async e => {
                  const d = e.target.value
                  if (!d) return
                  if (!eventsByDay[d]) {
                    const list = await google.listEvents(new Date(d + 'T00:00:00').toISOString(), new Date(calUtils.addDays(d, 1) + 'T00:00:00').toISOString())
                    setEventsByDay(m => ({ ...m, [d]: (list || []).filter(ev => !event || ev.id !== event.id) }))
                  }
                  pickDay(d)
                }} className="input-base px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <p id="sched-time" className="text-xs font-semibold text-navy-600">{day ? `Open on ${longDay(day)}` : 'Open times'}</p>
                <p className="text-xs text-navy-500">From your calendar</p>
              </div>
              {times.length === 0 ? (
                <p className="text-sm text-navy-600">Nothing open between 9 and 5 that day. Try another day.</p>
              ) : (
                <div role="group" aria-labelledby="sched-time" className="grid grid-cols-4 gap-1.5 text-[13px] font-semibold">
                  {times.slice(0, 16).map(t => (
                    <button key={t} aria-pressed={time === t} onClick={() => setTime(t)}
                      className={`min-h-[44px] rounded-[10px] border ${time === t ? 'border-gold-500 bg-gold-50 text-[#8A5500]' : 'border-surface-300 bg-white text-navy-700'}`}>{timeLabel(t)}</button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p id="sched-len" className="text-xs font-semibold text-navy-600 mb-1.5">Length</p>
              <div role="group" aria-labelledby="sched-len" className="flex p-[3px] gap-[3px] rounded-[10px] bg-surface-200 text-[13px] font-semibold">
                {LENGTHS.map(l => (
                  <button key={l} aria-pressed={minutes === l} onClick={() => setMinutes(l)}
                    className={`flex-1 min-h-[38px] rounded-lg ${minutes === l ? 'bg-white shadow-card text-navy-900' : 'text-navy-600'}`}>{l === 60 ? '1 hr' : `${l} min`}</button>
                ))}
              </div>
            </div>
            {invite && !rescheduling && (
              <label className="flex items-center gap-2.5 min-h-[40px] text-sm font-medium text-navy-800">
                <input type="checkbox" checked={meet} onChange={e => setMeet(e.target.checked)} className="w-[18px] h-[18px] accent-[#A86800]" /> Add a Google Meet link
              </label>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </Sheet>
  )
}

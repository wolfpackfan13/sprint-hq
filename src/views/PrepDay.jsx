import { useState } from 'react'
import { CalendarClock, Sparkles, RefreshCw, Check, Plus, AlertCircle, Link2, ChevronDown } from 'lucide-react'
import { matchCalendarToTasks } from '../utils/calendarMatch'
import { calUtils } from '../utils/dateUtils'
import { genId } from '../utils/ids'
import { contactsOnInvite, lastTimeLines, contactLink } from '../utils/relationships'
import { GoogleStatus } from './Calendar'

// At most this many people per meeting get a "Last time" line, so a big
// invite doesn't bury the prep task under notes.
const MAX_PEOPLE_PER_TASK = 3

// "10:00 AM", or "All day".
function timeLabel(event) {
  if (!event?.start) return ''
  if (event.allDay) return 'All day'
  return new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function PrepDay({ companies, projects, google, settings, onCreateTasks, onOpenSettings, contacts = [], meetings = [], userEmail, demoMode = false, onOpenContact }) {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ran, setRan] = useState(false)
  const [created, setCreated] = useState(false)
  // The one card whose client / project picker is open, by index.
  const [pickerOpen, setPickerOpen] = useState(null)

  const hasKey = !!settings.anthropicKey
  const isConnected = google.isConnected()

  const today = calUtils.localToday()
  const tomorrow = calUtils.addDays(today, 1)

  const run = async () => {
    setLoading(true); setError(null); setCreated(false); setPickerOpen(null)
    try {
      // The rest of today and all of tomorrow, nothing further out.
      const all = await google.fetchCalendarRange(today, tomorrow)
      // null: Google needs a refresh or returned an error; the banner says which
      if (all === null) { setLoading(false); return }
      const now = Date.now()
      const events = all.filter(e => e.allDay || !e.end || new Date(e.end).getTime() > now)
      if (events.length === 0) {
        setProposals([]); setRan(true); setLoading(false); return
      }
      const matched = await matchCalendarToTasks({ events, companies, projects, apiKey: settings.anthropicKey })
      matched.sort((a, b) => new Date(a.event?.start || 0) - new Date(b.event?.start || 0))
      setProposals(matched)
      setRan(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleAccept = (i) => setProposals(prev => prev.map((p, idx) => idx === i ? { ...p, accepted: !p.accepted } : p))
  const setCompany = (i, companyId) => setProposals(prev => prev.map((p, idx) => idx === i ? { ...p, companyId, projectId: null } : p))
  const setProject = (i, projectId) => setProposals(prev => prev.map((p, idx) => idx === i ? { ...p, projectId } : p))
  const editTitle = (i, taskTitle) => setProposals(prev => prev.map((p, idx) => idx === i ? { ...p, taskTitle } : p))

  const acceptedCount = proposals.filter(p => p.accepted).length

  // People on the invite who are already in Relationships.
  const peopleFor = (p) => contactsOnInvite(p.event?.attendees || [], contacts, { selfEmail: userEmail, demoMode })
    .slice(0, MAX_PEOPLE_PER_TASK)

  // Anything dated before today (a multi-day event that started earlier)
  // is due today.
  const dueFor = (p) => (!p.dueDate || p.dueDate < today) ? today : p.dueDate

  const createAccepted = () => {
    const toCreate = proposals.filter(p => p.accepted).map(p => {
      const people = peopleFor(p)
      return {
        title: p.taskTitle,
        companyId: p.companyId || null,
        projectId: p.projectId || null,
        dueDate: dueFor(p),
        priority: 'medium',
        // The full "Last time with ..." lines live on the task, where they
        // are read before the meeting. The review screen only names people.
        notes: [
          p.event?.title ? `Prep for calendar event: ${p.event.title}` : '',
          ...lastTimeLines(people, meetings, { demoMode }),
        ].filter(Boolean).join('\n'),
        resources: people.map(c => ({
          id: genId('res'),
          label: `${c.name || c.email} in Relationships`,
          url: contactLink(c.id),
        })),
      }
    })
    onCreateTasks(toCreate)
    setProposals([])
    setPickerOpen(null)
    setCreated(true)
    setRan(false)
  }

  const getCompany = (id) => companies.find(c => c.id === id)
  const getProject = (id) => projects.find(p => p.id === id)

  const groups = [
    { label: 'Today', items: proposals.map((p, i) => ({ p, i })).filter(({ p }) => dueFor(p) <= today) },
    { label: 'Tomorrow', items: proposals.map((p, i) => ({ p, i })).filter(({ p }) => dueFor(p) > today) },
  ].filter(g => g.items.length > 0)

  const renderCard = ({ p, i }) => {
    const co = getCompany(p.companyId)
    const pr = p.projectId ? getProject(p.projectId) : null
    const coProjects = projects.filter(x => x.companyId === p.companyId && x.status === 'active')
    const people = peopleFor(p)
    const open = pickerOpen === i
    return (
      <div key={i} className={`card px-3 py-2.5 transition-all ${p.accepted ? '' : 'opacity-50'}`}>
        <div className="flex items-start gap-3">
          <button onClick={() => toggleAccept(i)} aria-label={p.accepted ? 'Skip this one' : 'Include this one'}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${p.accepted ? 'bg-gold-500 border-gold-500' : 'border-surface-400'}`}>
            {p.accepted && <Check size={11} className="text-white" strokeWidth={3} />}
          </button>
          <div className="flex-1 min-w-0">
            <input value={p.taskTitle} onChange={e => editTitle(i, e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-navy-900 focus:outline-none border-b border-transparent focus:border-surface-300 pb-0.5" />
            <div className="flex items-center gap-1.5 mt-1 text-xs text-navy-400 min-w-0">
              <span className="flex-shrink-0" title={p.event?.title}>{timeLabel(p.event)}</span>
              <span aria-hidden="true" className="flex-shrink-0">·</span>
              <button type="button" onClick={() => setPickerOpen(open ? null : i)}
                className="inline-flex items-center gap-0.5 min-w-0 hover:text-navy-700"
                style={co ? { color: co.color } : undefined}>
                <span className="truncate">{co ? `${co.emoji ? co.emoji + ' ' : ''}${co.name}${pr ? ` / ${pr.name}` : ''}` : 'Add client'}</span>
                <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {people.length > 0 && (
              <p className="text-xs text-navy-400 mt-0.5 truncate">
                With{' '}
                {people.map((c, k) => (
                  <span key={c.id}>
                    {k > 0 && ', '}
                    <button type="button" onClick={() => onOpenContact?.(c.id)} className="text-navy-600 hover:underline">
                      {c.name || c.email}
                    </button>
                  </span>
                ))}
              </p>
            )}

            {/* Client + project picker, only for the card being changed */}
            {open && (
              <div className="mt-2 pt-2 border-t border-surface-200">
                <div className="flex flex-wrap gap-1.5">
                  {companies.map(c => (
                    <button key={c.id} onClick={() => setCompany(i, p.companyId === c.id ? null : c.id)}
                      className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full border transition-all"
                      style={p.companyId === c.id ? { backgroundColor: c.color, borderColor: c.color, color: '#fff' } : { backgroundColor: `${c.color}12`, borderColor: `${c.color}30`, color: c.color }}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
                {coProjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {coProjects.map(x => (
                      <button key={x.id} onClick={() => setProject(i, p.projectId === x.id ? null : x.id)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all ${p.projectId === x.id ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500'}`}>
                        {x.name}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setPickerOpen(null)} className="text-xs text-navy-500 hover:text-navy-800 mt-2">Done</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl flex items-center gap-2">
              <CalendarClock size={20} className="text-gold-500" /> Prep My Day
            </h1>
            <p className="text-navy-500 text-sm mt-0.5">Prep tasks for today and tomorrow</p>
          </div>
          {isConnected && hasKey && (
            <button onClick={run} disabled={loading} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Scanning...' : 'Scan Calendar'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-2xl mx-auto w-full">
        {/* Gates */}
        {isConnected && <GoogleStatus google={google} />}
        {!isConnected && (
          <div className="card p-5 border-blue-200 bg-blue-50 mb-3">
            <div className="flex items-start gap-3">
              <Link2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-navy-900 text-sm mb-1">Connect Google Calendar first</p>
                <p className="text-sm text-navy-600 mb-3">This reads your upcoming events to suggest prep tasks. Connect Google in Settings.</p>
                <button onClick={onOpenSettings} className="btn-primary px-4 py-2 text-sm">Open Settings →</button>
              </div>
            </div>
          </div>
        )}
        {isConnected && !hasKey && (
          <div className="card p-5 border-gold-200 bg-gold-50 mb-3">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-gold-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-navy-900 text-sm mb-1">Add your Anthropic key</p>
                <p className="text-sm text-navy-600 mb-3">The AI matches each meeting to the right client and project. Add your key in Settings.</p>
                <button onClick={onOpenSettings} className="btn-primary px-4 py-2 text-sm">Open Settings →</button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card p-4 border-red-200 bg-red-50 mb-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading && (
          <div className="card p-8 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full border-2 border-gold-300 border-t-gold-600 animate-spin mb-4" />
            <p className="font-display font-semibold text-navy-700">Reading your calendar...</p>
          </div>
        )}

        {created && (
          <div className="card p-4 border-forest-200 bg-forest-50 mb-3 flex items-center gap-2">
            <Check size={16} className="text-forest-600" />
            <p className="text-sm text-forest-700 font-medium">Prep tasks created. Check your Today view.</p>
          </div>
        )}

        {/* Proposals, by day */}
        {!loading && proposals.length > 0 && (
          <>
            {groups.map(g => (
              <div key={g.label} className="mb-3">
                <p className="text-[11px] font-display font-semibold uppercase tracking-wide text-navy-400 mb-1.5">{g.label}</p>
                <div className="space-y-1.5">
                  {g.items.map(renderCard)}
                </div>
              </div>
            ))}
            <button onClick={createAccepted} disabled={acceptedCount === 0} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 mt-1">
              <Plus size={15} /> Create {acceptedCount} prep task{acceptedCount !== 1 ? 's' : ''}
            </button>
          </>
        )}

        {/* Empty after scan */}
        {!loading && ran && proposals.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CalendarClock size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">No prep needed</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">Nothing on today or tomorrow needs a prep task</p>
          </div>
        )}

        {/* Initial */}
        {!loading && !ran && isConnected && hasKey && (
          <div className="flex flex-col items-center justify-center h-56 text-center">
            <CalendarClock size={32} className="text-gold-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Ready to prep your day</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">Scan your calendar to see which meetings could use a prep task. You choose which ones to keep.</p>
          </div>
        )}
      </div>
    </div>
  )
}

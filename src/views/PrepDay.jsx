import { useState } from 'react'
import { CalendarClock, Sparkles, RefreshCw, Check, Plus, AlertCircle, Link2 } from 'lucide-react'
import { matchCalendarToTasks } from '../utils/calendarMatch'
import { dateUtils } from '../utils/dateUtils'

export function PrepDay({ companies, projects, google, settings, onCreateTasks, onOpenSettings }) {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ran, setRan] = useState(false)
  const [created, setCreated] = useState(false)

  const hasKey = !!settings.anthropicKey
  const isConnected = google.isConnected()

  const run = async () => {
    setLoading(true); setError(null); setCreated(false)
    try {
      const events = await google.fetchCalendarEvents(2) // today + tomorrow
      if (!events || events.length === 0) {
        setProposals([]); setRan(true); setLoading(false); return
      }
      const matched = await matchCalendarToTasks({ events, companies, projects, apiKey: settings.anthropicKey })
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

  const createAccepted = () => {
    const toCreate = proposals.filter(p => p.accepted).map(p => ({
      title: p.taskTitle,
      companyId: p.companyId || null,
      projectId: p.projectId || null,
      dueDate: p.dueDate || dateUtils.today(),
      priority: 'medium',
      notes: p.event?.title ? `Prep for calendar event: ${p.event.title}` : '',
    }))
    onCreateTasks(toCreate)
    setProposals([])
    setCreated(true)
    setRan(false)
  }

  const getCompany = (id) => companies.find(c => c.id === id)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl flex items-center gap-2">
              <CalendarClock size={20} className="text-gold-500" /> Prep My Day
            </h1>
            <p className="text-navy-500 text-sm mt-0.5">Turn calendar meetings into prep tasks</p>
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
            <p className="text-navy-400 text-sm mt-1">Matching meetings to your projects</p>
          </div>
        )}

        {created && (
          <div className="card p-4 border-forest-200 bg-forest-50 mb-3 flex items-center gap-2">
            <Check size={16} className="text-forest-600" />
            <p className="text-sm text-forest-700 font-medium">Prep tasks created and filed. Check your Today view.</p>
          </div>
        )}

        {/* Proposals */}
        {!loading && proposals.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-navy-500">{proposals.length} prep task{proposals.length !== 1 ? 's' : ''} suggested · uncheck any you don't want</p>
            </div>
            <div className="space-y-2 mb-4">
              {proposals.map((p, i) => {
                const co = getCompany(p.companyId)
                const coProjects = projects.filter(pr => pr.companyId === p.companyId && pr.status === 'active')
                return (
                  <div key={i} className={`card p-3 transition-all ${p.accepted ? '' : 'opacity-50'}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleAccept(i)} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${p.accepted ? 'bg-gold-500 border-gold-500' : 'border-surface-400'}`}>
                        {p.accepted && <Check size={11} className="text-white" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <input value={p.taskTitle} onChange={e => editTitle(i, e.target.value)}
                          className="w-full bg-transparent text-sm font-medium text-navy-900 focus:outline-none border-b border-transparent focus:border-surface-300 pb-0.5" />
                        <p className="text-[11px] text-navy-400 mt-0.5">📅 {p.event?.title} · {p.reason}</p>
                        {/* Client + project selectors */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
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
                            {coProjects.map(pr => (
                              <button key={pr.id} onClick={() => setProject(i, p.projectId === pr.id ? null : pr.id)}
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all ${p.projectId === pr.id ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500'}`}>
                                {pr.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={createAccepted} disabled={acceptedCount === 0} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2">
              <Plus size={15} /> Create {acceptedCount} prep task{acceptedCount !== 1 ? 's' : ''}
            </button>
          </>
        )}

        {/* Empty after scan */}
        {!loading && ran && proposals.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CalendarClock size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">No prep needed</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">No prep-worthy meetings found in the next 2 days</p>
          </div>
        )}

        {/* Initial */}
        {!loading && !ran && isConnected && hasKey && (
          <div className="flex flex-col items-center justify-center h-56 text-center">
            <CalendarClock size={32} className="text-gold-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Ready to prep your day</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">Scan your calendar and I'll suggest prep tasks, matched to the right client and project for your review</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Play, Square, Timer as TimerIcon, X, Check, Clock, Pencil } from 'lucide-react'
import { timeUtils } from '../utils/timeUtils'

// Format a timestamp (ms) to "HH:MM" for a time input
function toTimeInput(ms) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
// Apply an "HH:MM" string to today's date, return ms
function timeInputToMs(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function AssignPicker({ companies, projects, tasks, value, onChange }) {
  const clientProjects = projects.filter(p => p.companyId === value.companyId && p.status === 'active')
  const pickTasks = tasks.filter(t => t.status === 'todo'
    && (!value.companyId || t.companyId === value.companyId)
    && (!value.projectId || t.projectId === value.projectId))

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Client / Area</p>
        <div className="flex flex-wrap gap-1.5">
          {companies.map(c => (
            <button key={c.id} onClick={() => onChange({ companyId: value.companyId === c.id ? null : c.id, projectId: null, taskId: null })}
              className="text-[11px] font-display font-semibold px-2.5 py-1 rounded-full border transition-all"
              style={value.companyId === c.id ? { backgroundColor: c.color, borderColor: c.color, color: '#fff' } : { backgroundColor: `${c.color}12`, borderColor: `${c.color}30`, color: c.color }}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>
      {value.companyId && clientProjects.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Project</p>
          <div className="flex flex-wrap gap-1.5">
            {clientProjects.map(p => (
              <button key={p.id} onClick={() => onChange({ ...value, projectId: value.projectId === p.id ? null : p.id, taskId: null })}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${value.projectId === p.id ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {value.companyId && pickTasks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Task (optional)</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {pickTasks.slice(0, 20).map(t => (
              <button key={t.id} onClick={() => onChange({ companyId: t.companyId, projectId: t.projectId, taskId: value.taskId === t.id ? null : t.id })}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm border transition-all ${value.taskId === t.id ? 'border-gold-400 bg-gold-50' : 'border-surface-200 hover:border-surface-300'}`}>
                {value.taskId === t.id && <Check size={12} className="text-gold-600 flex-shrink-0" />}
                <span className="flex-1 truncate text-navy-700">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function GlobalTimer({ timer, tasks, companies, projects, onLogSession, onLogManual }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('live') // live | past (when not running)
  const [assign, setAssign] = useState({ companyId: null, projectId: null, taskId: null })
  const [title, setTitle] = useState('')
  const [editingStart, setEditingStart] = useState(false)
  const [startInput, setStartInput] = useState('')
  // past-time fields
  const [pastStart, setPastStart] = useState('09:00')
  const [pastEnd, setPastEnd] = useState('10:00')

  const openPanel = () => {
    if (timer.running) {
      setAssign(timer.assignment)
      setStartInput(toTimeInput(timer.startMs))
    } else {
      setAssign({ companyId: null, projectId: null, taskId: null })
      setTitle('')
      setMode('live')
    }
    setEditingStart(false)
    setOpen(true)
  }

  const startNow = () => {
    timer.start(assign)
    setOpen(false)
  }

  const stopAndLog = () => {
    const session = timer.stop()
    if (session && session.seconds > 0) {
      onLogSession({ ...session, companyId: assign.companyId, projectId: assign.projectId, taskId: assign.taskId, title })
    }
    setOpen(false)
  }

  // While running: change assignment live
  const updateAssign = (next) => {
    setAssign(next)
    timer.assign(next)
  }

  // While running: edit the start time without stopping
  const applyStartEdit = () => {
    if (startInput) timer.setStartTime(timeInputToMs(startInput))
    setEditingStart(false)
  }

  const logPast = () => {
    let startMs = timeInputToMs(pastStart)
    let endMs = timeInputToMs(pastEnd)
    if (endMs <= startMs) endMs += 24 * 3600 * 1000 // crosses midnight guard (rare)
    const seconds = Math.floor((endMs - startMs) / 1000)
    if (seconds < 1) return
    onLogManual({ ...assign, seconds, title, startISO: new Date(startMs).toISOString() })
    setOpen(false)
  }

  const pastSeconds = (() => {
    let s = timeInputToMs(pastStart), e = timeInputToMs(pastEnd)
    if (e <= s) e += 24 * 3600 * 1000
    return Math.floor((e - s) / 1000)
  })()

  return (
    <>
      {/* Top bar trigger */}
      {timer.running ? (
        <button onClick={openPanel} className="flex items-center gap-1.5 bg-gold-100 text-gold-700 px-2.5 py-1.5 rounded-lg hover:bg-gold-200 transition-colors flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
          <span className="text-xs font-display font-bold tabular-nums">{timeUtils.formatClock(timer.elapsed)}</span>
        </button>
      ) : (
        <button onClick={openPanel} className="flex items-center gap-1 text-navy-500 hover:text-gold-600 transition-colors flex-shrink-0 px-1.5 py-1.5" title="Timer">
          <TimerIcon size={15} />
        </button>
      )}

      {/* Control panel */}
      {open && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[70] p-0 md:p-4" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-display font-bold text-navy-900 flex items-center gap-2"><TimerIcon size={17} className="text-gold-500" /> Time Tracker</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {timer.running ? (
                <>
                  {/* Running display */}
                  <div className="card p-4 bg-gold-50 border-gold-200 text-center">
                    <p className="font-display font-bold text-3xl text-gold-700 tabular-nums">{timeUtils.formatClock(timer.elapsed)}</p>
                    {/* Editable start time */}
                    {editingStart ? (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <input type="time" value={startInput} onChange={e => setStartInput(e.target.value)} className="input-base px-2 py-1 text-sm" />
                        <button onClick={applyStartEdit} className="btn-primary px-2.5 py-1 text-xs flex items-center gap-1"><Check size={11} /> Set</button>
                        <button onClick={() => setEditingStart(false)} className="text-xs text-navy-400">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setStartInput(toTimeInput(timer.startMs)); setEditingStart(true) }} className="text-xs text-navy-500 hover:text-gold-600 mt-1 inline-flex items-center gap-1">
                        <Pencil size={10} /> Started {toTimeInput(timer.startMs)} · edit
                      </button>
                    )}
                  </div>

                  {/* Reassign live */}
                  <AssignPicker companies={companies} projects={projects} tasks={tasks} value={assign} onChange={updateAssign} />
                  {!assign.taskId && (
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Label (optional, e.g. 'Site visit')" className="w-full input-base px-3 py-2 text-sm" />
                  )}

                  <button onClick={stopAndLog} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"><Square size={14} fill="currentColor" /> Stop & Log {timeUtils.formatClock(timer.elapsed)}</button>
                </>
              ) : (
                <>
                  {/* Mode toggle */}
                  <div className="flex gap-1 bg-surface-200 rounded-lg p-0.5">
                    <button onClick={() => setMode('live')} className={`flex-1 text-xs font-display font-semibold py-1.5 rounded-md transition-all ${mode === 'live' ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500'}`}>Start now</button>
                    <button onClick={() => setMode('past')} className={`flex-1 text-xs font-display font-semibold py-1.5 rounded-md transition-all ${mode === 'past' ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500'}`}>Log past time</button>
                  </div>

                  {mode === 'past' && (
                    <div className="card p-3 bg-surface-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-navy-400 mb-1">Start</p>
                          <input type="time" value={pastStart} onChange={e => setPastStart(e.target.value)} className="w-full input-base px-2 py-1.5 text-sm" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-navy-400 mb-1">End</p>
                          <input type="time" value={pastEnd} onChange={e => setPastEnd(e.target.value)} className="w-full input-base px-2 py-1.5 text-sm" />
                        </div>
                      </div>
                      <p className="text-xs text-navy-500 text-center">Duration: <span className="font-display font-bold text-navy-700">{timeUtils.formatDuration(pastSeconds)}</span></p>
                    </div>
                  )}

                  {/* Assignment */}
                  <AssignPicker companies={companies} projects={projects} tasks={tasks} value={assign} onChange={setAssign} />
                  {!assign.taskId && (
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Label (optional, e.g. 'Site visit')" className="w-full input-base px-3 py-2 text-sm" />
                  )}

                  {mode === 'live'
                    ? <button onClick={startNow} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"><Play size={14} fill="currentColor" /> Start Timer</button>
                    : <button onClick={logPast} disabled={pastSeconds < 1} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"><Clock size={14} /> Log {timeUtils.formatDuration(pastSeconds)}</button>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

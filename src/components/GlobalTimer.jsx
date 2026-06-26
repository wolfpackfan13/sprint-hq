import { useState } from 'react'
import { Play, Square, Timer as TimerIcon, X, Check } from 'lucide-react'
import { timeUtils } from '../utils/timeUtils'

export function GlobalTimer({ timer, tasks, companies, projects, onLogTime, onCreateTaskWithTime }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [pendingSeconds, setPendingSeconds] = useState(0)
  const [pickClient, setPickClient] = useState(null)
  const [pickProject, setPickProject] = useState(null)
  const [pickTask, setPickTask] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const activeTask = timer.activeTaskId ? tasks.find(t => t.id === timer.activeTaskId) : null

  const handleStop = () => {
    const result = timer.stop()
    if (!result) return
    if (result.taskId) {
      // Already attached — onStop already logged it. Done.
      return
    }
    // Unassigned — open the assign window
    setPendingSeconds(result.seconds)
    setPickClient(null); setPickProject(null); setPickTask(null); setNewTaskTitle('')
    setAssignOpen(true)
  }

  const resetAssign = () => {
    setAssignOpen(false); setPendingSeconds(0)
    setPickClient(null); setPickProject(null); setPickTask(null); setNewTaskTitle('')
  }

  const applyAssign = () => {
    if (pickTask) {
      onLogTime(pickTask, pendingSeconds)
    } else {
      // Create a new task to hold the time
      const title = newTaskTitle.trim() || 'Tracked work'
      onCreateTaskWithTime({ title, companyId: pickClient, projectId: pickProject }, pendingSeconds)
    }
    resetAssign()
  }

  const clientProjects = projects.filter(p => p.companyId === pickClient && p.status === 'active')
  const clientTasks = tasks.filter(t => t.status === 'todo' && (!pickClient || t.companyId === pickClient) && (!pickProject || t.projectId === pickProject))

  return (
    <>
      {/* Top bar control */}
      {timer.running ? (
        <button onClick={handleStop} className="flex items-center gap-1.5 bg-gold-100 text-gold-700 px-2.5 py-1.5 rounded-lg hover:bg-gold-200 transition-colors flex-shrink-0" title={activeTask ? activeTask.title : 'Unassigned timer'}>
          <Square size={12} fill="currentColor" />
          <span className="text-xs font-display font-bold tabular-nums">{timeUtils.formatClock(timer.elapsed)}</span>
        </button>
      ) : (
        <button onClick={() => timer.start(null)} className="flex items-center gap-1 text-navy-500 hover:text-gold-600 transition-colors flex-shrink-0 px-1.5 py-1.5" title="Start timer">
          <TimerIcon size={15} />
        </button>
      )}

      {/* Assign window */}
      {assignOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[70] p-0 md:p-4" onClick={e => e.target === e.currentTarget && resetAssign()}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <h2 className="font-display font-bold text-navy-900">Log {timeUtils.formatDuration(pendingSeconds)}</h2>
                <p className="text-xs text-navy-500">Assign this time to a task</p>
              </div>
              <button onClick={resetAssign} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
            </div>
            <div className="px-5 pb-5 space-y-4">
              {/* Pick existing task */}
              <div>
                <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Existing task</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientTasks.slice(0, 30).map(t => {
                    const co = companies.find(c => c.id === t.companyId)
                    return (
                      <button key={t.id} onClick={() => setPickTask(pickTask === t.id ? null : t.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm border transition-all ${pickTask === t.id ? 'border-gold-400 bg-gold-50' : 'border-surface-200 hover:border-surface-300'}`}>
                        {pickTask === t.id && <Check size={13} className="text-gold-600 flex-shrink-0" />}
                        <span className="flex-1 truncate text-navy-700">{t.title}</span>
                        {co && <span className="text-[10px]" style={{ color: co.color }}>{co.emoji}</span>}
                      </button>
                    )
                  })}
                  {clientTasks.length === 0 && <p className="text-xs text-navy-400 px-1 py-2">No open tasks{pickClient ? ' for this client' : ''}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-[10px] text-navy-400 uppercase">or new task</span>
                <div className="flex-1 h-px bg-surface-200" />
              </div>

              {/* New task */}
              <div className={pickTask ? 'opacity-40 pointer-events-none' : ''}>
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="New task name (or leave blank)" className="w-full input-base px-3 py-2 text-sm mb-2" />
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {companies.map(c => (
                    <button key={c.id} onClick={() => { setPickClient(pickClient === c.id ? null : c.id); setPickProject(null) }}
                      className="text-[11px] font-display font-semibold px-2.5 py-1 rounded-full border transition-all"
                      style={pickClient === c.id ? { backgroundColor: c.color, borderColor: c.color, color: '#fff' } : { backgroundColor: `${c.color}12`, borderColor: `${c.color}30`, color: c.color }}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
                {clientProjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {clientProjects.map(p => (
                      <button key={p.id} onClick={() => setPickProject(pickProject === p.id ? null : p.id)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${pickProject === p.id ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500'}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={applyAssign} className="w-full btn-primary py-3 text-sm">Log {timeUtils.formatDuration(pendingSeconds)}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

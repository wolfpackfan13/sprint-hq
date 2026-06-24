import { useState } from 'react'
import { Archive as ArchiveIcon, Search, RotateCcw, Trash2, CheckCircle2, Clock, FolderKanban } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'

export function Archive({ tasks, companies, projects, activeClient, onUncomplete, onDelete, tasksForProject, onReopenProject, onDeleteProject }) {
  const [search, setSearch] = useState('')

  const completed = tasks
    .filter(t => t.status === 'done' && t.completedAt)
    .filter(t => !activeClient || t.companyId === activeClient)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))

  const today = dateUtils.today()
  const weekDays = dateUtils.thisWeekDays()
  const weekStart = weekDays[0].date

  const groups = { Today: [], 'This Week': [], Earlier: [] }
  completed.forEach(t => {
    const d = t.completedAt.split('T')[0]
    if (d === today) groups['Today'].push(t)
    else if (d >= weekStart) groups['This Week'].push(t)
    else groups['Earlier'].push(t)
  })

  const totalTime = completed.reduce((s, t) => s + timeUtils.totalSeconds(t.timeEntries), 0)

  const getCompany = (id) => companies.find(c => c.id === id)
  const getProject = (id) => projects.find(p => p.id === id)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-forest-50 border border-forest-200 flex items-center justify-center flex-shrink-0">
            <ArchiveIcon size={20} className="text-forest-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Completed</h1>
            <p className="text-navy-500 text-sm">{completed.length} done{totalTime > 0 && ` · ${timeUtils.formatDuration(totalTime)} tracked`}</p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search completed tasks..." className="w-full input-base pl-9 pr-4 py-2.5 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 max-w-2xl mx-auto w-full">
        {(() => {
          const closedProjects = (projects || [])
            .filter(p => p.status === 'done')
            .filter(p => !activeClient || p.companyId === activeClient)
            .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
          if (closedProjects.length === 0) return null
          return (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">Closed Projects</p>
                <span className="text-[10px] text-navy-400">({closedProjects.length})</span>
              </div>
              <div className="space-y-2">
                {closedProjects.map(p => {
                  const co = companies.find(c => c.id === p.companyId)
                  const pt = tasksForProject ? tasksForProject(p.id) : []
                  const doneCount = pt.filter(t => t.status === 'done').length
                  const projSecs = pt.reduce((acc, t) => acc + timeUtils.totalSeconds(t.timeEntries), 0)
                  return (
                    <div key={p.id} className="card px-4 py-3 group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: co ? `${co.color}15` : '#F0F2F8' }}>
                          <FolderKanban size={15} style={{ color: co?.color || '#9BA5BB' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {co && <span className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded inline-block mb-0.5" style={{ backgroundColor: `${co.color}15`, color: co.color }}>{co.emoji} {co.name}</span>}
                          <p className="text-sm font-display font-semibold text-navy-700">{p.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-navy-400 flex items-center gap-1"><CheckCircle2 size={9} /> {doneCount}/{pt.length} tasks</span>
                            {projSecs > 0 && <span className="text-[11px] text-navy-400 flex items-center gap-1"><Clock size={9} /> {timeUtils.formatDuration(projSecs)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onReopenProject(p.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-600 px-2 py-1 rounded-lg hover:bg-surface-100"><RotateCcw size={11} /> Reopen</button>
                          <button onClick={() => onDeleteProject(p.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle2 size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">{search ? 'No matches' : 'Nothing completed yet'}</p>
            <p className="text-navy-400 text-sm mt-1">{search ? 'Try a different search' : 'Finished tasks will collect here'}</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => items.length > 0 && (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">{label}</p>
                <span className="text-[10px] text-navy-400">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map(t => {
                  const co = getCompany(t.companyId)
                  const proj = getProject(t.projectId)
                  const secs = timeUtils.totalSeconds(t.timeEntries)
                  return (
                    <div key={t.id} className="card px-4 py-3 group opacity-90 hover:opacity-100">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-forest-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 size={11} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {(co || proj) && (
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                              {co && <span className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${co.color}15`, color: co.color }}>{co.emoji} {co.name}</span>}
                              {proj && <><span className="text-navy-300 text-[10px]">›</span><span className="text-[10px] text-navy-500">{proj.name}</span></>}
                            </div>
                          )}
                          <p className="text-sm text-navy-600 line-through">{t.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-navy-400">{dateUtils.format(t.completedAt.split('T')[0], 'short')}</span>
                            {secs > 0 && <span className="text-[11px] text-navy-400 flex items-center gap-1"><Clock size={9} /> {timeUtils.formatDuration(secs)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onUncomplete(t.id)} className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-gold-600 px-2 py-1 rounded-lg hover:bg-surface-100"><RotateCcw size={11} /> Reopen</button>
                          <button onClick={() => onDelete(t.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

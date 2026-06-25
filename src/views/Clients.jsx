import { useMemo, useState } from 'react'
import { ChevronRight, AlertTriangle, CheckCircle2, Plus, Pencil } from 'lucide-react'
import { ClientForm } from '../components/ClientForm'
import { dateUtils } from '../utils/dateUtils'

function clientStats(company, { tasks, projects, meetings }) {
  const clientTasks = tasks.filter(t => t.companyId === company.id)
  const openTasks = clientTasks.filter(t => t.status === 'todo')
  const today = dateUtils.today()
  const overdue = openTasks.filter(t => t.dueDate && t.dueDate < today).length
  const activeProjects = projects.filter(p => p.companyId === company.id && p.status === 'active').length

  // Last activity across completed tasks, meetings, task creation
  const dates = []
  clientTasks.forEach(t => {
    if (t.completedAt) dates.push(t.completedAt.split('T')[0])
    if (t.createdAt) dates.push(t.createdAt.split('T')[0])
  })
  meetings.filter(m => m.companyId === company.id).forEach(m => dates.push(m.date))
  const lastActivity = dates.length ? dates.sort().reverse()[0] : null
  const daysSince = lastActivity ? dateUtils.daysOverdue(lastActivity) : null
  const hasWork = openTasks.length > 0 || activeProjects > 0
  const isStale = hasWork && daysSince !== null && daysSince > 14

  return { openTasks: openTasks.length, overdue, activeProjects, lastActivity, daysSince, isStale, hasWork }
}

export function Clients({ companies, tasks, projects, meetings, onOpenClient, onAddCompany, onUpdateCompany, onDeleteCompany }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleSave = (data) => {
    if (data.id) onUpdateCompany(data.id, data)
    else onAddCompany(data)
    setShowForm(false); setEditing(null)
  }
  const enriched = useMemo(() =>
    companies.map(c => ({ company: c, stats: clientStats(c, { tasks, projects, meetings }) }))
      .sort((a, b) => {
        // stale first, then by overdue, then by open tasks
        if (a.stats.isStale !== b.stats.isStale) return a.stats.isStale ? -1 : 1
        if (b.stats.overdue !== a.stats.overdue) return b.stats.overdue - a.stats.overdue
        return b.stats.openTasks - a.stats.openTasks
      }),
  [companies, tasks, projects, meetings])

  const staleOnes = enriched.filter(e => e.stats.isStale)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4">
        <div className="pt-5 pb-3 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Clients & Areas</h1>
            <p className="text-navy-500 text-sm mt-0.5">{companies.length} areas · open one to see everything</p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"><Plus size={15} /> Add</button>
        </div>

        {/* Needs attention banner */}
        {staleOnes.length > 0 && (
          <div className="card p-3 border-red-200 bg-red-50 mb-3">
            <p className="text-xs font-display font-bold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><AlertTriangle size={12} /> Going quiet</p>
            <p className="text-sm text-navy-600">{staleOnes.map(e => e.company.name).join(', ')} {staleOnes.length === 1 ? 'has' : 'have'} active work but no activity in 2+ weeks.</p>
          </div>
        )}

        <div className="pb-4 space-y-2">
          {enriched.map(({ company, stats }) => (
            <button key={company.id} onClick={() => onOpenClient(company)} className="card p-4 w-full text-left card-hover">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ backgroundColor: `${company.color}18` }}>{company.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-navy-900" style={{ color: company.color }}>{company.name}</p>
                    {stats.isStale && <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">QUIET</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {stats.openTasks > 0 ? (
                      <span className="text-xs text-navy-500">{stats.openTasks} open</span>
                    ) : (
                      <span className="text-xs text-navy-400 flex items-center gap-1"><CheckCircle2 size={11} className="text-forest-400" /> clear</span>
                    )}
                    {stats.overdue > 0 && <span className="text-xs text-red-500 font-medium">{stats.overdue} overdue</span>}
                    {stats.activeProjects > 0 && <span className="text-xs text-navy-400">{stats.activeProjects} projects</span>}
                    {stats.lastActivity && <span className="text-xs text-navy-400">· {stats.daysSince === 0 ? 'today' : `${stats.daysSince}d ago`}</span>}
                  </div>
                </div>
                <span onClick={(e) => { e.stopPropagation(); setEditing(company); setShowForm(true) }} className="p-1.5 text-navy-300 hover:text-gold-600 flex-shrink-0 cursor-pointer"><Pencil size={14} /></span>
                <ChevronRight size={18} className="text-navy-300 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>
      {showForm && <ClientForm client={editing} onSave={handleSave} onDelete={(id) => { onDeleteCompany(id); setShowForm(false); setEditing(null) }} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}

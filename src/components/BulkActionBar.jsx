import { useState } from 'react'
import { X, Building2, FolderKanban, Calendar, Trash2, Check } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function BulkActionBar({ count, companies, projects, onAssignClient, onAssignProject, onSetDue, onDelete, onClear }) {
  const [menu, setMenu] = useState(null) // 'client' | 'project' | 'due' | null

  const close = () => setMenu(null)

  return (
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg">
      {/* Sub-menus */}
      {menu === 'client' && (
        <div className="bg-white rounded-xl shadow-modal border border-surface-300 mb-2 p-2 max-h-60 overflow-y-auto">
          <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest px-2 py-1">Assign to client / area</p>
          {companies.map(c => (
            <button key={c.id} onClick={() => { onAssignClient(c.id); close() }} className="w-full flex items-center gap-2 px-2 py-2 text-sm text-navy-700 hover:bg-surface-100 rounded-lg">
              <span>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      )}
      {menu === 'project' && (
        <div className="bg-white rounded-xl shadow-modal border border-surface-300 mb-2 p-2 max-h-60 overflow-y-auto">
          <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest px-2 py-1">Assign to project (sets client too)</p>
          {projects.filter(p => p.status === 'active').length === 0 && <p className="text-xs text-navy-400 px-2 py-2">No active projects</p>}
          {projects.filter(p => p.status === 'active').map(p => {
            const co = companies.find(c => c.id === p.companyId)
            return (
              <button key={p.id} onClick={() => { onAssignProject(p.id, p.companyId); close() }} className="w-full flex items-center gap-2 px-2 py-2 text-sm text-navy-700 hover:bg-surface-100 rounded-lg">
                <FolderKanban size={13} style={{ color: co?.color || '#9BA5BB' }} /> {p.name}
                {co && <span className="text-[10px] text-navy-400 ml-auto">{co.emoji} {co.name}</span>}
              </button>
            )
          })}
        </div>
      )}
      {menu === 'due' && (
        <div className="bg-white rounded-xl shadow-modal border border-surface-300 mb-2 p-2">
          <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest px-2 py-1">Set due date</p>
          <div className="flex flex-wrap gap-2 p-1">
            <button onClick={() => { onSetDue(dateUtils.today()); close() }} className="text-xs btn-ghost px-3 py-1.5">Today</button>
            <button onClick={() => { onSetDue(dateUtils.addDays(1)); close() }} className="text-xs btn-ghost px-3 py-1.5">Tomorrow</button>
            <button onClick={() => { const d = new Date(); const diff = (5 - d.getDay() + 7) % 7 || 7; onSetDue(dateUtils.addDays(diff)); close() }} className="text-xs btn-ghost px-3 py-1.5">This Fri</button>
            <input type="date" onChange={(e) => { if (e.target.value) { onSetDue(e.target.value); close() } }} className="input-base px-2 py-1.5 text-xs" />
            <button onClick={() => { onSetDue(null); close() }} className="text-xs text-navy-400 hover:text-red-400 px-2 py-1.5">Clear date</button>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="bg-navy-900 text-white rounded-xl shadow-modal px-3 py-2.5 flex items-center gap-2">
        <span className="font-display font-bold text-sm px-2 flex-shrink-0">{count}</span>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          <button onClick={() => setMenu(menu === 'client' ? null : 'client')} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-navy-700 whitespace-nowrap"><Building2 size={13} /> Client</button>
          <button onClick={() => setMenu(menu === 'project' ? null : 'project')} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-navy-700 whitespace-nowrap"><FolderKanban size={13} /> Project</button>
          <button onClick={() => setMenu(menu === 'due' ? null : 'due')} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-navy-700 whitespace-nowrap"><Calendar size={13} /> Due</button>
          <button onClick={onDelete} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/30 text-red-300 whitespace-nowrap"><Trash2 size={13} /> Delete</button>
        </div>
        <button onClick={onClear} className="p-1.5 text-navy-400 hover:text-white flex-shrink-0"><X size={16} /></button>
      </div>
    </div>
  )
}

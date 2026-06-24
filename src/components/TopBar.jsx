import { useState } from 'react'
import { Sparkles, ChevronDown, Check, Pencil, Plus, CheckSquare, FolderKanban, Clipboard, LogOut } from 'lucide-react'
import { SyncIndicator } from './SyncIndicator'

export function TopBar({
  sprint, currentWeek, progress, vision, onSaveVision, onEditSprint,
  companies, activeClient, onSelectClient,
  onNewTask, onNewProject, onNewMeeting, onBriefing,
  syncStatus, lastSynced, userEmail, onSignOut,
}) {
  const [whyOpen, setWhyOpen] = useState(false)
  const [editingWhy, setEditingWhy] = useState(false)
  const [draft, setDraft] = useState(vision)
  const [clientOpen, setClientOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)

  const pct = sprint ? Math.round(progress * 100) : 0
  const activeCo = companies.find(c => c.id === activeClient)

  return (
    <div className="bg-white border-b border-surface-300 flex-shrink-0 relative z-20">
      <div className="px-4 py-2 flex items-center gap-3 max-w-6xl mx-auto w-full">
        {/* + New button */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setAddOpen(o => !o)} className="flex items-center gap-1 btn-primary px-2.5 py-1.5 text-xs">
            <Plus size={15} strokeWidth={2.5} /> New
          </button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
              <div className="absolute left-0 top-full mt-1 bg-white border border-surface-300 rounded-xl shadow-modal py-1 z-40 min-w-[170px]">
                <button onClick={() => { onNewTask(); setAddOpen(false) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-navy-700 hover:bg-surface-100">
                  <CheckSquare size={14} className="text-gold-500" /> New Task
                </button>
                <button onClick={() => { onNewProject(); setAddOpen(false) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-navy-700 hover:bg-surface-100">
                  <FolderKanban size={14} className="text-blue-500" /> New Project
                </button>
                <button onClick={() => { onNewMeeting(); setAddOpen(false) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-navy-700 hover:bg-surface-100">
                  <Clipboard size={14} className="text-forest-500" /> New Meeting
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sprint progress */}
        {sprint && (
          <button onClick={onEditSprint} className="flex items-center gap-2 flex-shrink-0 group">
            <span className="text-xs font-display font-bold text-gold-600 group-hover:text-gold-700">Wk {currentWeek}/12</span>
            <div className="w-16 h-1.5 bg-surface-300 rounded-full overflow-hidden hidden sm:block">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C47D0E,#F4A825)' }} />
            </div>
          </button>
        )}

        {/* Why */}
        <button onClick={() => setWhyOpen(o => !o)} className="flex items-center gap-1 text-xs text-navy-500 hover:text-gold-600 transition-colors flex-shrink-0">
          <Sparkles size={12} className="text-gold-500" />
          <span className="font-display font-semibold hidden sm:inline">My Why</span>
          <ChevronDown size={12} className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex-1" />

        {/* Briefing quick action */}
        <button onClick={onBriefing} className="flex items-center gap-1 text-xs text-navy-500 hover:text-gold-600 transition-colors flex-shrink-0">
          <Sparkles size={13} className="text-gold-500" />
          <span className="font-display font-semibold hidden md:inline">Briefing</span>
        </button>

        {/* Sync status */}
        <SyncIndicator status={syncStatus} lastSynced={lastSynced} />

        {/* Account menu */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setAcctOpen(o => !o)} className="w-7 h-7 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-display font-bold hover:bg-navy-700 transition-colors">
            {(userEmail || '?')[0].toUpperCase()}
          </button>
          {acctOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAcctOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-300 rounded-xl shadow-modal py-1 z-40 min-w-[200px]">
                <div className="px-3 py-2 border-b border-surface-200">
                  <p className="text-[11px] text-navy-400">Signed in as</p>
                  <p className="text-xs text-navy-700 font-medium truncate">{userEmail}</p>
                </div>
                <button onClick={() => { onSignOut(); setAcctOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy-700 hover:bg-surface-100">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>

        {/* Client filter */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setClientOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all"
            style={activeCo ? { backgroundColor: `${activeCo.color}15`, borderColor: `${activeCo.color}50`, color: activeCo.color } : { borderColor: '#E4E7EF', color: '#475C7A' }}>
            {activeCo ? <>{activeCo.emoji} <span className="hidden sm:inline">{activeCo.name}</span></> : 'All'}
            <ChevronDown size={12} className={`transition-transform ${clientOpen ? 'rotate-180' : ''}`} />
          </button>
          {clientOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setClientOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-300 rounded-xl shadow-modal py-1 z-40 min-w-[180px]">
                <button onClick={() => { onSelectClient(null); setClientOpen(false) }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-navy-700 hover:bg-surface-100">
                  All Clients {!activeClient && <Check size={14} className="text-gold-600" />}
                </button>
                {companies.map(co => (
                  <button key={co.id} onClick={() => { onSelectClient(co.id); setClientOpen(false) }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-100">
                    <span className="flex items-center gap-2"><span>{co.emoji}</span><span className="text-navy-700">{co.name}</span></span>
                    {activeClient === co.id && <Check size={14} className="text-gold-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Why panel */}
      {whyOpen && (
        <div className="px-4 pb-3 border-t border-surface-100 bg-gold-50">
          <div className="max-w-6xl mx-auto w-full">
            {editingWhy ? (
              <div className="pt-2">
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} autoFocus placeholder="I'm building toward..."
                  className="w-full bg-white border border-gold-400 rounded-lg px-3 py-2 text-sm text-navy-800 resize-none focus:outline-none mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => { onSaveVision(draft); setEditingWhy(false) }} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Check size={11} /> Save</button>
                  <button onClick={() => { setEditingWhy(false); setDraft(vision) }} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex items-start gap-2">
                <p className="flex-1 text-sm text-navy-700 leading-snug">{vision || <span className="italic text-gold-600">Set your Why — what are you building toward?</span>}</p>
                <button onClick={() => { setEditingWhy(true); setDraft(vision) }} className="p-1 text-gold-600 hover:text-gold-700 flex-shrink-0"><Pencil size={12} /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

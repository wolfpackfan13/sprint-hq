import { useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, ArrowRight, Check, Calendar } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function Meetings({
  meetings, companies, projects = [], activeClient,
  onAddMeeting, onEditMeeting, onDeleteMeeting,
  onToggleActionItem, onPushToTask, onAddActionItem,
}) {
  const [expanded, setExpanded] = useState({})
  const [newAiText, setNewAiText] = useState({})

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const getCompany = (id) => companies.find(c => c.id === id)

  const filtered = activeClient
    ? meetings.filter(m => m.companyId === activeClient)
    : meetings

  const today = dateUtils.today()
  const todayMtgs = filtered.filter(m => m.date === today)
  const upcomingMtgs = filtered.filter(m => m.date > today)
  const pastMtgs = filtered.filter(m => m.date < today)

  const renderMeeting = (m) => {
    const co = getCompany(m.companyId)
    const isOpen = expanded[m.id]
    const pendingItems = (m.actionItems || []).filter(ai => !ai.done && !ai.taskId).length

    return (
      <div key={m.id} className="card overflow-hidden">
        {/* Meeting header */}
        <div className="p-4 flex items-start gap-3">
          <button
            onClick={() => toggle(m.id)}
            className="flex-1 text-left min-w-0"
          >
            <div className="flex items-start gap-2 mb-1">
              <span className="font-display font-semibold text-navy-900 text-sm leading-snug flex-1">{m.title || 'Untitled Meeting'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-navy-400 flex items-center gap-1">
                <Calendar size={10} />
                {dateUtils.format(m.date, 'short')}
                {m.time ? ` · ${m.time}` : ''}
              </span>
              {co && (
                <span className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${co.color}15`, color: co.color }}>
                  {co.emoji} {co.name}
                </span>
              )}
              {m.projectId && projects.find(p => p.id === m.projectId) && (
                <span className="text-[10px] font-medium text-navy-500">› {projects.find(p => p.id === m.projectId).name}</span>
              )}
              {m.attendees && (
                <span className="text-xs text-navy-400 truncate">{m.attendees}</span>
              )}
              {pendingItems > 0 && (
                <span className="text-[10px] font-bold bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full">
                  {pendingItems} action{pendingItems !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEditMeeting(m)} className="p-1.5 text-navy-400 hover:text-gold-600 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => toggle(m.id)} className="p-1.5 text-navy-400 hover:text-navy-700 transition-colors">
              {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button onClick={() => onDeleteMeeting(m.id)} className="p-1.5 text-navy-400 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div className="border-t border-surface-300 px-4 py-3 space-y-3 bg-surface-100">
            {/* Notes */}
            {m.notes && (
              <div>
                <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-navy-600 leading-relaxed whitespace-pre-wrap">{m.notes}</p>
              </div>
            )}

            {/* Action Items */}
            <div>
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2">Action Items</p>
              <div className="space-y-1.5">
                {(m.actionItems || []).map(ai => (
                  <div key={ai.id} className={`flex items-center gap-2 p-2 rounded-lg ${ai.done ? 'opacity-50' : 'bg-white border border-surface-300'}`}>
                    <button
                      onClick={() => onToggleActionItem(m.id, ai.id)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        ai.done ? 'bg-forest-500 border-forest-500' : 'border-surface-400 hover:border-gold-500'
                      }`}
                    >
                      {ai.done && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-xs ${ai.done ? 'line-through text-navy-400' : 'text-navy-700'}`}>
                      {ai.title}
                    </span>
                    {ai.dueDate && (
                      <span className="text-[10px] text-navy-400">{dateUtils.format(ai.dueDate, 'short')}</span>
                    )}
                    {!ai.done && !ai.taskId && (
                      <button
                        onClick={() => onPushToTask(m.id, ai)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-gold-600 hover:text-gold-700 bg-gold-50 px-2 py-0.5 rounded-full border border-gold-200"
                      >
                        <ArrowRight size={9} /> Task
                      </button>
                    )}
                    {ai.taskId && (
                      <span className="text-[10px] text-forest-600 bg-forest-50 px-2 py-0.5 rounded-full border border-forest-200">
                        ✓ In tasks
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Add action item inline */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newAiText[m.id] || ''}
                  onChange={e => setNewAiText(prev => ({ ...prev, [m.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (newAiText[m.id] || '').trim()) {
                      onAddActionItem(m.id, newAiText[m.id].trim())
                      setNewAiText(prev => ({ ...prev, [m.id]: '' }))
                    }
                  }}
                  placeholder="Add action item..."
                  className="flex-1 input-base px-3 py-1.5 text-xs"
                />
                <button
                  onClick={() => {
                    if ((newAiText[m.id] || '').trim()) {
                      onAddActionItem(m.id, newAiText[m.id].trim())
                      setNewAiText(prev => ({ ...prev, [m.id]: '' }))
                    }
                  }}
                  className="p-1.5 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">Meetings</h1>
          <p className="text-navy-500 text-sm mt-0.5">{meetings.length} total · {meetings.flatMap(m => m.actionItems || []).filter(ai => !ai.done && !ai.taskId).length} pending actions</p>
        </div>
        <button onClick={onAddMeeting} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          <Plus size={15} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 max-w-2xl mx-auto w-full">
        {todayMtgs.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-gold-600 uppercase tracking-widest mb-2">Today</p>
            <div className="space-y-3">{todayMtgs.map(renderMeeting)}</div>
          </section>
        )}
        {upcomingMtgs.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest mb-2">Upcoming</p>
            <div className="space-y-3">{upcomingMtgs.map(renderMeeting)}</div>
          </section>
        )}
        {pastMtgs.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest mb-2">Past</p>
            <div className="space-y-3">{pastMtgs.map(renderMeeting)}</div>
          </section>
        )}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-display font-semibold text-navy-700">No meetings yet</p>
            <p className="text-navy-400 text-sm mt-1">Log a meeting to capture notes and action items</p>
          </div>
        )}
      </div>
    </div>
  )
}

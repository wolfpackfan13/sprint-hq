import { useState } from 'react'
import { Plus, Pencil, Trash2, Target, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

const TIMEFRAMES = [
  { value: '12-week', label: '12-Week Sprint' },
  { value: 'annual', label: 'Annual' },
  { value: 'long-term', label: 'Long-Term' },
]

function GoalForm({ goal, companies, onSave, onClose }) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    why: goal?.why || '',
    timeframe: goal?.timeframe || '12-week',
    companyId: goal?.companyId || null,
    status: goal?.status || 'active',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white border-b border-surface-200">
          <h2 className="font-display font-bold text-navy-900">{goal?.id ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Goal title *" className="w-full input-base px-4 py-2.5 text-sm font-medium" autoFocus />
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does success look like?" rows={2} className="w-full input-base px-4 py-2.5 text-sm resize-none" />
          <textarea value={form.why} onChange={e => set('why', e.target.value)} placeholder="Why does this matter to you personally?" rows={2} className="w-full input-base px-4 py-2.5 text-sm resize-none" />

          <div>
            <p className="text-xs font-medium text-navy-500 mb-2 uppercase tracking-wide">Timeframe</p>
            <div className="flex gap-2">
              {TIMEFRAMES.map(tf => (
                <button key={tf.value} onClick={() => set('timeframe', tf.value)}
                  className={`flex-1 py-2 text-xs font-display font-semibold rounded-lg border transition-all ${
                    form.timeframe === tf.value ? 'bg-gold-500 border-gold-500 text-navy-900' : 'border-surface-300 text-navy-500 hover:border-gold-400'
                  }`}>
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-navy-500 mb-2 uppercase tracking-wide">Company</p>
            <div className="flex flex-wrap gap-2">
              {companies.map(co => (
                <button key={co.id} onClick={() => set('companyId', form.companyId === co.id ? null : co.id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-all"
                  style={form.companyId === co.id
                    ? { backgroundColor: co.color, borderColor: co.color, color: '#fff' }
                    : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }}>
                  {co.emoji} {co.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 btn-ghost text-sm">Cancel</button>
            <button onClick={() => form.title.trim() && onSave({ ...(goal?.id ? { id: goal.id } : {}), ...form })}
              disabled={!form.title.trim()} className="flex-1 py-2.5 btn-primary text-sm">
              {goal?.id ? 'Save' : 'Add Goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Goals({ goals, vision, companies, activeClient, onAddGoal, onUpdateGoal, onDeleteGoal, onSaveVision }) {
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editingVision, setEditingVision] = useState(false)
  const [visionDraft, setVisionDraft] = useState(vision)
  const [expandedGoals, setExpandedGoals] = useState({})

  const filtered = goals.filter(g => !activeClient || g.companyId === activeClient)
  const activeGoals = filtered.filter(g => g.status === 'active')
  const doneGoals = filtered.filter(g => g.status === 'complete')

  const toggle = (id) => setExpandedGoals(e => ({ ...e, [id]: !e[id] }))

  const handleSaveGoal = (data) => {
    if (data.id) onUpdateGoal(data.id, data)
    else onAddGoal(data)
    setShowForm(false)
    setEditingGoal(null)
  }

  const getCompany = (id) => companies.find(c => c.id === id)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">Goals & Vision</h1>
          <p className="text-navy-500 text-sm mt-0.5">{activeGoals.length} active goals</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          <Plus size={15} /> Goal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Vision Statement */}
        <div className="card p-4 border-gold-200 bg-gold-50">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs font-display font-bold text-gold-700 uppercase tracking-wide flex items-center gap-1.5">
              <Target size={12} /> My North Star
            </p>
            <button onClick={() => { setEditingVision(true); setVisionDraft(vision) }}
              className="p-1 text-gold-600 hover:text-gold-700"><Pencil size={13} /></button>
          </div>
          {editingVision ? (
            <div>
              <textarea
                value={visionDraft}
                onChange={e => setVisionDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full bg-white border border-gold-400 rounded-lg px-3 py-2 text-sm text-navy-800 resize-none focus:outline-none mb-2"
                placeholder="I am building toward..."
              />
              <div className="flex gap-2">
                <button onClick={() => { onSaveVision(visionDraft); setEditingVision(false) }}
                  className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Check size={12} /> Save</button>
                <button onClick={() => setEditingVision(false)} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-700 leading-relaxed">
              {vision || <span className="italic text-gold-600">Click ✏️ to set your North Star</span>}
            </p>
          )}
        </div>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-navy-400 uppercase tracking-widest mb-2">Active Goals</p>
            <div className="space-y-3">
              {activeGoals.map(g => {
                const co = getCompany(g.companyId)
                const isExp = expandedGoals[g.id]
                const tfLabel = TIMEFRAMES.find(t => t.value === g.timeframe)?.label || g.timeframe
                return (
                  <div key={g.id} className="card overflow-hidden">
                    <div className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0">
                        <Target size={15} className="text-gold-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => toggle(g.id)} className="text-left">
                            <p className="font-display font-semibold text-navy-900 text-sm">{g.title}</p>
                          </button>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingGoal(g); setShowForm(true) }} className="p-1 text-navy-400 hover:text-gold-600"><Pencil size={12} /></button>
                            <button onClick={() => onUpdateGoal(g.id, { status: 'complete' })} className="p-1 text-navy-400 hover:text-forest-500"><Check size={12} /></button>
                            <button onClick={() => toggle(g.id)} className="p-1 text-navy-400">{isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                            <button onClick={() => onDeleteGoal(g.id)} className="p-1 text-navy-400 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold bg-surface-200 text-navy-500 px-2 py-0.5 rounded-full">{tfLabel}</span>
                          {co && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${co.color}15`, color: co.color }}>
                              {co.emoji} {co.name}
                            </span>
                          )}
                        </div>
                        {isExp && (
                          <div className="mt-3 space-y-2 border-t border-surface-200 pt-3">
                            {g.description && <p className="text-sm text-navy-600">{g.description}</p>}
                            {g.why && (
                              <div className="bg-gold-50 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-gold-600 uppercase tracking-wide mb-1">Why this matters</p>
                                <p className="text-xs text-navy-600">{g.why}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {goals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="font-display font-semibold text-navy-700">No goals yet</p>
            <p className="text-navy-400 text-sm mt-1">Set your 12-week and annual goals here</p>
          </div>
        )}
      </div>

      {(showForm || editingGoal) && (
        <GoalForm
          goal={editingGoal}
          companies={companies}
          onSave={handleSaveGoal}
          onClose={() => { setShowForm(false); setEditingGoal(null) }}
        />
      )}
    </div>
  )
}

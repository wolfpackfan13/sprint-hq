import { useState, useEffect } from 'react'
import { X, Sparkles, Check, Plus, RefreshCw } from 'lucide-react'
import { breakdownTask } from '../utils/aiBreakdown'

export function BreakdownModal({ task, apiKey, onApply, onClose }) {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const result = await breakdownTask(task.title, task.notes, apiKey)
      setSteps(result.map((s, i) => ({ id: `sub_${Date.now()}_${i}`, title: s, done: false, include: true })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [])

  const toggleInclude = (id) => setSteps(prev => prev.map(s => s.id === id ? { ...s, include: !s.include } : s))
  const editStep = (id, title) => setSteps(prev => prev.map(s => s.id === id ? { ...s, title } : s))

  const apply = () => {
    const included = steps.filter(s => s.include).map(s => ({ id: s.id, title: s.title, done: false }))
    onApply(task.id, included)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="font-display font-bold text-navy-900 flex items-center gap-2"><Sparkles size={16} className="text-gold-500" /> Break It Down</h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700"><X size={18} /></button>
        </div>
        <div className="px-5 pb-3 flex-shrink-0">
          <p className="text-sm text-navy-500 bg-surface-100 rounded-lg px-3 py-2">{task.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-gold-300 border-t-gold-600 animate-spin mb-3" />
              <p className="text-sm text-navy-500">Claude is breaking this down...</p>
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="space-y-2">
              {steps.map(s => (
                <div key={s.id} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${s.include ? 'bg-white border-surface-300' : 'bg-surface-100 border-surface-200 opacity-50'}`}>
                  <button onClick={() => toggleInclude(s.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${s.include ? 'bg-gold-500 border-gold-500' : 'border-surface-400'}`}>
                    {s.include && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                  <input value={s.title} onChange={e => editStep(s.id, e.target.value)} className="flex-1 bg-transparent text-sm text-navy-700 focus:outline-none" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-surface-200 flex-shrink-0 flex gap-2">
          <button onClick={run} disabled={loading} className="btn-ghost px-3 py-2.5 text-sm flex items-center gap-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Redo</button>
          <button onClick={apply} disabled={loading || steps.filter(s => s.include).length === 0} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5">
            <Plus size={14} /> Add {steps.filter(s => s.include).length} subtasks
          </button>
        </div>
      </div>
    </div>
  )
}

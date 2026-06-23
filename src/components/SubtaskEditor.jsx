import { useState } from 'react'
import { Plus, Check, Trash2, GripVertical } from 'lucide-react'

const genId = () => `sub_${Date.now()}_${Math.random().toString(36).slice(2,5)}`

export function SubtaskEditor({ subtasks = [], onChange }) {
  const [newTitle, setNewTitle] = useState('')

  const add = () => {
    if (!newTitle.trim()) return
    onChange([...(subtasks || []), { id: genId(), title: newTitle.trim(), done: false }])
    setNewTitle('')
  }

  const toggle = (id) => onChange(subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s))
  const rename = (id, title) => onChange(subtasks.map(s => s.id === id ? { ...s, title } : s))
  const remove = (id) => onChange(subtasks.filter(s => s.id !== id))

  const move = (index, dir) => {
    const next = [...subtasks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      {subtasks.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 group">
          <div className="flex flex-col flex-shrink-0">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-navy-300 hover:text-navy-500 disabled:opacity-30 leading-none text-[8px]">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === subtasks.length - 1} className="text-navy-300 hover:text-navy-500 disabled:opacity-30 leading-none text-[8px]">▼</button>
          </div>
          <button onClick={() => toggle(s.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-forest-500 border-forest-500' : 'border-surface-400 hover:border-gold-500'}`}>
            {s.done && <Check size={9} className="text-white" strokeWidth={3} />}
          </button>
          <input value={s.title} onChange={e => rename(s.id, e.target.value)}
            className={`flex-1 bg-transparent text-sm focus:outline-none ${s.done ? 'line-through text-navy-400' : 'text-navy-700'}`} />
          <button onClick={() => remove(s.id)} className="p-0.5 text-navy-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a step..." className="flex-1 input-base px-3 py-1.5 text-sm" />
        <button onClick={add} disabled={!newTitle.trim()} className="p-1.5 btn-primary"><Plus size={15} /></button>
      </div>
    </div>
  )
}

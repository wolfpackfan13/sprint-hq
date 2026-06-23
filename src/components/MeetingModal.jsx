import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, ArrowRight, Calendar, Users, Tag, AlignLeft } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

export function MeetingModal({ meeting, companies, onSave, onClose }) {
  const [title, setTitle] = useState(meeting?.title || '')
  const [date, setDate] = useState(meeting?.date || dateUtils.today())
  const [time, setTime] = useState(meeting?.time || '')
  const [attendees, setAttendees] = useState(meeting?.attendees || '')
  const [companyId, setCompanyId] = useState(meeting?.companyId || null)
  const [notes, setNotes] = useState(meeting?.notes || '')
  const [actionItems, setActionItems] = useState(meeting?.actionItems || [])
  const [newActionItem, setNewActionItem] = useState('')
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const addActionItem = () => {
    if (!newActionItem.trim()) return
    setActionItems(prev => [...prev, {
      id: `ai_${Date.now()}`,
      title: newActionItem.trim(),
      dueDate: null,
      done: false,
      taskId: null,
    }])
    setNewActionItem('')
  }

  const removeActionItem = (id) => setActionItems(prev => prev.filter(ai => ai.id !== id))
  const updateActionItemDate = (id, dueDate) =>
    setActionItems(prev => prev.map(ai => ai.id === id ? { ...ai, dueDate } : ai))

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      ...(meeting?.id ? { id: meeting.id, actionItems: meeting.actionItems } : {}),
      title: title.trim(),
      date,
      time,
      attendees,
      companyId,
      notes: notes.trim(),
      actionItems,
    })
  }

  const selectedCompany = companies.find(c => c.id === companyId)
  const isEdit = !!meeting?.id

  return (
    <div
      className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-modal max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="font-display font-bold text-navy-900 text-base">
            {isEdit ? 'Edit Meeting' : 'New Meeting'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-navy-400 hover:text-navy-700 rounded-lg hover:bg-surface-200">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="w-full input-base px-4 py-3 text-sm font-medium"
          />

          {/* Date + Time */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Calendar size={13} className="absolute left-3 top-3 text-navy-400 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full input-base pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="input-base px-3 py-2.5 text-sm w-32"
            />
          </div>

          {/* Attendees */}
          <div className="relative">
            <Users size={13} className="absolute left-3 top-3 text-navy-400 pointer-events-none" />
            <input
              type="text"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="Attendees (names or emails)"
              className="w-full input-base pl-9 pr-4 py-2.5 text-sm"
            />
          </div>

          {/* Company */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={13} className="text-navy-400" />
              <span className="text-xs font-medium text-navy-500 uppercase tracking-wide">Client / Company</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {companies.map(co => (
                <button
                  key={co.id}
                  onClick={() => setCompanyId(companyId === co.id ? null : co.id)}
                  className="flex items-center gap-1.5 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all"
                  style={companyId === co.id
                    ? { backgroundColor: co.color, borderColor: co.color, color: '#fff' }
                    : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }
                  }
                >
                  {co.emoji} {co.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="relative">
            <AlignLeft size={13} className="absolute left-3 top-3 text-navy-400 pointer-events-none" />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Meeting notes..."
              rows={3}
              className="w-full input-base pl-9 pr-4 py-2.5 text-sm resize-none"
            />
          </div>

          {/* Action Items */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ArrowRight size={12} /> Action Items
            </p>
            <div className="space-y-2 mb-2">
              {actionItems.map(ai => (
                <div key={ai.id} className="flex items-center gap-2 bg-surface-100 rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                  <span className="flex-1 text-sm text-navy-700">{ai.title}</span>
                  <input
                    type="date"
                    value={ai.dueDate || ''}
                    onChange={e => updateActionItemDate(ai.id, e.target.value)}
                    className="text-[11px] bg-transparent text-navy-400 focus:outline-none border-none w-28"
                  />
                  <button onClick={() => removeActionItem(ai.id)} className="p-0.5 text-navy-400 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newActionItem}
                onChange={e => setNewActionItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addActionItem()}
                placeholder="Add action item (Enter to add)"
                className="flex-1 input-base px-3 py-2 text-sm"
              />
              <button
                onClick={addActionItem}
                className="p-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 btn-ghost text-sm font-medium">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 py-3 btn-primary text-sm"
            >
              {isEdit ? 'Save Changes' : 'Save Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

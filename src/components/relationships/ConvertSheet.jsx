import { useState } from 'react'
import { Sheet, StageChip } from './bits'
import { STAGES, stageOf, segmentOf, defaultNextTouch, shortDay } from '../../utils/relationships'
import { dateUtils } from '../../utils/dateUtils'
import { COLOR_OPTIONS } from '../ClientForm'

// Convert a lead to a client: create or pick the Client/Area record that
// hours, tasks, and invoices hang off, then move the stage.
export function ConvertSheet({ contact, contacts, companies, onConvert, onClose }) {
  const today = dateUtils.today()
  const firstName = (contact.name || '').trim().split(' ')[0] || 'them'
  const companyName = (contact.company || '').trim()
  const existingMatch = companyName
    ? companies.find(c => c.name.trim().toLowerCase() === companyName.toLowerCase())
    : null

  const [mode, setMode] = useState(existingMatch ? 'existing' : 'new')
  const [name, setName] = useState(companyName || contact.name || '')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [hourlyRate, setHourlyRate] = useState('')
  const [billable, setBillable] = useState(true)
  const [existingId, setExistingId] = useState(existingMatch?.id || companies[0]?.id || '')

  const peers = companyName
    ? contacts.filter(c => c.id !== contact.id
        && (c.company || '').trim().toLowerCase() === companyName.toLowerCase()
        && segmentOf(c) !== 'clients')
    : []
  const [peerIds, setPeerIds] = useState(peers.map(p => p.id))
  const togglePeer = (id) => setPeerIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const nextTouch = defaultNextTouch('client', today)
  const canSave = mode === 'new' ? !!name.trim() : !!existingId

  const save = () => {
    if (!canSave) return
    onConvert({
      newCompany: mode === 'new'
        ? { name: name.trim(), color, emoji: '🏢', billable, hourlyRate: Number(hourlyRate) || 0 }
        : null,
      companyId: mode === 'existing' ? existingId : null,
      peerIds,
      nextTouchOn: nextTouch,
    })
  }

  return (
    <Sheet
      title={`Convert ${firstName} to a client`}
      subtitle="Links them to a client record so hours, tasks, and invoices attach from today."
      onClose={onClose} labelId="convert-title"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 btn-ghost text-sm">Cancel</button>
          <button onClick={save} disabled={!canSave} className="flex-[2] py-3 btn-primary text-sm">Convert to client</button>
        </div>
      }
    >
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="font-display font-bold text-[11px] uppercase tracking-wider text-navy-600 mb-2">1 · Client record</legend>

          <div className={`rounded-xl p-3 border ${mode === 'new' ? 'border-gold-500 bg-gold-50' : 'border-surface-300'}`}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="convert-mode" checked={mode === 'new'} onChange={() => setMode('new')} className="w-4 h-4 accent-[#A86800]" />
              <span className="text-sm font-semibold text-navy-900">Create a new client record</span>
            </label>
            {mode === 'new' && (
              <div className="mt-3 pl-6 space-y-3">
                <div>
                  <label htmlFor="cv-name" className="block text-xs font-semibold text-navy-600 mb-1">Name</label>
                  <input id="cv-name" value={name} onChange={e => setName(e.target.value)} className="w-full input-base px-3 py-2 text-sm bg-white" />
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs font-semibold text-navy-600 mb-1">Color</p>
                    <div className="flex gap-1.5">
                      {COLOR_OPTIONS.slice(0, 5).map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c}
                          className="w-7 h-7 rounded-lg border-2" style={{ backgroundColor: c, borderColor: color === c ? '#0D1526' : 'transparent' }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="cv-rate" className="block text-xs font-semibold text-navy-600 mb-1">Hourly rate</label>
                    <input id="cv-rate" type="number" min="0" inputMode="decimal" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="0" className="w-full input-base px-3 py-2 text-sm bg-white" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-navy-700">
                  <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} className="w-4 h-4 accent-[#A86800]" /> Billable
                </label>
              </div>
            )}
          </div>

          {companies.length > 0 && (
            <div className={`rounded-xl p-3 border ${mode === 'existing' ? 'border-gold-500 bg-gold-50' : 'border-surface-300'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="convert-mode" checked={mode === 'existing'} onChange={() => setMode('existing')} className="w-4 h-4 accent-[#A86800]" />
                <span className="text-sm font-semibold text-navy-900">Add to an existing client</span>
              </label>
              {mode === 'existing' && (
                <div className="mt-3 pl-6">
                  <label htmlFor="cv-existing" className="sr-only">Existing client</label>
                  <select id="cv-existing" value={existingId} onChange={e => setExistingId(e.target.value)} className="w-full input-base px-3 py-2 text-sm bg-white">
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </fieldset>

        <div className="space-y-2">
          <p className="font-display font-bold text-[11px] uppercase tracking-wider text-navy-600">2 · What changes</p>
          <div className="rounded-xl border border-surface-300 divide-y divide-surface-200 text-sm">
            <div className="flex justify-between items-center px-3 py-2.5">
              <span className="text-navy-600">Stage</span>
              <span className="flex items-center gap-1.5"><StageChip stage={stageOf(contact)} /> → <StageChip stage="client" /></span>
            </div>
            <div className="flex justify-between px-3 py-2.5"><span className="text-navy-600">Client since</span><span className="font-medium">Today, {dateUtils.format(today, 'short')}</span></div>
            <div className="flex justify-between px-3 py-2.5"><span className="text-navy-600">Next touch</span><span className="font-medium">{shortDay(nextTouch)} · First check-in</span></div>
          </div>
          {peers.map(p => (
            <label key={p.id} className="flex items-center gap-2.5 text-sm text-navy-800 py-1.5">
              <input type="checkbox" checked={peerIds.includes(p.id)} onChange={() => togglePeer(p.id)} className="w-4 h-4 accent-[#A86800]" />
              Also move {p.name} to {STAGES.client.label}, same company
            </label>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

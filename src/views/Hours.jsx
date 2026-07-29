import { useState } from 'react'
import { Clock, Download, ChevronDown, ChevronUp, Settings2, Pencil, Table2, LayoutList } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'
import { generateInvoicePDF } from '../utils/invoicePDF'
import { TimeLedger } from '../components/TimeLedger'

export function Hours({
  tasks, companies, projects, invoiceProfile, onSaveProfile, onSaveInvoice, onEditTask,
  onPatchEntry, onMoveEntries, onDeleteEntries, onAddEntry,
}) {
  const [tab, setTab] = useState('summary')  // summary | ledger
  const [expandedClient, setExpandedClient] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [range, setRange] = useState('month') // week | month | all | custom
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [profile, setProfile] = useState(invoiceProfile)

  // Resolve the active [start, end] date strings for the current range
  const resolveWindow = () => {
    const today = new Date()
    const iso = (d) => `${d.getFullYear()}-${timeUtils.pad2(d.getMonth()+1)}-${timeUtils.pad2(d.getDate())}`
    if (range === 'all') return { start: null, end: null }
    if (range === 'custom') return { start: customStart, end: customEnd }
    if (range === 'week') {
      const s = new Date(today); const day = today.getDay(); const diff = day === 0 ? -6 : 1 - day
      s.setDate(today.getDate() + diff)
      const e = new Date(s); e.setDate(s.getDate() + 6)
      return { start: iso(s), end: iso(e) }
    }
    const s = new Date(today.getFullYear(), today.getMonth(), 1)
    const e = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start: iso(s), end: iso(e) }
  }
  const windowRange = resolveWindow()

  // Filter time entries by the resolved window (inclusive)
  const inRange = (entry) => {
    if (range === 'all') return true
    const d = timeUtils.localDate(entry.end || entry.start)
    if (!d) return false
    return (!windowRange.start || d >= windowRange.start) && (!windowRange.end || d <= windowRange.end)
  }

  // Aggregate hours by client, honoring per-entry billable and rate overrides
  const clientData = companies.map(co => {
    const coTasks = tasks.filter(t => t.companyId === co.id)
    let totalSecs = 0
    let amount = 0
    const taskBreakdown = []
    coTasks.forEach(t => {
      const entries = (t.timeEntries || []).filter(inRange)
      if (entries.length === 0) return
      const secs = entries.reduce((s, e) => s + (e.seconds || 0), 0)
      if (secs < 1) return
      totalSecs += secs
      const rateGroups = {}
      entries.forEach(e => {
        if (!timeUtils.isBillable(e, co)) return
        const r = timeUtils.rateFor(e, co)
        rateGroups[r] = (rateGroups[r] || 0) + (e.seconds || 0)
      })
      const taskAmount = Object.entries(rateGroups)
        .reduce((s, [r, sec]) => s + timeUtils.toHours(sec) * Number(r), 0)
      amount += taskAmount
      taskBreakdown.push({ id: t.id, title: t.title, seconds: secs, projectId: t.projectId, rateGroups, amount: taskAmount })
    })
    return { company: co, totalSecs, hours: timeUtils.toHours(totalSecs), taskBreakdown, amount }
  }).filter(c => c.totalSecs > 0)

  const grandTotalHours = clientData.reduce((s, c) => s + c.hours, 0)
  const grandTotalBillable = clientData.reduce((s, c) => s + c.amount, 0)

  const handleGenerateInvoice = (clientInfo) => {
    const lineItems = []
    clientInfo.taskBreakdown.forEach(tb => {
      const project = projects.find(p => p.id === tb.projectId)
      const base = project ? `${project.name}: ${tb.title}` : tb.title
      const rates = Object.entries(tb.rateGroups)
      rates.forEach(([r, sec]) => {
        const hours = timeUtils.toHours(sec)
        lineItems.push({
          description: rates.length > 1 ? `${base} (@ $${r}/hr)` : base,
          hours, rate: Number(r), amount: hours * Number(r),
        })
      })
    })
    const invoiceData = {
      number: profile.nextNumber || 1001,
      date: dateUtils.today(),
      client: clientInfo.company.name,
      profile,
      lineItems,
      total: clientInfo.amount,
      periodLabel: range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'all' ? 'All Time'
        : `${dateUtils.format(customStart, 'medium')} to ${dateUtils.format(customEnd, 'medium')}`,
    }
    generateInvoicePDF(invoiceData)
    onSaveInvoice({ number: invoiceData.number, client: clientInfo.company.name, total: clientInfo.amount, date: invoiceData.date })
  }

  const saveProfileLocal = () => { onSaveProfile(profile); setShowProfile(false) }
  const wide = tab === 'ledger' ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className="h-full flex flex-col">
      <div className={`px-4 pt-5 pb-3 flex-shrink-0 ${wide} mx-auto w-full`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Hours &amp; Invoices</h1>
            <p className="text-navy-500 text-sm mt-0.5">{grandTotalHours.toFixed(1)}h tracked · ${grandTotalBillable.toFixed(0)} billable</p>
          </div>
          <button onClick={() => setShowProfile(true)} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"><Settings2 size={13} /> Business Info</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3 border-b border-surface-200">
          {[['summary', 'Summary', LayoutList], ['ledger', 'Ledger', Table2]].map(([v, l, Icon]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`text-xs font-display font-semibold px-3 py-2 -mb-px border-b-2 flex items-center gap-1.5 transition-colors ${tab === v ? 'border-navy-800 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-600'}`}>
              <Icon size={13} /> {l}
            </button>
          ))}
        </div>

        {/* Range toggle */}
        <div className="flex flex-wrap gap-2">
          {[['week','This Week'],['month','This Month'],['all','All Time'],['custom','Custom']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`text-xs font-display font-semibold px-3 py-1.5 rounded-lg border transition-all ${range === v ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500 hover:border-navy-400'}`}>
              {l}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-base px-2.5 py-1.5 text-xs" />
            <span className="text-navy-400 text-xs">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-base px-2.5 py-1.5 text-xs" />
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto px-4 pb-4 space-y-3 ${wide} mx-auto w-full`}>
        {tab === 'ledger' ? (
          <TimeLedger
            tasks={tasks} companies={companies} projects={projects}
            windowRange={windowRange} rangeIsAll={range === 'all'}
            onPatch={onPatchEntry} onMove={onMoveEntries} onDelete={onDeleteEntries} onAddEntry={onAddEntry}
          />
        ) : clientData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Clock size={32} className="text-surface-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">No time tracked yet</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">Hit the ▶ Track button on any task to start logging time</p>
          </div>
        ) : (
          clientData.map(cd => {
            const isOpen = expandedClient === cd.company.id
            return (
              <div key={cd.company.id} className="card overflow-hidden">
                <button onClick={() => setExpandedClient(isOpen ? null : cd.company.id)} className="w-full p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cd.company.color}15` }}>
                    <span className="text-base">{cd.company.emoji}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-semibold text-navy-900 text-sm">{cd.company.name}</p>
                    <p className="text-xs text-navy-400">{cd.hours.toFixed(1)} hours{cd.company.billable && ` · $${cd.company.hourlyRate}/hr`}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {cd.amount > 0
                      ? <p className="font-display font-bold text-forest-600">${cd.amount.toFixed(0)}</p>
                      : <p className="text-xs text-navy-400 italic">non-billable</p>}
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-navy-400" /> : <ChevronDown size={16} className="text-navy-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-surface-200 px-4 py-3 bg-surface-100 space-y-2">
                    {cd.taskBreakdown.map(tb => {
                      const project = projects.find(p => p.id === tb.projectId)
                      return (
                        <button key={tb.id} onClick={() => onEditTask && onEditTask(tb.id)} className="w-full flex items-center justify-between text-sm hover:bg-white rounded-lg px-2 py-1.5 -mx-2 transition-colors group">
                          <span className="text-navy-600 flex-1 min-w-0 truncate text-left">{project ? `${project.name}: ` : ''}{tb.title}</span>
                          <span className="text-navy-400 flex-shrink-0 ml-2 flex items-center gap-1.5">
                            {timeUtils.formatDuration(tb.seconds)}
                            <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </button>
                      )
                    })}
                    {cd.amount > 0 ? (
                      <button onClick={() => handleGenerateInvoice(cd)} className="w-full mt-2 btn-primary py-2.5 text-sm flex items-center justify-center gap-2">
                        <Download size={14} /> Generate Invoice PDF (${cd.amount.toFixed(0)})
                      </button>
                    ) : (
                      <p className="text-xs text-navy-400 text-center pt-1">Mark this client billable in Settings to invoice</p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Business profile modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={e => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-modal">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-display font-bold text-navy-900">Business Info</h2>
              <button onClick={() => setShowProfile(false)} className="p-1.5 text-navy-400">✕</button>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <p className="text-xs text-navy-500">This appears on your invoices.</p>
              <input value={profile.businessName||''} onChange={e => setProfile(p => ({...p, businessName: e.target.value}))} placeholder="Business name" className="w-full input-base px-4 py-2.5 text-sm" />
              <input value={profile.businessEmail||''} onChange={e => setProfile(p => ({...p, businessEmail: e.target.value}))} placeholder="Email" className="w-full input-base px-4 py-2.5 text-sm" />
              <textarea value={profile.businessAddress||''} onChange={e => setProfile(p => ({...p, businessAddress: e.target.value}))} placeholder="Address" rows={2} className="w-full input-base px-4 py-2.5 text-sm resize-none" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-navy-500">Next invoice #</span>
                <input type="number" value={profile.nextNumber||1001} onChange={e => setProfile(p => ({...p, nextNumber: parseInt(e.target.value)||1001}))} className="input-base px-3 py-1.5 text-sm w-24" />
              </div>
              <button onClick={saveProfileLocal} className="w-full btn-primary py-2.5 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

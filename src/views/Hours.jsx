import { useState } from 'react'
import { Clock, FileText, Download, ChevronDown, ChevronUp, DollarSign, Settings2 } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'
import { timeUtils } from '../utils/timeUtils'
import { generateInvoicePDF } from '../utils/invoicePDF'

export function Hours({ tasks, companies, projects, invoiceProfile, onSaveProfile, onSaveInvoice }) {
  const [expandedClient, setExpandedClient] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [range, setRange] = useState('week') // week | month | all
  const [profile, setProfile] = useState(invoiceProfile)

  const billableCompanies = companies.filter(c => c.billable)

  // Filter time entries by range
  const inRange = (entry) => {
    if (range === 'all') return true
    const d = entry.end?.split('T')[0]
    if (range === 'week') return dateUtils.isThisWeek(d)
    if (range === 'month') {
      const now = new Date(), ed = new Date(d + 'T12:00:00')
      return ed.getMonth() === now.getMonth() && ed.getFullYear() === now.getFullYear()
    }
    return true
  }

  // Aggregate hours by client
  const clientData = companies.map(co => {
    const coTasks = tasks.filter(t => t.companyId === co.id)
    let totalSecs = 0
    const taskBreakdown = []
    coTasks.forEach(t => {
      const secs = (t.timeEntries || []).filter(inRange).reduce((s, e) => s + e.seconds, 0)
      if (secs > 0) {
        totalSecs += secs
        taskBreakdown.push({ id: t.id, title: t.title, seconds: secs, projectId: t.projectId })
      }
    })
    return { company: co, totalSecs, hours: timeUtils.toHours(totalSecs), taskBreakdown, amount: timeUtils.toHours(totalSecs) * (co.hourlyRate || 0) }
  }).filter(c => c.totalSecs > 0)

  const grandTotalHours = clientData.reduce((s, c) => s + c.hours, 0)
  const grandTotalBillable = clientData.filter(c => c.company.billable).reduce((s, c) => s + c.amount, 0)

  const handleGenerateInvoice = (clientInfo) => {
    const lineItems = clientInfo.taskBreakdown.map(tb => {
      const project = projects.find(p => p.id === tb.projectId)
      return {
        description: project ? `${project.name}: ${tb.title}` : tb.title,
        hours: timeUtils.toHours(tb.seconds),
        rate: clientInfo.company.hourlyRate,
        amount: timeUtils.toHours(tb.seconds) * clientInfo.company.hourlyRate,
      }
    })
    const invoiceData = {
      number: profile.nextNumber || 1001,
      date: dateUtils.today(),
      client: clientInfo.company.name,
      profile,
      lineItems,
      total: clientInfo.amount,
      periodLabel: range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time',
    }
    generateInvoicePDF(invoiceData)
    onSaveInvoice({ number: invoiceData.number, client: clientInfo.company.name, total: clientInfo.amount, date: invoiceData.date })
  }

  const saveProfileLocal = () => { onSaveProfile(profile); setShowProfile(false) }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-3 flex-shrink-0 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-navy-900 text-xl">Hours & Invoices</h1>
            <p className="text-navy-500 text-sm mt-0.5">{grandTotalHours.toFixed(1)}h tracked · ${grandTotalBillable.toFixed(0)} billable</p>
          </div>
          <button onClick={() => setShowProfile(true)} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"><Settings2 size={13} /> Business Info</button>
        </div>
        {/* Range toggle */}
        <div className="flex gap-2">
          {[['week','This Week'],['month','This Month'],['all','All Time']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`text-xs font-display font-semibold px-3 py-1.5 rounded-lg border transition-all ${range === v ? 'bg-navy-800 border-navy-800 text-white' : 'border-surface-300 text-navy-500 hover:border-navy-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 max-w-3xl mx-auto w-full">
        {clientData.length === 0 ? (
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
                    {cd.company.billable
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
                        <div key={tb.id} className="flex items-center justify-between text-sm">
                          <span className="text-navy-600 flex-1 min-w-0 truncate">{project ? `${project.name}: ` : ''}{tb.title}</span>
                          <span className="text-navy-400 flex-shrink-0 ml-2">{timeUtils.formatDuration(tb.seconds)}</span>
                        </div>
                      )
                    })}
                    {cd.company.billable && (
                      <button onClick={() => handleGenerateInvoice(cd)} className="w-full mt-2 btn-primary py-2.5 text-sm flex items-center justify-center gap-2">
                        <Download size={14} /> Generate Invoice PDF (${cd.amount.toFixed(0)})
                      </button>
                    )}
                    {!cd.company.billable && (
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

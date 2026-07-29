import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Pencil, Check, X, Trash2, Plus, Download, Search } from 'lucide-react'
import { timeUtils } from '../utils/timeUtils'

const BILL_MODES = { inherit: 'Inherit', yes: 'Billable', no: 'Non-bill' }

export function TimeLedger({
  tasks = [], companies = [], projects = [],
  windowRange, rangeIsAll,
  onPatch, onMove, onDelete, onAddEntry,
}) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [fClient, setFClient] = useState('all')
  const [fProject, setFProject] = useState('all')
  const [fBill, setFBill] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null)   // entryId being edited
  const [draft, setDraft] = useState(null)
  const [moveAsk, setMoveAsk] = useState(null)   // { refs, target, taskCount, label }
  const [showAdd, setShowAdd] = useState(false)
  const [showBulkMove, setShowBulkMove] = useState(false)
  const [bulkTarget, setBulkTarget] = useState({ companyId: '', projectId: '' })
  const [newRow, setNewRow] = useState({
    date: new Date().toISOString().split('T')[0], hours: '1', companyId: '', projectId: '', taskId: '', note: '',
  })

  const companyById = useMemo(() => Object.fromEntries(companies.map(c => [c.id, c])), [companies])
  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  // ── Flatten every entry into a row ───────────────────────────────
  const allRows = useMemo(() => {
    const out = []
    tasks.forEach(t => {
      (t.timeEntries || []).forEach(e => {
        const company = t.companyId ? companyById[t.companyId] : null
        const project = t.projectId ? projectById[t.projectId] : null
        const date = timeUtils.localDate(e.end || e.start) || ''
        out.push({
          key: e.id, entry: e, task: t, company, project, date,
          start: timeUtils.localTime(e.start),
          end: timeUtils.localTime(e.end),
          hours: timeUtils.toHours(e.seconds || 0),
          billable: timeUtils.isBillable(e, company),
          rate: timeUtils.rateFor(e, company),
          amount: timeUtils.amountFor(e, company),
          clientName: company ? company.name : 'Unassigned',
          projectName: project ? project.name : '',
        })
      })
    })
    return out
  }, [tasks, companyById, projectById])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = allRows.filter(r => {
      if (!rangeIsAll) {
        if (!r.date) return false
        if (windowRange.start && r.date < windowRange.start) return false
        if (windowRange.end && r.date > windowRange.end) return false
      }
      if (fClient !== 'all') {
        if (fClient === 'none' ? r.task.companyId : r.task.companyId !== fClient) return false
      }
      if (fProject !== 'all') {
        if (fProject === 'none' ? r.task.projectId : r.task.projectId !== fProject) return false
      }
      if (fBill === 'yes' && !r.billable) return false
      if (fBill === 'no' && r.billable) return false
      if (q) {
        const hay = `${r.task.title} ${r.clientName} ${r.projectName} ${r.entry.note || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (r) => {
      switch (sortKey) {
        case 'client': return r.clientName.toLowerCase()
        case 'project': return r.projectName.toLowerCase()
        case 'task': return (r.task.title || '').toLowerCase()
        case 'hours': return r.hours
        case 'amount': return r.amount
        case 'billable': return r.billable ? 1 : 0
        default: return `${r.date} ${r.start}`
      }
    }
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [allRows, search, fClient, fProject, fBill, sortKey, sortDir, windowRange, rangeIsAll])

  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
  const billableHours = rows.filter(r => r.billable).reduce((s, r) => s + r.hours, 0)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
  }

  const SortHead = ({ label, k, align = 'left', className = '' }) => (
    <th className={`px-2 py-2 font-semibold text-navy-500 whitespace-nowrap text-${align} ${className}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-navy-800 transition-colors">
        {label}
        {sortKey === k && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
  )

  // ── Selection ────────────────────────────────────────────────────
  const toggleRow = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.key))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.key)))
  const selectedRows = rows.filter(r => selected.has(r.key))

  // ── Editing ──────────────────────────────────────────────────────
  const startEdit = (r) => {
    setEditing(r.key)
    setDraft({
      date: r.date,
      start: r.start || '',
      end: r.end || '',
      hours: String(r.hours),
      companyId: r.task.companyId || '',
      projectId: r.task.projectId || '',
      taskId: r.task.id,
      note: r.entry.note || '',
      billMode: r.entry.billable === undefined || r.entry.billable === null ? 'inherit' : (r.entry.billable ? 'yes' : 'no'),
      rate: r.entry.rate === undefined || r.entry.rate === null ? '' : String(r.entry.rate),
    })
  }
  const cancelEdit = () => { setEditing(null); setDraft(null) }

  // Times drive duration, duration drives the end time. Whichever you touch last wins.
  const setTimes = (patch) => setDraft(d => {
    const next = { ...d, ...patch }
    if (patch.start !== undefined || patch.end !== undefined) {
      if (next.start && next.end) {
        const s = new Date(`${next.date || '2000-01-01'}T${next.start}:00`)
        let e = new Date(`${next.date || '2000-01-01'}T${next.end}:00`)
        if (e < s) e = new Date(e.getTime() + 86400000)
        next.hours = String(timeUtils.toHours(Math.round((e - s) / 1000)))
      }
    }
    if (patch.hours !== undefined && next.start) {
      const secs = timeUtils.parseHours(next.hours)
      const s = new Date(`${next.date || '2000-01-01'}T${next.start}:00`)
      const e = new Date(s.getTime() + secs * 1000)
      next.end = `${timeUtils.pad2(e.getHours())}:${timeUtils.pad2(e.getMinutes())}`
    }
    return next
  })

  const saveEdit = (r) => {
    const seconds = timeUtils.parseHours(draft.hours)
    if (seconds < 1) { cancelEdit(); return }
    const startISO = timeUtils.toISO(draft.date, draft.start || '12:00')
    let endISO = draft.end ? timeUtils.toISO(draft.date, draft.end) : startISO
    if (startISO && endISO && new Date(endISO) < new Date(startISO)) {
      endISO = new Date(new Date(endISO).getTime() + 86400000).toISOString()
    }
    onPatch(r.task.id, r.entry.id, {
      seconds,
      start: startISO,
      end: endISO,
      note: draft.note,
      manual: !!r.entry.manual,
      billable: draft.billMode === 'inherit' ? null : draft.billMode === 'yes',
      rate: draft.rate === '' ? null : Number(draft.rate),
    })

    const newCompany = draft.companyId || null
    const newProject = draft.projectId || null
    const taskChanged = draft.taskId !== r.task.id
    const tagChanged = newCompany !== (r.task.companyId || null) || newProject !== (r.task.projectId || null)

    if (taskChanged) {
      onMove([{ taskId: r.task.id, entryId: r.entry.id }], { taskId: draft.taskId }, 'entry')
    } else if (tagChanged) {
      const siblingCount = (r.task.timeEntries || []).length
      setMoveAsk({
        refs: [{ taskId: r.task.id, entryId: r.entry.id }],
        target: { companyId: newCompany, projectId: newProject, title: r.task.title },
        siblingCount,
        label: r.task.title,
      })
    }
    cancelEdit()
  }

  const confirmMove = (mode) => {
    if (moveAsk) onMove(moveAsk.refs, moveAsk.target, mode)
    setMoveAsk(null)
    setSelected(new Set())
  }

  const removeRows = (refs) => {
    onDelete(refs)
    setSelected(new Set())
  }

  const applyBulkMove = () => {
    const refs = selectedRows.map(r => ({ taskId: r.task.id, entryId: r.entry.id }))
    const taskIds = new Set(selectedRows.map(r => r.task.id))
    setShowBulkMove(false)
    setMoveAsk({
      refs,
      target: { companyId: bulkTarget.companyId || null, projectId: bulkTarget.projectId || null },
      siblingCount: null,
      label: `${refs.length} entries across ${taskIds.size} task${taskIds.size === 1 ? '' : 's'}`,
    })
  }

  const addEntry = () => {
    const seconds = timeUtils.parseHours(newRow.hours)
    if (seconds < 1) return
    onAddEntry({
      companyId: newRow.companyId || null,
      projectId: newRow.projectId || null,
      taskId: newRow.taskId || null,
      seconds,
      dateStr: newRow.date,
      title: newRow.note || 'Tracked time',
    })
    setShowAdd(false)
    setNewRow(n => ({ ...n, hours: '1', note: '' }))
  }

  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['Date', 'Start', 'End', 'Hours', 'Client', 'Project', 'Task', 'Note', 'Billable', 'Rate', 'Amount']
    const lines = rows.map(r => [
      r.date, r.start, r.end, r.hours.toFixed(2), r.clientName, r.projectName, r.task.title,
      r.entry.note || '', r.billable ? 'Yes' : 'No', r.rate.toFixed(2), r.amount.toFixed(2),
    ].map(esc).join(','))
    const csv = [head.map(esc).join(','), ...lines].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `sprinthq-hours-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const taskOptions = (companyId) => {
    const scoped = companyId ? tasks.filter(t => t.companyId === companyId) : tasks
    return [...scoped].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  }
  const projectOptions = (companyId) => (companyId ? projects.filter(p => p.companyId === companyId) : projects)

  const cell = 'px-2 py-1.5 align-middle'
  const mini = 'input-base px-1.5 py-1 text-xs w-full'

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task, client, note"
            className="input-base pl-7 pr-2.5 py-1.5 text-xs w-full" />
        </div>
        <select value={fClient} onChange={e => setFClient(e.target.value)} className="input-base px-2 py-1.5 text-xs">
          <option value="all">All clients</option>
          <option value="none">Unassigned</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fProject} onChange={e => setFProject(e.target.value)} className="input-base px-2 py-1.5 text-xs">
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fBill} onChange={e => setFBill(e.target.value)} className="input-base px-2 py-1.5 text-xs">
          <option value="all">Billable + non</option>
          <option value="yes">Billable only</option>
          <option value="no">Non-billable</option>
        </select>
        <button onClick={() => setShowAdd(s => !s)} className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1"><Plus size={12} /> Entry</button>
        <button onClick={exportCSV} className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1"><Download size={12} /> CSV</button>
      </div>

      {/* Add row */}
      {showAdd && (
        <div className="card p-3 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-navy-500">Date
            <input type="date" value={newRow.date} onChange={e => setNewRow(n => ({ ...n, date: e.target.value }))} className={`${mini} mt-0.5`} />
          </label>
          <label className="text-[11px] text-navy-500">Hours
            <input value={newRow.hours} onChange={e => setNewRow(n => ({ ...n, hours: e.target.value }))} placeholder="1.5 or 1:30" className={`${mini} mt-0.5 w-24`} />
          </label>
          <label className="text-[11px] text-navy-500">Client
            <select value={newRow.companyId} onChange={e => setNewRow(n => ({ ...n, companyId: e.target.value, projectId: '', taskId: '' }))} className={`${mini} mt-0.5`}>
              <option value="">Unassigned</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-navy-500">Project
            <select value={newRow.projectId} onChange={e => setNewRow(n => ({ ...n, projectId: e.target.value }))} className={`${mini} mt-0.5`}>
              <option value="">None</option>
              {projectOptions(newRow.companyId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-navy-500">Task
            <select value={newRow.taskId} onChange={e => setNewRow(n => ({ ...n, taskId: e.target.value }))} className={`${mini} mt-0.5`}>
              <option value="">New / tracked time</option>
              {taskOptions(newRow.companyId).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-navy-500 flex-1 min-w-[140px]">Note
            <input value={newRow.note} onChange={e => setNewRow(n => ({ ...n, note: e.target.value }))} placeholder="What was this?" className={`${mini} mt-0.5`} />
          </label>
          <button onClick={addEntry} className="btn-primary px-3 py-1.5 text-xs">Add</button>
          <button onClick={() => setShowAdd(false)} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
        </div>
      )}

      {/* Totals */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-navy-500">
        <span><strong className="text-navy-900 font-display">{rows.length}</strong> entries</span>
        <span><strong className="text-navy-900 font-display">{totalHours.toFixed(2)}h</strong> total</span>
        <span>{billableHours.toFixed(2)}h billable</span>
        <span className="text-forest-600 font-display font-bold">${totalAmount.toFixed(2)}</span>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-surface-100 border-b border-surface-200">
            <tr>
              <th className="px-2 py-2 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-navy-800" />
              </th>
              <SortHead label="Date" k="date" />
              <th className="px-2 py-2 font-semibold text-navy-500">Start</th>
              <th className="px-2 py-2 font-semibold text-navy-500">End</th>
              <SortHead label="Hours" k="hours" align="right" />
              <SortHead label="Client" k="client" />
              <SortHead label="Project" k="project" />
              <SortHead label="Task" k="task" />
              <th className="px-2 py-2 font-semibold text-navy-500">Note</th>
              <SortHead label="Bill" k="billable" />
              <th className="px-2 py-2 font-semibold text-navy-500 text-right">Rate</th>
              <SortHead label="Amount" k="amount" align="right" />
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-10 text-center text-navy-400">No entries in this range</td></tr>
            )}
            {rows.map(r => {
              const isEdit = editing === r.key
              if (isEdit) {
                return (
                  <tr key={r.key} className="border-b border-surface-200 bg-gold-50/40">
                    <td className={cell}></td>
                    <td className={cell}><input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className={mini} /></td>
                    <td className={cell}><input type="time" value={draft.start} onChange={e => setTimes({ start: e.target.value })} className={mini} /></td>
                    <td className={cell}><input type="time" value={draft.end} onChange={e => setTimes({ end: e.target.value })} className={mini} /></td>
                    <td className={cell}><input value={draft.hours} onChange={e => setTimes({ hours: e.target.value })} className={`${mini} text-right w-16`} /></td>
                    <td className={cell}>
                      <select value={draft.companyId} onChange={e => setDraft(d => ({ ...d, companyId: e.target.value, projectId: '' }))} className={mini}>
                        <option value="">Unassigned</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className={cell}>
                      <select value={draft.projectId} onChange={e => setDraft(d => ({ ...d, projectId: e.target.value }))} className={mini}>
                        <option value="">None</option>
                        {projectOptions(draft.companyId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className={cell}>
                      <select value={draft.taskId} onChange={e => setDraft(d => ({ ...d, taskId: e.target.value }))} className={mini}>
                        {taskOptions(draft.companyId).some(t => t.id === draft.taskId)
                          ? null
                          : <option value={r.task.id}>{r.task.title}</option>}
                        {taskOptions(draft.companyId).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                    </td>
                    <td className={cell}><input value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} className={mini} /></td>
                    <td className={cell}>
                      <select value={draft.billMode} onChange={e => setDraft(d => ({ ...d, billMode: e.target.value }))} className={mini}>
                        {Object.entries(BILL_MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className={cell}><input value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))} placeholder={String(r.company?.hourlyRate || 0)} className={`${mini} text-right w-16`} /></td>
                    <td className={`${cell} text-right text-navy-400`}>—</td>
                    <td className={cell}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => saveEdit(r)} className="p-1 text-forest-600 hover:bg-forest-50 rounded"><Check size={13} /></button>
                        <button onClick={cancelEdit} className="p-1 text-navy-400 hover:bg-surface-100 rounded"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={r.key} className={`border-b border-surface-100 hover:bg-surface-50 group ${selected.has(r.key) ? 'bg-surface-200' : ''}`}>
                  <td className={cell}><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggleRow(r.key)} className="accent-navy-800" /></td>
                  <td className={`${cell} whitespace-nowrap text-navy-700`}>{r.date || '—'}</td>
                  <td className={`${cell} text-navy-400 whitespace-nowrap`}>{r.start || '—'}</td>
                  <td className={`${cell} text-navy-400 whitespace-nowrap`}>{r.end || '—'}</td>
                  <td className={`${cell} text-right font-display font-semibold text-navy-900`}>{r.hours.toFixed(2)}</td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1.5">
                      {r.company && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.company.color }} />}
                      <span className={r.company ? 'text-navy-700' : 'text-navy-300 italic'}>{r.clientName}</span>
                    </span>
                  </td>
                  <td className={`${cell} text-navy-500 max-w-[130px] truncate`}>{r.projectName || '—'}</td>
                  <td className={`${cell} text-navy-600 max-w-[180px] truncate`}>{r.task.title}</td>
                  <td className={`${cell} text-navy-400 max-w-[140px] truncate`}>{r.entry.note || (r.entry.manual ? 'manual' : '')}</td>
                  <td className={cell}>
                    {r.billable
                      ? <span className="text-forest-600 font-semibold">Yes</span>
                      : <span className="text-navy-300">No</span>}
                    {r.entry.billable !== undefined && r.entry.billable !== null && <span className="text-gold-600 ml-0.5">*</span>}
                  </td>
                  <td className={`${cell} text-right text-navy-500`}>
                    {r.billable ? `$${r.rate}` : '—'}
                    {r.entry.rate !== undefined && r.entry.rate !== null && <span className="text-gold-600 ml-0.5">*</span>}
                  </td>
                  <td className={`${cell} text-right font-display font-semibold ${r.amount > 0 ? 'text-forest-600' : 'text-navy-300'}`}>
                    {r.amount > 0 ? `$${r.amount.toFixed(2)}` : '—'}
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(r)} className="p-1 text-navy-400 hover:text-gold-600 rounded"><Pencil size={12} /></button>
                      <button onClick={() => removeRows([{ taskId: r.task.id, entryId: r.entry.id }])} className="p-1 text-navy-400 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-surface-100 border-t border-surface-200 font-display font-bold text-navy-900">
                <td colSpan={4} className="px-2 py-2 text-right text-navy-500 font-semibold">Total</td>
                <td className="px-2 py-2 text-right">{totalHours.toFixed(2)}</td>
                <td colSpan={6}></td>
                <td className="px-2 py-2 text-right text-forest-600">${totalAmount.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-navy-400">A gold asterisk marks an entry that overrides its client's billable setting or rate.</p>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-navy-900 text-white rounded-xl shadow-modal px-4 py-2.5 flex items-center gap-3 z-40">
          <span className="text-xs font-display font-semibold">{selected.size} selected</span>
          <button onClick={() => setShowBulkMove(true)} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">Reassign</button>
          <button onClick={() => removeRows(selectedRows.map(r => ({ taskId: r.task.id, entryId: r.entry.id })))} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 transition-colors">Delete</button>
          <button onClick={() => setSelected(new Set())} className="text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Bulk reassign picker */}
      {showBulkMove && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowBulkMove(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-modal p-5 space-y-3">
            <h3 className="font-display font-bold text-navy-900">Reassign {selected.size} entries</h3>
            <select value={bulkTarget.companyId} onChange={e => setBulkTarget(t => ({ companyId: e.target.value, projectId: '' }))} className="w-full input-base px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={bulkTarget.projectId} onChange={e => setBulkTarget(t => ({ ...t, projectId: e.target.value }))} className="w-full input-base px-3 py-2 text-sm">
              <option value="">No project</option>
              {projectOptions(bulkTarget.companyId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={applyBulkMove} className="btn-primary px-4 py-2 text-sm flex-1">Continue</button>
              <button onClick={() => setShowBulkMove(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Move confirmation */}
      {moveAsk && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setMoveAsk(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-modal p-5 space-y-3">
            <h3 className="font-display font-bold text-navy-900">How far should this move go?</h3>
            <p className="text-sm text-navy-500">
              {moveAsk.siblingCount !== null
                ? <>This time sits on <span className="font-semibold text-navy-700">{moveAsk.label}</span>, which holds {moveAsk.siblingCount} {moveAsk.siblingCount === 1 ? 'entry' : 'entries'}.</>
                : <>You're reassigning {moveAsk.label}.</>}
            </p>
            <button onClick={() => confirmMove('entry')} className="w-full text-left border border-surface-300 hover:border-navy-400 rounded-xl px-4 py-3 transition-colors">
              <p className="font-display font-semibold text-navy-900 text-sm">Move the time only</p>
              <p className="text-xs text-navy-500 mt-0.5">The entry lands under the new client. The task stays where it is.</p>
            </button>
            <button onClick={() => confirmMove('task')} className="w-full text-left border border-surface-300 hover:border-navy-400 rounded-xl px-4 py-3 transition-colors">
              <p className="font-display font-semibold text-navy-900 text-sm">Move the whole task</p>
              <p className="text-xs text-navy-500 mt-0.5">The task and every entry on it move together.</p>
            </button>
            <button onClick={() => setMoveAsk(null)} className="w-full btn-ghost py-2 text-sm">Leave it where it is</button>
          </div>
        </div>
      )}
    </div>
  )
}

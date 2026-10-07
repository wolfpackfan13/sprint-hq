import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Inbox, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { Avatar } from '../components/relationships/bits'
import { ContactDetail } from '../components/relationships/ContactDetail'
import { ContactForm } from '../components/relationships/ContactForm'
import { ConvertSheet } from '../components/relationships/ConvertSheet'
import { ReviewSheet } from '../components/relationships/ReviewSheet'
import { NextTouchModal } from '../components/relationships/NextTouchModal'
import { LogConversationModal } from '../components/relationships/LogConversationModal'
import {
  STAGES, STAGE_ORDER, SEGMENTS, NETWORK_LABELS, DEMO_MASK,
  stageOf, segmentOf, touchStatus, touchLabel, meetingsForContact, meetingBlurb,
  lastContactDate, openTasksForContact, companyNameFor, sortContacts, hiddenInDemo,
} from '../utils/relationships'
import { dateUtils } from '../utils/dateUtils'
import { genId as makeId } from '../utils/ids'

const GROUP_LABELS = { stage: 'Stage', company: 'Company', none: 'None' }
const SORT_LABELS = { next: 'Next touch', last: 'Last contact', name: 'Name' }

function ContactRow({ contact, company, linked, lastDate, openTaskCount, selected, demoMode, onSelect }) {
  const segment = segmentOf(contact)
  const status = touchStatus(contact.nextTouchOn)
  const last = linked[0]
  const second = segment === 'clients'
    ? [contact.role, openTaskCount ? `${openTaskCount} open task${openTaskCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || companyNameFor(contact, [company].filter(Boolean))
    : segment === 'network' && contact.networkLabel
      ? [contact.company, NETWORK_LABELS[contact.networkLabel]].filter(Boolean).join(' · ')
      : (contact.company || 'Independent')
  const third = last
    ? `${dateUtils.format(last.date, 'short')} · ${demoMode ? DEMO_MASK : (meetingBlurb(last) || last.title || 'Conversation')}`
    : lastDate ? `Last contact ${dateUtils.format(lastDate, 'short')}` : ''

  return (
    <button onClick={() => onSelect(contact.id)} aria-current={selected ? 'true' : undefined}
      className={`w-full flex gap-3 p-3 rounded-xl text-left transition-all border ${selected ? 'border-gold-500 bg-gold-50' : status === 'overdue' ? 'border-[#F3C4C4] bg-white hover:shadow-card-hover' : 'border-surface-300 bg-white hover:shadow-card-hover'}`}>
      <Avatar contact={contact} company={company} size={36} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex justify-between gap-2">
          <span className="text-sm font-semibold text-navy-900 truncate">{contact.name || contact.email}</span>
          {contact.nextTouchOn ? (
            <span className={`text-xs flex-shrink-0 ${status === 'overdue' ? 'text-red-700 font-semibold' : status === 'today' ? 'text-[#8A5500] font-semibold' : 'text-navy-600'}`}>
              {touchLabel(contact.nextTouchOn)}
            </span>
          ) : segment === 'leads' ? (
            <span className="text-xs flex-shrink-0 text-navy-500">No next touch</span>
          ) : null}
        </span>
        {second && <span className="text-xs text-navy-600 truncate">{second}</span>}
        {third && <span className="text-xs text-navy-600 truncate">{third}</span>}
      </span>
    </button>
  )
}

export function Relationships({
  contacts, allContacts, companies, meetings, tasks, demoMode,
  focusContactId, onFocusHandled,
  onAdd, onUpdate, onUpdateMany, onDelete, onCompleteTouch,
  onAddMeeting, onAddCompany, onDeleteCompany,
  onCompleteTask, onEditTask, onOpenClient, onIgnoreEmail, showToast,
}) {
  const [tab, setTab] = useState('leads')
  const [group, setGroup] = useState('stage')
  const [sort, setSort] = useState('next')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const [form, setForm] = useState(null)          // { contact?, defaultStage }
  const [reviewOpen, setReviewOpen] = useState(false)
  const [convertId, setConvertId] = useState(null)
  const [touch, setTouch] = useState(null)        // { mode, contactId, stage? }
  const [logId, setLogId] = useState(null)

  const people = useMemo(() => (allContacts || contacts).filter(c => !hiddenInDemo(c, demoMode)), [allContacts, contacts, demoMode])
  const visible = useMemo(() => contacts.filter(c => !hiddenInDemo(c, demoMode)), [contacts, demoMode])

  const linkedById = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = meetingsForContact(c, meetings) })
    return map
  }, [people, meetings])

  const lastDates = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = lastContactDate(c, linkedById[c.id] || []) })
    return map
  }, [people, linkedById])

  const openTasksById = useMemo(() => {
    const map = {}
    people.forEach(c => { map[c.id] = openTasksForContact(linkedById[c.id] || [], tasks) })
    return map
  }, [people, linkedById, tasks])

  const reviewQueue = visible.filter(c => stageOf(c) === 'needs_review')
  const counts = Object.fromEntries(SEGMENTS.map(s => [s.id, visible.filter(c => segmentOf(c) === s.id).length]))

  const pickTab = (id) => {
    const seg = SEGMENTS.find(s => s.id === id)
    setTab(id); setGroup(seg.defaultGroup); setSort(seg.defaultSort); setShowPast(false)
  }

  // Jump to a person from Today or the calendar.
  useEffect(() => {
    if (!focusContactId) return
    const c = people.find(x => x.id === focusContactId)
    if (c) {
      const seg = segmentOf(c)
      if (seg !== 'inbox' && seg !== tab) pickTab(seg)
      setSelectedId(c.id)
      setMobileDetail(true)
    }
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusContactId])

  const q = search.trim().toLowerCase()
  const inTab = visible
    .filter(c => segmentOf(c) === tab)
    .filter(c => !q || [c.name, c.company, c.email, c.role].some(v => (v || '').toLowerCase().includes(q)))

  const groups = useMemo(() => {
    const isPast = (c) => stageOf(c) === 'past_client'
    const main = tab === 'clients' ? inTab.filter(c => !isPast(c)) : inTab
    const past = tab === 'clients' ? inTab.filter(isPast) : []
    let out = []
    if (group === 'stage') {
      out = STAGE_ORDER.filter(s => STAGES[s].segment === tab && s !== 'past_client')
        .map(s => ({ key: s, label: STAGES[s].label, items: main.filter(c => stageOf(c) === s) }))
    } else if (group === 'company') {
      const byName = new Map()
      main.forEach(c => {
        const name = companyNameFor(c, companies)
        if (!byName.has(name)) byName.set(name, [])
        byName.get(name).push(c)
      })
      out = [...byName.entries()]
        .sort((a, b) => (a[0] === 'Independent') - (b[0] === 'Independent') || a[0].localeCompare(b[0]))
        .map(([name, items]) => {
          const record = companies.find(co => co.name === name)
          return { key: `co:${name}`, label: name, color: record?.color, items }
        })
    } else {
      out = [{ key: 'all', label: null, items: main }]
    }
    out = out.filter(g => g.items.length > 0).map(g => ({ ...g, items: sortContacts(g.items, sort, lastDates) }))
    return { list: out, past: sortContacts(past, sort, lastDates) }
  }, [inTab, tab, group, sort, companies, lastDates])

  const flatOrder = [...groups.list.flatMap(g => g.items), ...(showPast ? groups.past : [])]
  const selected = people.find(c => c.id === selectedId)
  const desktopContact = selected || flatOrder[0] || null

  const select = (id) => { setSelectedId(id); setMobileDetail(true) }
  const showMobileDetail = mobileDetail && !!selected

  // ── actions ──
  const contactById = (id) => people.find(c => c.id === id)

  const handleSaveForm = (data) => {
    if (data.id) {
      onUpdate(data.id, data)
    } else {
      const created = onAdd(data)
      if (created) {
        const seg = segmentOf(created)
        if (seg !== 'inbox' && seg !== tab) pickTab(seg)
        setSelectedId(created.id)
        setMobileDetail(true)
      }
    }
    setForm(null)
  }

  const handleDelete = (id) => {
    onDelete(id)
    setForm(null)
    if (selectedId === id) { setSelectedId(null); setMobileDetail(false) }
  }

  const handleStageChange = (contact, stage) => {
    if (stage === stageOf(contact)) return
    if (stage === 'client' && segmentOf(contact) !== 'clients') { setConvertId(contact.id); return }
    if (STAGES[stage].defaultDays) { setTouch({ mode: 'stage', contactId: contact.id, stage }); return }
    onUpdate(contact.id, { stage, networkLabel: stage === 'network' ? contact.networkLabel || null : null })
  }

  const handleTouchSave = ({ nextTouchOn, nextTouchReason }) => {
    const c = contactById(touch.contactId)
    if (!c) { setTouch(null); return }
    if (touch.mode === 'done') onCompleteTouch(c.id, { nextTouchOn, nextTouchReason })
    else if (touch.mode === 'stage') {
      onUpdate(c.id, {
        stage: touch.stage, nextTouchOn, nextTouchReason,
        networkLabel: touch.stage === 'network' ? c.networkLabel || null : null,
      })
      const seg = STAGES[touch.stage].segment
      if (seg !== tab && seg !== 'inbox') pickTab(seg)
    } else onUpdate(c.id, { nextTouchOn, nextTouchReason })
    setTouch(null)
  }

  const handleLog = ({ date, title, notes, nextTouchOn, nextTouchReason }) => {
    const c = contactById(logId)
    if (c) {
      onAddMeeting({
        title, date, notes, attendees: c.name || c.email || '',
        contactIds: [c.id], companyId: c.companyId || null, source: 'manual',
      })
      onCompleteTouch(c.id, { nextTouchOn, nextTouchReason, contactedOn: date })
    }
    setLogId(null)
  }

  const handleConvert = ({ newCompany, companyId, peerIds, nextTouchOn }) => {
    const c = contactById(convertId)
    if (!c) { setConvertId(null); return }
    let cid = companyId
    if (newCompany) {
      cid = makeId('co')
      onAddCompany({ id: cid, ...newCompany })
    }
    const today = dateUtils.today()
    const ids = [c.id, ...peerIds]
    const before = ids.map(id => {
      const p = contactById(id)
      return { id, stage: p.stage, companyId: p.companyId ?? null, becameClientOn: p.becameClientOn || '', nextTouchOn: p.nextTouchOn || '', nextTouchReason: p.nextTouchReason || '' }
    })
    onUpdateMany(ids.map(id => ({
      id, stage: 'client', companyId: cid, becameClientOn: today, nextTouchOn, nextTouchReason: 'First check-in',
    })))
    setConvertId(null)
    pickTab('clients')
    setSelectedId(c.id)
    showToast?.({
      message: `${c.name} is now a client`,
      actionLabel: 'Undo',
      duration: 7000,
      undo: () => {
        onUpdateMany(before)
        if (newCompany) onDeleteCompany(cid)
      },
    })
  }

  const handleReviewSave = (id, patch) => onUpdate(id, patch)
  const handleIgnore = (c) => {
    if (c.email) onIgnoreEmail?.(c.email)
    onDelete(c.id)
  }

  const touchContact = touch ? contactById(touch.contactId) : null
  const logContact = logId ? contactById(logId) : null
  const convertContact = convertId ? contactById(convertId) : null

  const renderDetail = (contact, withBack) => (
    <ContactDetail
      key={contact.id}
      contact={contact}
      companies={companies}
      contacts={people}
      linkedMeetings={linkedById[contact.id] || []}
      openTasks={openTasksById[contact.id] || []}
      demoMode={demoMode}
      onBack={withBack ? () => setMobileDetail(false) : null}
      onEdit={() => setForm({ contact })}
      onStageChange={(s) => handleStageChange(contact, s)}
      onConvert={() => setConvertId(contact.id)}
      onDone={() => setTouch({ mode: 'done', contactId: contact.id })}
      onSnooze={() => setTouch({ mode: 'snooze', contactId: contact.id })}
      onLog={() => setLogId(contact.id)}
      onCompleteTask={onCompleteTask}
      onEditTask={onEditTask}
      onOpenContact={(id) => select(id)}
      onOpenClient={onOpenClient}
    />
  )

  const segDefaultStage = tab === 'clients' ? 'client' : tab === 'network' ? 'network' : 'nurturing'

  return (
    <div className="h-full flex">
      {/* List */}
      <section aria-label="People" className={`${showMobileDetail ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[380px] md:flex-shrink-0 md:border-r border-surface-300 h-full`}>
        <div className="px-4 pt-5 pb-3 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-bold text-navy-900 text-xl">Relationships</h1>
              <p className="text-navy-600 text-sm mt-0.5">{visible.length} {visible.length === 1 ? 'person' : 'people'}</p>
            </div>
            <button onClick={() => setForm({ defaultStage: segDefaultStage })} className="btn-primary px-4 min-h-[40px] text-sm flex items-center gap-1.5">
              <Plus size={15} strokeWidth={2.5} /> Add
            </button>
          </div>

          {reviewQueue.length > 0 && (
            <button onClick={() => setReviewOpen(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border border-[#FBE3B4] bg-gold-50 text-left min-h-[44px]">
              <Inbox size={16} className="text-[#8A5500] flex-shrink-0" />
              <span className="flex-1 text-[13px] text-navy-700"><strong className="font-semibold">{reviewQueue.length} {reviewQueue.length === 1 ? 'person' : 'people'}</strong> waiting to be sorted</span>
              <span className="font-display font-semibold text-[13px] text-[#8A5500]">Sort</span>
            </button>
          )}

          <div role="tablist" aria-label="Segments" className="flex p-[3px] gap-[3px] rounded-[10px] bg-surface-200 font-display text-[13px] font-semibold">
            {SEGMENTS.map(s => (
              <button key={s.id} role="tab" aria-selected={tab === s.id} onClick={() => pickTab(s.id)}
                className={`flex-1 min-h-[36px] rounded-lg transition-all ${tab === s.id ? 'bg-white shadow-card text-navy-900' : 'text-navy-600 hover:text-navy-900'}`}>
                {s.label} <span className="font-medium text-navy-600">{counts[s.id]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white border border-surface-300 rounded-[10px] px-3 focus-within:border-gold-500">
            <Search size={15} className="text-navy-500 flex-shrink-0" aria-hidden="true" />
            <label htmlFor="rel-search" className="sr-only">Search people</label>
            <input id="rel-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or company"
              className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-navy-900 placeholder-navy-400 focus:outline-none" />
          </div>

          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-300 bg-white text-navy-700">
              Group
              <select value={group} onChange={e => setGroup(e.target.value)} className="bg-transparent font-semibold text-navy-900 focus:outline-none cursor-pointer">
                {Object.entries(GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-300 bg-white text-navy-700">
              Sort
              <select value={sort} onChange={e => setSort(e.target.value)} className="bg-transparent font-semibold text-navy-900 focus:outline-none cursor-pointer">
                {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {groups.list.length === 0 && groups.past.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <Users size={28} className="text-surface-500 mb-3" />
              <p className="font-display font-semibold text-navy-700">{q ? 'Nobody matches that search' : `No ${SEGMENTS.find(s => s.id === tab).label.toLowerCase()} yet`}</p>
              {!q && <p className="text-navy-600 text-sm mt-1">Add someone, or sort the people waiting for review.</p>}
            </div>
          ) : (
            <>
              {groups.list.map(g => (
                <div key={g.key} className="space-y-2">
                  {g.label && (
                    <p className="flex items-center gap-2 pt-2 font-display font-bold text-[11px] uppercase tracking-wider text-navy-600">
                      {g.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />}
                      {g.label} · {g.items.length}
                    </p>
                  )}
                  {g.items.map(c => (
                    <ContactRow key={c.id} contact={c} company={companies.find(co => co.id === c.companyId)}
                      linked={linkedById[c.id] || []} lastDate={lastDates[c.id]} openTaskCount={(openTasksById[c.id] || []).length}
                      selected={desktopContact?.id === c.id} demoMode={demoMode} onSelect={select} />
                  ))}
                </div>
              ))}
              {groups.past.length > 0 && (
                <div className="space-y-2 pt-2">
                  <button onClick={() => setShowPast(s => !s)} aria-expanded={showPast}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] border border-dashed border-surface-400 font-display font-bold text-[11px] uppercase tracking-wider text-navy-600">
                    Past clients · {groups.past.length}
                    {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showPast && groups.past.map(c => (
                    <ContactRow key={c.id} contact={c} company={companies.find(co => co.id === c.companyId)}
                      linked={linkedById[c.id] || []} lastDate={lastDates[c.id]} openTaskCount={(openTasksById[c.id] || []).length}
                      selected={desktopContact?.id === c.id} demoMode={demoMode} onSelect={select} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Detail: desktop pane */}
      <section aria-label="Contact" className="hidden md:block flex-1 min-w-0 h-full">
        {desktopContact ? renderDetail(desktopContact, false) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Users size={32} className="text-surface-500 mb-3" />
            <p className="font-display font-semibold text-navy-700">Pick someone to see your last conversation</p>
          </div>
        )}
      </section>

      {/* Detail: phone screen */}
      {showMobileDetail && (
        <section aria-label="Contact" className="md:hidden flex-1 min-w-0 h-full">
          {renderDetail(selected, true)}
        </section>
      )}

      {form && (
        <ContactForm contact={form.contact} defaultStage={form.defaultStage} companies={companies} contacts={people}
          allContacts={allContacts || contacts} demoMode={demoMode}
          onSave={handleSaveForm} onDelete={handleDelete} onClose={() => setForm(null)} />
      )}
      {reviewOpen && (
        <ReviewSheet queue={reviewQueue} companies={companies} meetings={meetings} demoMode={demoMode}
          onSave={handleReviewSave} onIgnore={handleIgnore} onClose={() => setReviewOpen(false)} />
      )}
      {convertContact && (
        <ConvertSheet contact={convertContact} contacts={people} companies={companies}
          onConvert={handleConvert} onClose={() => setConvertId(null)} />
      )}
      {touchContact && (
        <NextTouchModal mode={touch.mode} contact={touchContact} stage={touch.stage} demoMode={demoMode}
          onSave={handleTouchSave} onClose={() => setTouch(null)} />
      )}
      {logContact && (
        <LogConversationModal contact={logContact} onSave={handleLog} onClose={() => setLogId(null)} />
      )}
    </div>
  )
}

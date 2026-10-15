import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTasks } from './hooks/useTasks'
import { useSprint } from './hooks/useSprint'
import { useNotes } from './hooks/useNotes'
import { useCompanies } from './hooks/useCompanies'
import { useContacts } from './hooks/useContacts'
import { useMeetings } from './hooks/useMeetings'
import { useGoals } from './hooks/useGoals'
import { useSettings } from './hooks/useSettings'
import { useGoogle } from './hooks/useGoogle'
import { useRelationshipEvents } from './hooks/useRelationshipEvents'
import { useProjects } from './hooks/useProjects'
import { useInvoices } from './hooks/useInvoices'
import { useTimer } from './hooks/useTimer'
import { storage } from './utils/storage'
import { stripDeviceLocal } from './utils/dataMap'

import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { TaskModal } from './components/TaskModal'
import { MeetingModal } from './components/MeetingModal'
import { ProjectModal } from './components/ProjectModal'
import { CelebrationBurst } from './components/Celebration'
import { BreakdownModal } from './components/BreakdownModal'
import { Toast } from './components/Toast'

import { DoView } from './views/DoView'
import { AllTasks } from './views/AllTasks'
import { WeekBoard } from './views/WeekBoard'
import { Projects } from './views/Projects'
import { Meetings } from './views/Meetings'
import { Relationships } from './views/Relationships'
import { Goals } from './views/Goals'
import { Hours } from './views/Hours'
import { WeeklyReview } from './views/WeeklyReview'
import { Briefing } from './views/Briefing'
import { Notes } from './views/Notes'
import { SprintView } from './views/SprintView'
import { Settings } from './views/Settings'
import { Archive } from './views/Archive'
import { PrepDay } from './views/PrepDay'
import { Calendar } from './views/Calendar'
import { Clients } from './views/Clients'
import { ClientCockpit } from './views/ClientCockpit'
import { ProjectDetail } from './views/ProjectDetail'
import { useSync } from './hooks/useSync'
import { Login } from './components/Login'
import { SyncIndicator } from './components/SyncIndicator'
import { SyncBanner } from './components/SyncBanner'
import { SearchOverlay } from './components/SearchOverlay'
import { GlobalTimer } from './components/GlobalTimer'
import { genId as makeId } from './utils/ids'
import { ReachOutCard, ToLogCard } from './components/relationships/ReachOutCard'
import {
  contactIdsFromAttendees, hiddenInDemo, contactIdFromLink, nextBookedEvent, toLogItems, reachOutList,
  meetingsForContact, threadsForContact, lastContactDate, mergePatch, firstNameOf, localDateOf, shortDay, stageOf,
  referralStageOf, lower, emailsOf, uniqueFirstNames,
} from './utils/relationships'
import { calUtils } from './utils/dateUtils'

function AppMain({ sync }) {
  const [activeView, setActiveView] = useState('do')
  const [activeClient, setActiveClient] = useState(null)
  const [taskModal, setTaskModal] = useState({ open: false, task: null })
  const [meetingModal, setMeetingModal] = useState({ open: false, meeting: null })
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [breakdownModal, setBreakdownModal] = useState({ open: false, task: null })
  const [celebration, setCelebration] = useState(false)
  const [toast, setToast] = useState(null)
  const [eventNotes, setEventNotes] = useState(() => storage.get('eventNotes', {}))
  const [cockpitClient, setCockpitClient] = useState(null)
  const [detailProject, setDetailProject] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusContactId, setFocusContactId] = useState(null)
  const [focusAction, setFocusAction] = useState(null)   // { type: 'log', prefill } | { type: 'schedule' }

  const {
    tasks, todayTasks, allThisWeekTasks, missedTasks, top3Tasks, unscheduledTasks, completedToday,
    tasksForProject, saveTask, completeTask, uncompleteTask, deleteTask, bulkUpdate, bulkDelete,
    toggleTop3, setSubtasks, toggleSubtask, addTimeEntry, addManualTimeEntry, logTimeToTarget, updateTimeEntry, deleteTimeEntry, setResources,
    patchTimeEntry, moveTimeEntries, deleteTimeEntries,
  } = useTasks()

  const { sprint, saveSprint, updateWeekGoal, updateSprintGoal, resetSprint, currentWeek, progress } = useSprint()
  const { notes, addNote, deleteNote, togglePin } = useNotes()
  const { companies, addCompany, updateCompany, deleteCompany } = useCompanies()
  const { contacts, addContact, updateContact, updateContacts, deleteContact, replaceAll: replaceContacts } = useContacts()
  // Written by the hourly Gmail sync; the app only reads them.
  const [emailThreads, setEmailThreads] = useState(() => storage.get('emailThreads', []))
  const { meetings, addMeeting, updateMeeting, deleteMeeting, toggleActionItem, addActionItem, replaceAll: replaceMeetings } = useMeetings()
  const { goals, vision, activeGoals, addGoal, updateGoal, deleteGoal, saveVision } = useGoals()
  const { settings, saveSettings, saveGoogleToken, expireGoogleToken, clearGoogleToken } = useSettings()
  // After a Gmail sync, and before the app writes contacts on its own: re-read
  // contacts (new people, last contact dates), email threads, and meetings
  // (Circleback notes the processor saved). Skipped while local edits are
  // still waiting to sync.
  const refreshFromCloud = sync.refreshFromCloud
  const lastPullRef = useRef(Date.now())   // the first load is a pull
  const refreshPeople = useCallback(async () => {
    const fresh = await refreshFromCloud(['contacts', 'email_threads', 'meetings'])
    if (!fresh) return false
    lastPullRef.current = Date.now()
    if (fresh.contacts) replaceContacts(fresh.contacts)
    if (fresh.emailThreads) setEmailThreads(fresh.emailThreads)
    if (fresh.meetings) replaceMeetings(fresh.meetings)
    return true
  }, [refreshFromCloud, replaceContacts, replaceMeetings])
  const google = useGoogle(settings, { saveSettings, saveGoogleToken, expireGoogleToken, clearGoogleToken, onEmailSynced: refreshPeople })

  // The hourly sync runs while SprintHQ is closed. Coming back to the app
  // after 15 minutes or more picks up what it found.
  const lastRefreshRef = useRef(Date.now())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !google.server?.connected) return
      if (Date.now() - lastRefreshRef.current < 15 * 60 * 1000) return
      lastRefreshRef.current = Date.now()
      refreshPeople()
      google.refreshServerStatus()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [google.server?.connected, google.refreshServerStatus, refreshPeople])
  const { projects, activeProjects, addProject, updateProject, deleteProject } = useProjects()
  const { invoices, profile: invoiceProfile, saveProfile, saveInvoice } = useInvoices()
  const timer = useTimer((session) => {
    // Per-task quick toggle stop: log to the attached task if there is one
    if (session?.taskId && session.seconds > 0) addTimeEntry(session.taskId, session.seconds)
  })

  // ── Task handlers ──
  const openAddTask = useCallback((d = {}) => setTaskModal({ open: true, task: d }), [])
  const openEditTask = useCallback((task) => setTaskModal({ open: true, task }), [])
  const closeTaskModal = useCallback(() => setTaskModal({ open: false, task: null }), [])
  const handleSaveTask = useCallback((data) => { saveTask(data); closeTaskModal() }, [saveTask, closeTaskModal])
  const handleComplete = useCallback((id) => {
    completeTask(id)
    if (settings.celebrationsEnabled !== false) setCelebration(true)
    setToast({ message: 'Task completed', actionLabel: 'Undo', taskId: id, duration: 5000 })
  }, [completeTask, settings.celebrationsEnabled])

  const handleToastUndo = useCallback(() => {
    if (toast?.undo) toast.undo()
    else if (toast?.taskId) uncompleteTask(toast.taskId)
    setToast(null)
  }, [toast, uncompleteTask])
  const rescheduleTask = useCallback((taskId, date) => { saveTask({ id: taskId, dueDate: date }) }, [saveTask])

  const createTasksBatch = useCallback((taskList) => {
    taskList.forEach(t => saveTask(t))
  }, [saveTask])

  const reopenProject = useCallback((id) => { updateProject(id, { status: 'active' }) }, [updateProject])

  const createTaskWithTime = useCallback((data, seconds) => {
    const t = saveTask({ ...data, dueDate: data.dueDate || new Date().toISOString().split('T')[0], priority: 'medium' })
    if (t?.id) addTimeEntry(t.id, seconds)
  }, [saveTask, addTimeEntry])

  // Resolve a timer session (task / project / client-only) to a task and log time — atomic.
  const logTimeSession = useCallback(({ companyId, projectId, taskId, seconds, title }) => {
    logTimeToTarget({ taskId, companyId, projectId, title }, seconds)
  }, [logTimeToTarget])

  // Log a retroactive session with an explicit start date (past time entry) — atomic.
  const logManualSession = useCallback(({ companyId, projectId, taskId, seconds, title, startISO }) => {
    logTimeToTarget({ taskId, companyId, projectId, title }, seconds, { dateStr: startISO ? startISO.split('T')[0] : null })
  }, [logTimeToTarget])

  const openProjectDetail = useCallback((project) => {
    setDetailProject(project)
    setActiveView('projects')
  }, [])

  const handleSearchGoto = useCallback(({ type, item }) => {
    setSearchOpen(false)
    if (type === 'task') { openEditTask(item) }
    else if (type === 'project') { setDetailProject(item); setActiveView('projects') }
    else if (type === 'client') { setCockpitClient(item); setActiveView('clients') }
    else if (type === 'meeting') { setMeetingModal({ open: true, meeting: item }) }
    else if (type === 'note') { setActiveView('notes') }
  }, [openEditTask])

  const saveEventNote = useCallback((eventId, note) => {
    setEventNotes(prev => {
      const updated = { ...prev, [eventId]: note }
      storage.set('eventNotes', updated)
      return updated
    })
  }, [])

  const timeHandlers = {
    add: (taskId, secs, date) => addManualTimeEntry(taskId, secs, date),
    update: (taskId, eid, secs) => updateTimeEntry(taskId, eid, secs),
    remove: (taskId, eid) => deleteTimeEntry(taskId, eid),
  }

  // ── Breakdown ──
  const openBreakdown = useCallback((task) => {
    if (!settings.anthropicKey) { setActiveView('settings'); return }
    setBreakdownModal({ open: true, task })
  }, [settings.anthropicKey])
  const applyBreakdown = useCallback((taskId, subtasks) => {
    if (taskId) setSubtasks(taskId, subtasks)
  }, [setSubtasks])

  // ── Project handlers ──
  const openAddProject = useCallback((d = {}) => setProjectModal({ open: true, project: d }), [])
  const handleSaveProject = useCallback((data) => {
    if (data.id) updateProject(data.id, data); else addProject(data)
    setProjectModal({ open: false, project: null })
  }, [addProject, updateProject])

  // ── Meeting handlers — auto-convert action items to tasks on save ──
  const handleSaveMeeting = useCallback((data) => {
    // Auto-create tasks for any action item without a taskId
    const updatedItems = (data.actionItems || []).map(ai => {
      if (ai.taskId || ai.done) return ai
      const newTask = saveTask({
        title: ai.title,
        dueDate: ai.dueDate || null,
        companyId: data.companyId || null,
        projectId: data.projectId || null,
        priority: 'medium',
        notes: `From meeting: ${data.title || ''}`,
      })
      return { ...ai, taskId: newTask?.id || makeId('linked') }
    })
    // Link the meeting to anyone whose email or full name is in the attendee text.
    // Keep links made elsewhere (logged conversations, Circleback): the modal doesn't carry them.
    const existing = data.id ? meetings.find(m => m.id === data.id) : null
    const linked = contactIdsFromAttendees(data.attendees, contacts)
    const contactIds = [...new Set([...(existing?.contactIds || []), ...(data.contactIds || []), ...linked])]
    const payload = { ...data, actionItems: updatedItems, contactIds }
    if (payload.id) updateMeeting(payload.id, payload); else addMeeting(payload)
    setMeetingModal({ open: false, meeting: null })
  }, [addMeeting, updateMeeting, saveTask, contacts, meetings])

  const handlePushActionToTask = useCallback((meetingId, actionItem) => {
    const meeting = meetings.find(m => m.id === meetingId)
    const newTask = saveTask({ title: actionItem.title, dueDate: actionItem.dueDate || null, companyId: meeting?.companyId || null, projectId: meeting?.projectId || null, priority: 'medium', notes: `From meeting: ${meeting?.title || ''}` })
    if (meeting) updateMeeting(meetingId, { actionItems: (meeting.actionItems||[]).map(ai => ai.id === actionItem.id ? { ...ai, taskId: newTask?.id || makeId('pushed') } : ai) })
  }, [meetings, saveTask, updateMeeting])

  // ── Backup ──
  const handleBackup = useCallback(async () => {
    const data = {}
    // stripDeviceLocal keeps the Anthropic key and Google OAuth token out of
    // the exported file. A Drive backup is plaintext JSON with a predictable
    // name, it can be link-shared, and it syncs to any machine running Drive.
    ;['tasks','sprint','notes','contacts','meetings','goals','vision','companies','projects','invoices','invoiceProfile','settings'].forEach(k => { data[k] = stripDeviceLocal(k, storage.get(k, null)) })
    data.exportedAt = new Date().toISOString()
    return google.backupToDrive(data)
  }, [google])

  const filterByClient = useCallback((items, key = 'companyId') => activeClient ? items.filter(i => i[key] === activeClient) : items, [activeClient])

  // ── Relationships ──
  const demoMode = !!settings.demoMode
  const openContact = useCallback((id, action = null) => {
    setFocusContactId(id); setFocusAction(action); setActiveView('relationships')
  }, [])
  // #contact=<id> (the links Prep My Day puts on prep tasks, and the link in
  // events SprintHQ adds) opens that contact, on load or when clicked from
  // inside the app. The hash is cleared afterwards so a refresh doesn't
  // jump back to it.
  useEffect(() => {
    const fromHash = () => {
      const id = contactIdFromLink(window.location.href)
      if (!id) return
      openContact(id)
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* ignore */ }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [openContact])

  // Deleted from review: ignored from then on, so syncs don't add them back.
  const ignoreEmails = useCallback((emails) => {
    const list = settings.contactIgnore || []
    const add = [...new Set((emails || []).map(lower).filter(e => e && !list.includes(e)))]
    if (add.length) saveSettings({ contactIgnore: [...list, ...add] })
  }, [settings.contactIgnore, saveSettings])

  const notSame = settings.mergeNotSame || []
  const addNotSame = useCallback((key) => {
    const list = settings.mergeNotSame || []
    if (!list.includes(key)) saveSettings({ mergeNotSame: [...list, key] })
  }, [settings.mergeNotSame, saveSettings])

  const contactsById = useMemo(() => Object.fromEntries(contacts.map(c => [c.id, c])), [contacts])

  // The calendar, two weeks back and three months ahead: what's booked with
  // each person, and meetings that still need notes.
  const relEvents = useRelationshipEvents(google)
  const calendarEvents = relEvents.events

  // A clock for "is this meeting over yet", so booked meetings drop off when
  // they end instead of when the calendar next reloads.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Notes already logged: by calendar event, and by person and day.
  const loggedEventIds = useMemo(() => new Set(meetings.map(m => m.calendarEventId).filter(Boolean)), [meetings])
  const loggedDaysById = useMemo(() => {
    const map = {}
    contacts.forEach(c => { map[c.id] = new Set(meetingsForContact(c, meetings).map(m => m.date).filter(Boolean)) })
    return map
  }, [contacts, meetings])

  // Your own addresses, so your name in a title ("Sam and Rane connect")
  // and your place on an invite never point at a contact.
  const selfEmails = useMemo(() => [...new Set([google.server?.email, settings.googleEmail, sync.userEmail]
    .map(lower).filter(Boolean))], [google.server?.email, settings.googleEmail, sync.userEmail])
  const uniqueFirst = useMemo(() => uniqueFirstNames(contacts, selfEmails), [contacts, selfEmails])

  // The next event with each person. Until the calendar has been read, the
  // copy saved on the contact stands in.
  const bookedById = useMemo(() => {
    const map = {}
    if (calendarEvents) {
      // Addresses on sorted people, and people still in Needs review by address.
      const known = new Set(contacts.filter(c => stageOf(c) !== 'needs_review').flatMap(emailsOf))
      const inReview = new Map(contacts.filter(c => stageOf(c) === 'needs_review').flatMap(c => emailsOf(c).map(e => [e, c.id])))
      contacts.forEach(c => {
        if (stageOf(c) === 'needs_review') return
        const ev = nextBookedEvent(c, calendarEvents, { uniqueFirst, now: nowTick, loggedEventIds, loggedDays: loggedDaysById[c.id] })
        if (!ev) return
        // Found by name, not address. If the invite went to one other
        // address, offer to save it to this person, or to merge with the
        // Needs review record that already has it.
        const attendees = (ev.attendees || []).map(lower)
        const mine = emailsOf(c)
        const others = attendees.filter(e => e && !selfEmails.includes(e) && e !== lower(ev.selfEmail) && !known.has(e))
        if (attendees.some(e => mine.includes(e)) || others.length !== 1) { map[c.id] = ev; return }
        const reviewId = inReview.get(others[0])
        map[c.id] = reviewId ? { ...ev, suggestEmail: others[0], suggestMergeId: reviewId } : { ...ev, suggestEmail: others[0] }
      })
    } else {
      const today = calUtils.localToday()
      contacts.forEach(c => {
        if (c.nextTouchEventId && c.nextTouchOn && c.nextTouchOn >= today) {
          map[c.id] = { id: c.nextTouchEventId, title: c.nextTouchReason || 'Next touch', start: c.nextTouchOn, end: c.nextTouchOn, cached: true }
        }
      })
    }
    return map
  }, [contacts, calendarEvents, uniqueFirst, selfEmails, nowTick, loggedEventIds, loggedDaysById])

  // Keep the saved copy in step with the calendar, so lists sort by it on
  // other devices and before the calendar loads. Events beyond the window
  // the app reads are left alone.
  useEffect(() => {
    if (!calendarEvents) return
    const horizon = calUtils.addDays(calUtils.localToday(), 85)
    const patches = []
    contacts.forEach(c => {
      if (stageOf(c) === 'needs_review') return
      const ev = bookedById[c.id]
      if (ev) {
        const on = localDateOf(ev.start)
        const reason = ev.title || ''
        if (c.nextTouchEventId !== ev.id || c.nextTouchOn !== on || (c.nextTouchReason || '') !== reason) {
          patches.push({ id: c.id, nextTouchEventId: ev.id, nextTouchOn: on, nextTouchReason: reason })
        }
      } else if (relEvents.complete && c.nextTouchEventId && !(c.nextTouchOn && c.nextTouchOn > horizon)) {
        patches.push({ id: c.id, nextTouchEventId: null, nextTouchOn: '', nextTouchReason: '' })
      }
    })
    if (!patches.length) return
    // Writing a contact sends the whole row, so pull first if it's been a
    // while; this runs again with the fresh copy.
    if (Date.now() - lastPullRef.current > 10 * 60 * 1000) { refreshPeople(); return }
    updateContacts(patches)
  }, [calendarEvents, relEvents.complete, contacts, bookedById, updateContacts, refreshPeople])

  // Meetings with a lead, client or partner that have no notes yet.
  const toLogDismissed = settings.toLogDismissed || []
  const toLog = useMemo(() => {
    if (!calendarEvents) return []
    const people = contacts.filter(c => !hiddenInDemo(c, demoMode))
    return toLogItems(calendarEvents, people, meetings, { dismissed: toLogDismissed, now: nowTick })
  }, [calendarEvents, contacts, meetings, toLogDismissed, demoMode, nowTick])
  const toLogByContact = useMemo(() => {
    const map = {}
    toLog.forEach(item => item.contactIds.forEach(id => { (map[id] = map[id] || []).push(item) }))
    return map
  }, [toLog])
  const dismissToLog = useCallback((eventId) => {
    const list = settings.toLogDismissed || []
    if (!list.includes(eventId)) saveSettings({ toLogDismissed: [...list, eventId].slice(-300) })
  }, [settings.toLogDismissed, saveSettings])
  const logPrefill = (item) => ({ date: item.day, title: item.title, calendarEventId: item.eventId, contactIds: item.contactIds })

  // A heads-up the first time this device sees a meeting with no notes.
  const toLogKey = toLog.map(i => i.eventId).join(',')
  useEffect(() => {
    if (!toLog.length) return
    let seen = []
    try { seen = JSON.parse(window.localStorage.getItem('toLogNotified') || '[]') } catch { /* ignore */ }
    const fresh = toLog.filter(i => !seen.includes(i.eventId))
    if (!fresh.length) return
    try { window.localStorage.setItem('toLogNotified', JSON.stringify([...seen, ...fresh.map(i => i.eventId)].slice(-300))) } catch { /* ignore */ }
    const item = fresh[0]
    const lead = contactsById[item.contactIds[0]]
    if (!lead) return
    setToast(fresh.length === 1
      ? { message: `No notes yet from ${item.title || 'your meeting'} with ${firstNameOf(lead)}`, actionLabel: 'Log', duration: 9000,
          undo: () => openContact(lead.id, { type: 'log', prefill: logPrefill(item) }) }
      : { message: `${fresh.length} meetings have no notes yet`, actionLabel: 'View', duration: 9000, undo: () => setActiveView('do') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toLogKey])

  // Today: people with nothing booked who are past the gap their stage
  // allows. Past clients only show when they're on the referral track.
  const reachOut = useMemo(() => {
    const list = filterByClient(contacts)
      .filter(c => !hiddenInDemo(c, demoMode))
      .filter(c => stageOf(c) !== 'past_client' || referralStageOf(c))
    const lastDates = {}
    list.forEach(c => {
      // A meeting still waiting for notes counts as contact; it's in To log.
      const met = (toLogByContact[c.id] || []).map(i => i.day).sort().pop() || ''
      const last = lastContactDate(c, meetingsForContact(c, meetings), threadsForContact(c, emailThreads)) || ''
      lastDates[c.id] = met > last ? met : last
    })
    return reachOutList(list, { lastDates, bookedIds: new Set(Object.keys(bookedById)) })
  }, [contacts, filterByClient, demoMode, meetings, emailThreads, bookedById, toLogByContact])

  // After Schedule it: show the event right away and save it on the contact.
  const handleScheduled = useCallback((contact, { event, rescheduled, invited }) => {
    if (!event) return
    relEvents.addLocal(event)
    const before = { nextTouchEventId: contact.nextTouchEventId || null, nextTouchOn: contact.nextTouchOn || '', nextTouchReason: contact.nextTouchReason || '' }
    updateContact(contact.id, { nextTouchEventId: event.id, nextTouchOn: localDateOf(event.start), nextTouchReason: event.title || '' })
    const time = (event.start || '').includes('T') ? ` at ${new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''
    const when = `${shortDay(localDateOf(event.start))}${time}`
    if (rescheduled) {
      setToast({ message: `Moved to ${when}${invited ? '. Guests get the new time.' : ''}`, duration: 5000 })
      return
    }
    setToast({
      message: `On your calendar for ${when}${invited ? `. ${firstNameOf(contact)} is invited.` : ''}`,
      actionLabel: 'Undo', duration: 8000,
      undo: async () => {
        const r = await google.cancelEvent(event.id)
        if (r.ok) {
          relEvents.removeLocal(event.id)
          updateContact(contact.id, before)
        } else {
          setToast({ message: "Couldn't remove it. Delete the event in Google Calendar.", duration: 6000 })
        }
      },
    })
  }, [relEvents, updateContact, google])

  // One person, two records: move meetings, tasks and referrals to the one
  // you keep, fold in the other's details, then delete it. Undo puts it all
  // back.
  const mergeContacts = useCallback((keepId, dropId) => {
    const keep = contactsById[keepId]
    const drop = contactsById[dropId]
    if (!keep || !drop || keepId === dropId) return
    const patch = mergePatch(keep, drop)
    const keepBefore = Object.fromEntries(Object.keys(patch).map(k => [k, keep[k] ?? null]))
    const movedMeetings = meetings.filter(m => (m.contactIds || []).includes(dropId)).map(m => ({ id: m.id, contactIds: m.contactIds }))
    const movedTasks = tasks.filter(t => t.contactId === dropId).map(t => t.id)
    const referred = contacts.filter(c => c.referredBy === dropId && c.id !== keepId).map(c => c.id)

    // Delete first: the kept record may take over the other's main email.
    deleteContact(dropId)
    updateContacts([{ id: keepId, ...patch }, ...referred.map(id => ({ id, referredBy: keepId }))])
    movedMeetings.forEach(m => updateMeeting(m.id, { contactIds: [...new Set(m.contactIds.map(id => (id === dropId ? keepId : id)))] }))
    movedTasks.forEach(id => saveTask({ id, contactId: keepId }))

    setToast({
      message: `Merged into ${keep.name || keep.email}`,
      actionLabel: 'Undo', duration: 8000,
      undo: () => {
        updateContacts([{ id: keepId, ...keepBefore }, ...referred.map(id => ({ id, referredBy: dropId }))])
        addContact(drop)
        movedMeetings.forEach(m => updateMeeting(m.id, { contactIds: m.contactIds }))
        movedTasks.forEach(id => saveTask({ id, contactId: dropId }))
      },
    })
  }, [contactsById, contacts, meetings, tasks, deleteContact, updateContacts, updateMeeting, saveTask, addContact])

  const addContactTask = useCallback((data) => saveTask(data), [saveTask])

  const peopleForCalendar = {
    contacts, meetings, demoMode, userEmail: sync.userEmail, ignore: settings.contactIgnore || [],
    onOpenContact: openContact,
    onAddContact: (data) => addContact(data),
  }

  // ── Keyboard shortcut: N or C for quick capture ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (taskModal.open || meetingModal.open || projectModal.open || breakdownModal.open) return
      if ((e.key === 'n' || e.key === 'c') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        openAddTask({ dueDate: activeView === 'do' ? new Date().toISOString().split('T')[0] : null })
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [taskModal.open, meetingModal.open, projectModal.open, breakdownModal.open, activeView, openAddTask])

  // ── First run: if no sprint, force the Sprint view which now has inline setup ──
  const effectiveView = !sprint ? 'sprint' : activeView

  const taskCardProps = {
    companies, projects,
    onComplete: handleComplete, onUncomplete: uncompleteTask, onEdit: openEditTask, onDelete: deleteTask,
    timer, onToggleTimer: timer.toggle, onToggleSubtask: toggleSubtask, onBreakdown: openBreakdown, onToggleTop3: toggleTop3,
  }

  const renderView = () => {
    switch (effectiveView) {
      case 'do':
        return <DoView todayTasks={filterByClient(todayTasks)} top3Tasks={filterByClient(top3Tasks)} missedTasks={filterByClient(missedTasks)} unscheduledTasks={filterByClient(unscheduledTasks)}
          companies={companies} projects={projects} onAdd={openAddTask} onComplete={handleComplete} onUncomplete={uncompleteTask} onEdit={openEditTask} onDelete={deleteTask} onReschedule={rescheduleTask}
          completedToday={completedToday} timer={timer} onToggleTimer={timer.toggle} onToggleSubtask={toggleSubtask} onBreakdown={openBreakdown} onToggleTop3={toggleTop3}
          toLogSlot={<ToLogCard items={toLog} contactsById={contactsById} companies={companies}
            onLog={(item) => openContact(item.contactIds[0], { type: 'log', prefill: logPrefill(item) })}
            onDismiss={dismissToLog} onOpenContact={openContact} />}
          reachOutSlot={<ReachOutCard due={reachOut} companies={companies}
            onSchedule={(id) => openContact(id, { type: 'schedule' })} onOpenContact={openContact}
            onOpenAll={() => setActiveView('relationships')} />} />
      case 'week':
        return <WeekBoard allTasks={filterByClient(allThisWeekTasks)} companies={companies} projects={filterByClient(activeProjects)}
          onAdd={openAddTask} onComplete={handleComplete} onEdit={openEditTask} onReschedule={rescheduleTask}
          onOpenProject={(p) => openProjectDetail(p)} />
      case 'alltasks':
        return <AllTasks tasks={tasks} companies={companies} projects={projects} activeClient={activeClient} onAdd={openAddTask} taskCardProps={taskCardProps} onBulkUpdate={bulkUpdate} onBulkDelete={bulkDelete} />
      case 'projects': {
        if (detailProject) {
          const liveProject = projects.find(p => p.id === detailProject.id) || detailProject
          const projCompany = companies.find(c => c.id === liveProject.companyId)
          return <ProjectDetail
            project={liveProject} company={projCompany} tasks={tasks} goals={goals}
            onBack={() => setDetailProject(null)}
            onAddTask={openAddTask}
            onEditProject={(p) => setProjectModal({ open: true, project: p })}
            onUpdateProject={updateProject}
            taskCardProps={taskCardProps}
          />
        }
        return <Projects projects={activeProjects} companies={companies} goals={goals} activeClient={activeClient} tasksForProject={tasksForProject}
          onAddProject={addProject} onUpdateProject={updateProject} onDeleteProject={deleteProject} taskCardProps={taskCardProps}
          onOpenProject={openProjectDetail} />
      }
      case 'meetings':
        return <Meetings meetings={filterByClient(meetings)} companies={companies} projects={projects} activeClient={activeClient}
          onAddMeeting={() => setMeetingModal({ open: true, meeting: {} })} onEditMeeting={(m) => setMeetingModal({ open: true, meeting: m })} onDeleteMeeting={deleteMeeting}
          onToggleActionItem={toggleActionItem} onPushToTask={handlePushActionToTask} onAddActionItem={addActionItem} demoMode={demoMode} />
      case 'relationships':
        return <Relationships
          contacts={filterByClient(contacts)} allContacts={contacts} companies={companies} meetings={meetings} tasks={tasks}
          emailThreads={emailThreads} gmailAccount={google.server?.email || settings.googleEmail}
          demoMode={demoMode} focusContactId={focusContactId} focusAction={focusAction}
          onFocusHandled={() => { setFocusContactId(null); setFocusAction(null) }}
          userEmail={sync.userEmail} ignore={settings.contactIgnore || []}
          google={google} bookedById={bookedById} toLogByContact={toLogByContact} notSame={notSame}
          referralProgram={settings.referralProgram || {}}
          onAdd={addContact} onUpdate={updateContact} onUpdateMany={updateContacts} onDelete={deleteContact}
          onAddMeeting={addMeeting} onUpdateMeeting={updateMeeting} onAddCompany={addCompany} onDeleteCompany={deleteCompany}
          onAddTask={addContactTask} onCompleteTask={handleComplete} onEditTask={openEditTask}
          onOpenClient={(c) => { setCockpitClient(c); setActiveView('clients') }}
          onIgnoreEmails={ignoreEmails} onNotSame={addNotSame} onDismissToLog={dismissToLog}
          onMerge={mergeContacts} onScheduled={handleScheduled}
          onSaveProgram={(program) => saveSettings({ referralProgram: { ...(settings.referralProgram || {}), ...program } })}
          showToast={setToast} />
      case 'goals':
        return <Goals goals={filterByClient(goals)} vision={vision} companies={companies} activeClient={activeClient} onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} onSaveVision={saveVision} />
      case 'hours':
        return <Hours tasks={filterByClient(tasks)} companies={companies} projects={projects} invoiceProfile={invoiceProfile} onSaveProfile={saveProfile} onSaveInvoice={saveInvoice}
          onEditTask={(id) => { const t = tasks.find(x => x.id === id); if (t) openEditTask(t) }}
          onPatchEntry={patchTimeEntry} onMoveEntries={moveTimeEntries} onDeleteEntries={deleteTimeEntries}
          onAddEntry={({ companyId, projectId, taskId, seconds, dateStr, title }) => logTimeToTarget({ taskId, companyId, projectId, title }, seconds, { dateStr })} />
      case 'review':
        return <WeeklyReview tasks={tasks} companies={companies} currentWeek={currentWeek} sprint={sprint} onEditTask={(t) => rescheduleTask(t.id, t.dueDate)} onAddTask={openAddTask} />
      case 'briefing':
        return <Briefing tasks={tasks} meetings={meetings} goals={activeGoals} vision={vision} calendarEvents={google.calendarEvents} settings={settings} onOpenSettings={() => setActiveView('settings')} />
      case 'notes':
        return <Notes notes={notes} onAdd={addNote} onDelete={deleteNote} onTogglePin={togglePin} />
      case 'sprint':
        return <SprintView sprint={sprint} currentWeek={currentWeek} progress={progress} tasks={tasks} onSaveSprint={saveSprint} onUpdateWeekGoal={updateWeekGoal} onUpdateGoal={updateSprintGoal} onReset={resetSprint} />
      case 'clients':
        if (cockpitClient) {
          return <ClientCockpit
            company={cockpitClient}
            tasks={tasks} projects={projects} meetings={meetings}
            companies={companies} allProjects={projects}
            onBack={() => setCockpitClient(null)}
            onAddTask={openAddTask} onAddProject={openAddProject}
            onAddMeeting={(d) => setMeetingModal({ open: true, meeting: d || {} })}
            onOpenProject={(p) => { setCockpitClient(null); openProjectDetail(p) }}
            taskCardProps={taskCardProps}
            demoMode={demoMode}
          />
        }
        return <Clients companies={companies} tasks={tasks} projects={projects} meetings={meetings} onOpenClient={(c) => setCockpitClient(c)} onAddCompany={addCompany} onUpdateCompany={updateCompany} onDeleteCompany={deleteCompany} />
      case 'calendar':
        return <Calendar google={google} companies={companies} projects={activeProjects} settings={settings} onCreateTask={(t) => saveTask(t)} eventNotes={eventNotes} onSaveEventNote={saveEventNote} onOpenSettings={() => setActiveView('settings')} people={peopleForCalendar} />
      case 'prep':
        return <PrepDay companies={companies} projects={activeProjects} google={google} settings={settings} onCreateTasks={createTasksBatch} onOpenSettings={() => setActiveView('settings')}
          contacts={contacts} meetings={meetings} userEmail={sync.userEmail} demoMode={demoMode} onOpenContact={openContact} />
      case 'archive':
        return <Archive tasks={tasks} companies={companies} projects={projects} activeClient={activeClient} onUncomplete={uncompleteTask} onDelete={deleteTask} tasksForProject={tasksForProject} onReopenProject={reopenProject} onDeleteProject={deleteProject} />
      case 'settings':
        return <Settings settings={settings} saveSettings={saveSettings} google={google} onBackup={handleBackup} companies={companies} onAddCompany={addCompany} onUpdateCompany={updateCompany} onDeleteCompany={deleteCompany} />
      default: return null
    }
  }

  const missedCount = missedTasks.filter(t => t.status === 'todo').length

  return (
    <div className="flex h-screen bg-surface-100 overflow-hidden">
      <Sidebar activeView={effectiveView} setActiveView={setActiveView} missedCount={missedCount} completedToday={completedToday} onSettings={() => setActiveView('settings')} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar sprint={sprint} currentWeek={currentWeek} progress={progress} vision={vision} onSaveVision={saveVision}
          onEditSprint={() => setActiveView('sprint')} companies={companies} activeClient={activeClient} onSelectClient={setActiveClient}
          onNewTask={() => openAddTask({ dueDate: new Date().toISOString().split('T')[0] })} onNewProject={() => openAddProject({ companyId: activeClient })}
          onNewMeeting={() => setMeetingModal({ open: true, meeting: {} })} onBriefing={() => setActiveView('briefing')}
          syncStatus={sync.syncStatus} lastSynced={sync.lastSynced} userEmail={sync.userEmail} onSignOut={sync.signOut} onSearch={() => setSearchOpen(true)}
          timerSlot={<GlobalTimer timer={timer} tasks={tasks} companies={companies} projects={projects} onLogSession={logTimeSession} onLogManual={logManualSession} />} />
        <SyncBanner syncError={sync.syncError} schemaGaps={sync.schemaGaps} pending={sync.pending} />
        <div className="flex-1 overflow-hidden pb-14 md:pb-0">{renderView()}</div>
      </div>
      <MobileNav activeView={effectiveView} setActiveView={setActiveView} missedCount={missedCount} />
      {taskModal.open && <TaskModal task={taskModal.task} companies={companies} projects={projects} onSave={handleSaveTask} onClose={closeTaskModal} onBreakdown={openBreakdown} timeHandlers={timeHandlers} />}
      {meetingModal.open && <MeetingModal meeting={meetingModal.meeting} companies={companies} projects={projects} demoMode={demoMode} onSave={handleSaveMeeting} onClose={() => setMeetingModal({ open: false, meeting: null })} />}
      {projectModal.open && <ProjectModal project={projectModal.project} companies={companies} goals={goals} defaultCompanyId={projectModal.project?.companyId} onSave={handleSaveProject} onClose={() => setProjectModal({ open: false, project: null })} />}
      {breakdownModal.open && <BreakdownModal task={breakdownModal.task} apiKey={settings.anthropicKey} onApply={applyBreakdown} onClose={() => setBreakdownModal({ open: false, task: null })} />}
      {searchOpen && <SearchOverlay tasks={tasks} projects={projects} meetings={meetings} companies={companies} notes={notes} onClose={() => setSearchOpen(false)} onGoto={handleSearchGoto} />}
      <Toast toast={toast} onAction={handleToastUndo} onDismiss={() => setToast(null)} />
      <CelebrationBurst active={celebration} onDone={() => setCelebration(false)} />
    </div>
  )
}

// ── Auth gate wrapper ──
// Handles login + waits for the first cloud pull before mounting the app,
// so data hooks read synced data (not stale local data) on a fresh device.
export default function App() {
  const sync = useSync()

  if (sync.authLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold-300 border-t-gold-600 animate-spin" />
      </div>
    )
  }

  if (!sync.isAuthed) {
    return <Login onSignIn={sync.signIn} authLoading={sync.authLoading} />
  }

  if (!sync.initialLoadDone) {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-gold-300 border-t-gold-600 animate-spin" />
        <p className="text-sm text-navy-500 font-display">Loading your data...</p>
      </div>
    )
  }

  return <AppMain sync={sync} />
}

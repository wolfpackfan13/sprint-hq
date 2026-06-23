import { useState, useCallback } from 'react'
import { useTasks } from './hooks/useTasks'
import { useSprint } from './hooks/useSprint'
import { useNotes } from './hooks/useNotes'
import { useCompanies } from './hooks/useCompanies'
import { useContacts } from './hooks/useContacts'
import { useMeetings } from './hooks/useMeetings'
import { useGoals } from './hooks/useGoals'
import { useSettings } from './hooks/useSettings'
import { useGoogle } from './hooks/useGoogle'
import { storage } from './utils/storage'

import { VisionBar } from './components/VisionBar'
import { WeekBanner } from './components/WeekBanner'
import { ClientFilter } from './components/ClientFilter'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { TaskModal } from './components/TaskModal'
import { MeetingModal } from './components/MeetingModal'
import { SprintSetup } from './components/SprintSetup'
import { CelebrationBurst } from './components/Celebration'

import { Dashboard } from './views/Dashboard'
import { Today } from './views/Today'
import { ThisWeek } from './views/ThisWeek'
import { Missed } from './views/Missed'
import { Meetings } from './views/Meetings'
import { Relationships } from './views/Relationships'
import { Goals } from './views/Goals'
import { Briefing } from './views/Briefing'
import { Notes } from './views/Notes'
import { SprintView } from './views/SprintView'
import { Settings } from './views/Settings'

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [activeClient, setActiveClient] = useState(null)
  const [taskModal, setTaskModal] = useState({ open: false, task: null })
  const [meetingModal, setMeetingModal] = useState({ open: false, meeting: null })
  const [showSprintSetup, setShowSprintSetup] = useState(false)
  const [celebration, setCelebration] = useState(false)

  const { tasks, todayTasks, allThisWeekTasks, missedTasks, completedToday, saveTask, completeTask, uncompleteTask, deleteTask } = useTasks()
  const { sprint, saveSprint, updateWeekGoal, updateSprintGoal, resetSprint, currentWeek, progress } = useSprint()
  const { notes, addNote, deleteNote, togglePin } = useNotes()
  const { companies } = useCompanies()
  const { contacts, addContact, updateContact, deleteContact, touchContact } = useContacts()
  const { meetings, addMeeting, updateMeeting, deleteMeeting, toggleActionItem, addActionItem } = useMeetings()
  const { goals, vision, activeGoals, addGoal, updateGoal, deleteGoal, saveVision } = useGoals()
  const { settings, saveSettings, saveGoogleToken, clearGoogleToken } = useSettings()
  const google = useGoogle(settings, saveGoogleToken, clearGoogleToken)

  // ── Task handlers ──────────────────────────────────
  const openAddTask = useCallback((defaults = {}) => setTaskModal({ open: true, task: defaults }), [])
  const openEditTask = useCallback((task) => {
    if (task.reschedule) { saveTask({ id: task.id, dueDate: task.newDate || task.dueDate }); return }
    setTaskModal({ open: true, task })
  }, [saveTask])
  const closeTaskModal = useCallback(() => setTaskModal({ open: false, task: null }), [])
  const handleSaveTask = useCallback((data) => { saveTask(data); closeTaskModal() }, [saveTask, closeTaskModal])

  const handleComplete = useCallback((id) => {
    completeTask(id)
    if (settings.celebrationsEnabled !== false) setCelebration(true)
  }, [completeTask, settings.celebrationsEnabled])

  // ── Meeting handlers ───────────────────────────────
  const openAddMeeting = useCallback((defaults = {}) => setMeetingModal({ open: true, meeting: defaults }), [])
  const openEditMeeting = useCallback((m) => setMeetingModal({ open: true, meeting: m }), [])
  const closeMeetingModal = useCallback(() => setMeetingModal({ open: false, meeting: null }), [])
  const handleSaveMeeting = useCallback((data) => {
    if (data.id) updateMeeting(data.id, data)
    else addMeeting(data)
    closeMeetingModal()
  }, [addMeeting, updateMeeting, closeMeetingModal])

  const handlePushActionToTask = useCallback((meetingId, actionItem) => {
    const meeting = meetings.find(m => m.id === meetingId)
    saveTask({
      title: actionItem.title,
      dueDate: actionItem.dueDate || null,
      companyId: meeting?.companyId || null,
      priority: 'medium',
      notes: `From meeting: ${meeting?.title || ''}`,
    })
    // Mark as pushed (find and update)
    const m = meetings.find(m => m.id === meetingId)
    if (m) {
      const taskId = `task_pushed_${Date.now()}`
      updateMeeting(meetingId, {
        actionItems: (m.actionItems||[]).map(ai => ai.id === actionItem.id ? { ...ai, taskId } : ai)
      })
    }
  }, [meetings, saveTask, updateMeeting])

  // ── Google Drive backup ────────────────────────────
  const handleBackup = useCallback(async () => {
    const data = {
      tasks: storage.get('tasks', []),
      sprint: storage.get('sprint', null),
      notes: storage.get('notes', []),
      contacts: storage.get('contacts', []),
      meetings: storage.get('meetings', []),
      goals: storage.get('goals', []),
      vision: storage.get('vision', ''),
      companies: storage.get('companies', []),
      exportedAt: new Date().toISOString(),
    }
    return google.backupToDrive(data)
  }, [google])

  // ── Client filter ──────────────────────────────────
  const filterByClient = useCallback((items, key = 'companyId') =>
    activeClient ? items.filter(i => i[key] === activeClient) : items,
  [activeClient])

  // ── First run ──────────────────────────────────────
  if (!sprint && !showSprintSetup) {
    return <SprintSetup onSave={saveSprint} />
  }
  if (showSprintSetup) {
    return <SprintSetup onSave={(d) => { saveSprint(d); setShowSprintSetup(false) }} />
  }

  const renderView = () => {
    const filteredTodayTasks = filterByClient(todayTasks)
    const filteredWeekTasks = filterByClient(allThisWeekTasks)
    const filteredMissedTasks = filterByClient(missedTasks)

    switch (activeView) {
      case 'dashboard':
        return <Dashboard
          tasks={tasks} todayTasks={filteredTodayTasks} missedTasks={filteredMissedTasks}
          allThisWeekTasks={filteredWeekTasks} meetings={filterByClient(meetings)}
          contacts={contacts} goals={activeGoals} vision={vision}
          companies={companies} activeClient={activeClient}
          completedToday={completedToday} currentWeek={currentWeek} progress={progress}
          todayEvents={google.todayEvents} calendarConnected={google.isConnected()}
          setActiveView={setActiveView} onAddTask={openAddTask}
        />
      case 'today':
        return <Today tasks={filteredTodayTasks} companies={companies}
          onAdd={openAddTask} onComplete={handleComplete} onUncomplete={uncompleteTask}
          onEdit={openEditTask} onDelete={deleteTask} completedToday={completedToday}
          onFocus={(t) => { /* focus mode hook point */ }}
        />
      case 'week':
        return <ThisWeek allTasks={filteredWeekTasks} companies={companies}
          onAdd={openAddTask} onComplete={handleComplete} onUncomplete={uncompleteTask}
          onEdit={openEditTask} onDelete={deleteTask}
        />
      case 'missed':
        return <Missed tasks={filteredMissedTasks} companies={companies}
          onComplete={handleComplete} onUncomplete={uncompleteTask}
          onEdit={openEditTask} onDelete={deleteTask}
        />
      case 'meetings':
        return <Meetings meetings={filterByClient(meetings)} companies={companies} activeClient={activeClient}
          onAddMeeting={() => openAddMeeting()} onEditMeeting={openEditMeeting} onDeleteMeeting={deleteMeeting}
          onToggleActionItem={toggleActionItem} onPushToTask={handlePushActionToTask} onAddActionItem={addActionItem}
        />
      case 'relationships':
        return <Relationships contacts={filterByClient(contacts)} companies={companies} activeClient={activeClient}
          onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onTouch={touchContact}
        />
      case 'goals':
        return <Goals goals={filterByClient(goals)} vision={vision} companies={companies} activeClient={activeClient}
          onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} onSaveVision={saveVision}
        />
      case 'briefing':
        return <Briefing tasks={tasks} meetings={meetings} goals={activeGoals} vision={vision}
          calendarEvents={google.calendarEvents} settings={settings}
          onOpenSettings={() => setActiveView('settings')}
        />
      case 'notes':
        return <Notes notes={notes} onAdd={addNote} onDelete={deleteNote} onTogglePin={togglePin} />
      case 'sprint':
        return <SprintView sprint={sprint} currentWeek={currentWeek} progress={progress} tasks={tasks}
          onUpdateWeekGoal={updateWeekGoal} onUpdateGoal={updateSprintGoal} onReset={resetSprint}
        />
      case 'settings':
        return <Settings settings={settings} saveSettings={saveSettings} google={google} onBackup={handleBackup} />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-surface-100 overflow-hidden">
      <Sidebar
        activeView={activeView} setActiveView={setActiveView}
        missedCount={missedTasks.filter(t=>t.status==='todo').length}
        completedToday={completedToday} onSettings={() => setActiveView('settings')}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <VisionBar vision={vision} onSave={saveVision} />
        <WeekBanner sprint={sprint} currentWeek={currentWeek} progress={progress} onEdit={() => setShowSprintSetup(true)} />
        <ClientFilter companies={companies} activeClient={activeClient} onSelect={setActiveClient} />
        <div className="flex-1 overflow-hidden pb-14 md:pb-0">
          {renderView()}
        </div>
      </div>
      <MobileNav activeView={activeView} setActiveView={setActiveView} missedCount={missedTasks.filter(t=>t.status==='todo').length} />
      {taskModal.open && <TaskModal task={taskModal.task} companies={companies} onSave={handleSaveTask} onClose={closeTaskModal} />}
      {meetingModal.open && <MeetingModal meeting={meetingModal.meeting} companies={companies} onSave={handleSaveMeeting} onClose={closeMeetingModal} />}
      <CelebrationBurst active={celebration} onDone={() => setCelebration(false)} />
    </div>
  )
}

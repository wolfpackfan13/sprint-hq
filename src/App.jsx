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
import { useProjects } from './hooks/useProjects'
import { useInvoices } from './hooks/useInvoices'
import { useTimer } from './hooks/useTimer'
import { storage } from './utils/storage'

import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { TaskModal } from './components/TaskModal'
import { MeetingModal } from './components/MeetingModal'
import { SprintSetup } from './components/SprintSetup'
import { CelebrationBurst } from './components/Celebration'
import { BreakdownModal } from './components/BreakdownModal'

import { DoView } from './views/DoView'
import { ThisWeek } from './views/ThisWeek'
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

export default function App() {
  const [activeView, setActiveView] = useState('do')
  const [activeClient, setActiveClient] = useState(null)
  const [taskModal, setTaskModal] = useState({ open: false, task: null })
  const [meetingModal, setMeetingModal] = useState({ open: false, meeting: null })
  const [breakdownModal, setBreakdownModal] = useState({ open: false, task: null })
  const [showSprintSetup, setShowSprintSetup] = useState(false)
  const [celebration, setCelebration] = useState(false)

  const tasksApi = useTasks()
  const {
    tasks, todayTasks, allThisWeekTasks, missedTasks, top3Tasks, completedToday,
    tasksForProject, saveTask, completeTask, uncompleteTask, deleteTask,
    toggleTop3, setSubtasks, toggleSubtask, addTimeEntry,
  } = tasksApi

  const { sprint, saveSprint, updateWeekGoal, updateSprintGoal, resetSprint, currentWeek, progress } = useSprint()
  const { notes, addNote, deleteNote, togglePin } = useNotes()
  const { companies, addCompany, updateCompany, deleteCompany } = useCompanies()
  const { contacts, addContact, updateContact, deleteContact, touchContact } = useContacts()
  const { meetings, addMeeting, updateMeeting, deleteMeeting, toggleActionItem, addActionItem } = useMeetings()
  const { goals, vision, activeGoals, addGoal, updateGoal, deleteGoal, saveVision } = useGoals()
  const { settings, saveSettings, saveGoogleToken, clearGoogleToken } = useSettings()
  const google = useGoogle(settings, saveGoogleToken, clearGoogleToken)
  const { projects, activeProjects, addProject, updateProject, deleteProject } = useProjects()
  const { invoices, profile: invoiceProfile, saveProfile, saveInvoice } = useInvoices()
  const timer = useTimer((taskId, secs) => addTimeEntry(taskId, secs))

  // ── Task handlers ──
  const openAddTask = useCallback((d = {}) => setTaskModal({ open: true, task: d }), [])
  const openEditTask = useCallback((task) => {
    if (task.reschedule || (task.id && task.dueDate !== undefined && Object.keys(task).length <= 4 && !task.title)) {
      saveTask({ id: task.id, ...task }); return
    }
    setTaskModal({ open: true, task })
  }, [saveTask])
  const closeTaskModal = useCallback(() => setTaskModal({ open: false, task: null }), [])
  const handleSaveTask = useCallback((data) => { saveTask(data); closeTaskModal() }, [saveTask, closeTaskModal])
  const handleComplete = useCallback((id) => {
    completeTask(id)
    if (settings.celebrationsEnabled !== false) setCelebration(true)
  }, [completeTask, settings.celebrationsEnabled])

  // For Missed/Review reschedule — direct save without opening modal
  const rescheduleTask = useCallback((task) => { saveTask({ id: task.id, dueDate: task.dueDate }) }, [saveTask])

  // ── Breakdown ──
  const openBreakdown = useCallback((task) => {
    if (!settings.anthropicKey) { setActiveView('settings'); return }
    setBreakdownModal({ open: true, task })
  }, [settings.anthropicKey])
  const applyBreakdown = useCallback((taskId, subtasks) => { setSubtasks(taskId, subtasks) }, [setSubtasks])

  // ── Meeting handlers ──
  const handleSaveMeeting = useCallback((data) => {
    if (data.id) updateMeeting(data.id, data); else addMeeting(data)
    setMeetingModal({ open: false, meeting: null })
  }, [addMeeting, updateMeeting])
  const handlePushActionToTask = useCallback((meetingId, actionItem) => {
    const meeting = meetings.find(m => m.id === meetingId)
    saveTask({ title: actionItem.title, dueDate: actionItem.dueDate || null, companyId: meeting?.companyId || null, priority: 'medium', notes: `From meeting: ${meeting?.title || ''}` })
    if (meeting) updateMeeting(meetingId, { actionItems: (meeting.actionItems||[]).map(ai => ai.id === actionItem.id ? { ...ai, taskId: `pushed_${Date.now()}` } : ai) })
  }, [meetings, saveTask, updateMeeting])

  // ── Backup ──
  const handleBackup = useCallback(async () => {
    const data = {}
    ;['tasks','sprint','notes','contacts','meetings','goals','vision','companies','projects','invoices','invoiceProfile','settings'].forEach(k => { data[k] = storage.get(k, null) })
    data.exportedAt = new Date().toISOString()
    return google.backupToDrive(data)
  }, [google])

  const filterByClient = useCallback((items, key = 'companyId') => activeClient ? items.filter(i => i[key] === activeClient) : items, [activeClient])

  // ── First run ──
  if (!sprint && !showSprintSetup) return <SprintSetup onSave={saveSprint} />
  if (showSprintSetup) return <SprintSetup onSave={(d) => { saveSprint(d); setShowSprintSetup(false) }} />

  // Shared props for TaskCard across views
  const taskCardProps = {
    companies, projects,
    onComplete: handleComplete, onUncomplete: uncompleteTask, onEdit: openEditTask, onDelete: deleteTask,
    timer, onToggleTimer: timer.toggle, onToggleSubtask: toggleSubtask, onBreakdown: openBreakdown, onToggleTop3: toggleTop3,
  }

  const renderView = () => {
    switch (activeView) {
      case 'do':
        return <DoView
          todayTasks={filterByClient(todayTasks)} top3Tasks={filterByClient(top3Tasks)} missedTasks={filterByClient(missedTasks)}
          companies={companies} projects={projects}
          onAdd={openAddTask} onComplete={handleComplete} onUncomplete={uncompleteTask} onEdit={openEditTask} onDelete={deleteTask}
          completedToday={completedToday} timer={timer} onToggleTimer={timer.toggle} onToggleSubtask={toggleSubtask} onBreakdown={openBreakdown} onToggleTop3={toggleTop3}
        />
      case 'week':
        return <ThisWeek allTasks={filterByClient(allThisWeekTasks)} companies={companies} projects={projects} onAdd={openAddTask} taskCardProps={taskCardProps} />
      case 'projects':
        return <Projects projects={activeProjects} companies={companies} goals={goals} activeClient={activeClient} tasksForProject={tasksForProject}
          onAddProject={addProject} onUpdateProject={updateProject} onDeleteProject={deleteProject} taskCardProps={taskCardProps} />
      case 'meetings':
        return <Meetings meetings={filterByClient(meetings)} companies={companies} activeClient={activeClient}
          onAddMeeting={() => setMeetingModal({ open: true, meeting: {} })} onEditMeeting={(m) => setMeetingModal({ open: true, meeting: m })} onDeleteMeeting={deleteMeeting}
          onToggleActionItem={toggleActionItem} onPushToTask={handlePushActionToTask} onAddActionItem={addActionItem} />
      case 'relationships':
        return <Relationships contacts={filterByClient(contacts)} companies={companies} activeClient={activeClient}
          onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onTouch={touchContact} />
      case 'goals':
        return <Goals goals={filterByClient(goals)} vision={vision} companies={companies} activeClient={activeClient}
          onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} onSaveVision={saveVision} />
      case 'hours':
        return <Hours tasks={filterByClient(tasks)} companies={companies} projects={projects}
          invoiceProfile={invoiceProfile} onSaveProfile={saveProfile} onSaveInvoice={saveInvoice} />
      case 'review':
        return <WeeklyReview tasks={tasks} companies={companies} currentWeek={currentWeek} sprint={sprint}
          onEditTask={rescheduleTask} onAddTask={openAddTask} />
      case 'briefing':
        return <Briefing tasks={tasks} meetings={meetings} goals={activeGoals} vision={vision}
          calendarEvents={google.calendarEvents} settings={settings} onOpenSettings={() => setActiveView('settings')} />
      case 'notes':
        return <Notes notes={notes} onAdd={addNote} onDelete={deleteNote} onTogglePin={togglePin} />
      case 'sprint':
        return <SprintView sprint={sprint} currentWeek={currentWeek} progress={progress} tasks={tasks}
          onUpdateWeekGoal={updateWeekGoal} onUpdateGoal={updateSprintGoal} onReset={resetSprint} />
      case 'settings':
        return <Settings settings={settings} saveSettings={saveSettings} google={google} onBackup={handleBackup}
          companies={companies} onAddCompany={addCompany} onUpdateCompany={updateCompany} onDeleteCompany={deleteCompany} />
      default:
        return null
    }
  }

  const missedCount = missedTasks.filter(t => t.status === 'todo').length

  return (
    <div className="flex h-screen bg-surface-100 overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} missedCount={missedCount} completedToday={completedToday} onSettings={() => setActiveView('settings')} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar sprint={sprint} currentWeek={currentWeek} progress={progress} vision={vision} onSaveVision={saveVision}
          onEditSprint={() => setShowSprintSetup(true)} companies={companies} activeClient={activeClient} onSelectClient={setActiveClient} />
        <div className="flex-1 overflow-hidden pb-14 md:pb-0">{renderView()}</div>
      </div>
      <MobileNav activeView={activeView} setActiveView={setActiveView} missedCount={missedCount} />
      {taskModal.open && <TaskModal task={taskModal.task} companies={companies} projects={projects} onSave={handleSaveTask} onClose={closeTaskModal} />}
      {meetingModal.open && <MeetingModal meeting={meetingModal.meeting} companies={companies} onSave={handleSaveMeeting} onClose={() => setMeetingModal({ open: false, meeting: null })} />}
      {breakdownModal.open && <BreakdownModal task={breakdownModal.task} apiKey={settings.anthropicKey} onApply={applyBreakdown} onClose={() => setBreakdownModal({ open: false, task: null })} />}
      <CelebrationBurst active={celebration} onDone={() => setCelebration(false)} />
    </div>
  )
}

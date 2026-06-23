import { useState, useCallback, useEffect } from 'react'
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
import { ProjectModal } from './components/ProjectModal'
import { SprintSetup } from './components/SprintSetup'
import { CelebrationBurst } from './components/Celebration'
import { BreakdownModal } from './components/BreakdownModal'

import { DoView } from './views/DoView'
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

export default function App() {
  const [activeView, setActiveView] = useState('do')
  const [activeClient, setActiveClient] = useState(null)
  const [taskModal, setTaskModal] = useState({ open: false, task: null })
  const [meetingModal, setMeetingModal] = useState({ open: false, meeting: null })
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [breakdownModal, setBreakdownModal] = useState({ open: false, task: null })
  const [showSprintSetup, setShowSprintSetup] = useState(false)
  const [celebration, setCelebration] = useState(false)

  const {
    tasks, todayTasks, allThisWeekTasks, missedTasks, top3Tasks, completedToday,
    tasksForProject, saveTask, completeTask, uncompleteTask, deleteTask,
    toggleTop3, setSubtasks, toggleSubtask, addTimeEntry, addManualTimeEntry, updateTimeEntry, deleteTimeEntry, setResources,
  } = useTasks()

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
  const openEditTask = useCallback((task) => setTaskModal({ open: true, task }), [])
  const closeTaskModal = useCallback(() => setTaskModal({ open: false, task: null }), [])
  const handleSaveTask = useCallback((data) => { saveTask(data); closeTaskModal() }, [saveTask, closeTaskModal])
  const handleComplete = useCallback((id) => {
    completeTask(id)
    if (settings.celebrationsEnabled !== false) setCelebration(true)
  }, [completeTask, settings.celebrationsEnabled])
  const rescheduleTask = useCallback((taskId, date) => { saveTask({ id: taskId, dueDate: date }) }, [saveTask])

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
      return { ...ai, taskId: newTask?.id || `linked_${Date.now()}` }
    })
    const payload = { ...data, actionItems: updatedItems }
    if (payload.id) updateMeeting(payload.id, payload); else addMeeting(payload)
    setMeetingModal({ open: false, meeting: null })
  }, [addMeeting, updateMeeting, saveTask])

  const handlePushActionToTask = useCallback((meetingId, actionItem) => {
    const meeting = meetings.find(m => m.id === meetingId)
    const newTask = saveTask({ title: actionItem.title, dueDate: actionItem.dueDate || null, companyId: meeting?.companyId || null, projectId: meeting?.projectId || null, priority: 'medium', notes: `From meeting: ${meeting?.title || ''}` })
    if (meeting) updateMeeting(meetingId, { actionItems: (meeting.actionItems||[]).map(ai => ai.id === actionItem.id ? { ...ai, taskId: newTask?.id || `pushed_${Date.now()}` } : ai) })
  }, [meetings, saveTask, updateMeeting])

  // ── Backup ──
  const handleBackup = useCallback(async () => {
    const data = {}
    ;['tasks','sprint','notes','contacts','meetings','goals','vision','companies','projects','invoices','invoiceProfile','settings'].forEach(k => { data[k] = storage.get(k, null) })
    data.exportedAt = new Date().toISOString()
    return google.backupToDrive(data)
  }, [google])

  const filterByClient = useCallback((items, key = 'companyId') => activeClient ? items.filter(i => i[key] === activeClient) : items, [activeClient])

  // ── Keyboard shortcut: N or C for quick capture ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (taskModal.open || meetingModal.open || projectModal.open || breakdownModal.open) return
      if ((e.key === 'n' || e.key === 'c') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        openAddTask({ dueDate: activeView === 'do' ? new Date().toISOString().split('T')[0] : null })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [taskModal.open, meetingModal.open, projectModal.open, breakdownModal.open, activeView, openAddTask])

  // ── First run ──
  if (!sprint && !showSprintSetup) return <SprintSetup onSave={saveSprint} />
  if (showSprintSetup) return <SprintSetup onSave={(d) => { saveSprint(d); setShowSprintSetup(false) }} />

  const taskCardProps = {
    companies, projects,
    onComplete: handleComplete, onUncomplete: uncompleteTask, onEdit: openEditTask, onDelete: deleteTask,
    timer, onToggleTimer: timer.toggle, onToggleSubtask: toggleSubtask, onBreakdown: openBreakdown, onToggleTop3: toggleTop3,
  }

  const renderView = () => {
    switch (activeView) {
      case 'do':
        return <DoView todayTasks={filterByClient(todayTasks)} top3Tasks={filterByClient(top3Tasks)} missedTasks={filterByClient(missedTasks)}
          companies={companies} projects={projects} onAdd={openAddTask} onComplete={handleComplete} onUncomplete={uncompleteTask} onEdit={openEditTask} onDelete={deleteTask}
          completedToday={completedToday} timer={timer} onToggleTimer={timer.toggle} onToggleSubtask={toggleSubtask} onBreakdown={openBreakdown} onToggleTop3={toggleTop3} />
      case 'week':
        return <WeekBoard allTasks={filterByClient(allThisWeekTasks)} companies={companies} projects={projects}
          onAdd={openAddTask} onComplete={handleComplete} onEdit={openEditTask} onReschedule={rescheduleTask} />
      case 'projects':
        return <Projects projects={activeProjects} companies={companies} goals={goals} activeClient={activeClient} tasksForProject={tasksForProject}
          onAddProject={addProject} onUpdateProject={updateProject} onDeleteProject={deleteProject} taskCardProps={taskCardProps} />
      case 'meetings':
        return <Meetings meetings={filterByClient(meetings)} companies={companies} projects={projects} activeClient={activeClient}
          onAddMeeting={() => setMeetingModal({ open: true, meeting: {} })} onEditMeeting={(m) => setMeetingModal({ open: true, meeting: m })} onDeleteMeeting={deleteMeeting}
          onToggleActionItem={toggleActionItem} onPushToTask={handlePushActionToTask} onAddActionItem={addActionItem} />
      case 'relationships':
        return <Relationships contacts={filterByClient(contacts)} companies={companies} activeClient={activeClient} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onTouch={touchContact} />
      case 'goals':
        return <Goals goals={filterByClient(goals)} vision={vision} companies={companies} activeClient={activeClient} onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} onSaveVision={saveVision} />
      case 'hours':
        return <Hours tasks={filterByClient(tasks)} companies={companies} projects={projects} invoiceProfile={invoiceProfile} onSaveProfile={saveProfile} onSaveInvoice={saveInvoice} />
      case 'review':
        return <WeeklyReview tasks={tasks} companies={companies} currentWeek={currentWeek} sprint={sprint} onEditTask={(t) => rescheduleTask(t.id, t.dueDate)} onAddTask={openAddTask} />
      case 'briefing':
        return <Briefing tasks={tasks} meetings={meetings} goals={activeGoals} vision={vision} calendarEvents={google.calendarEvents} settings={settings} onOpenSettings={() => setActiveView('settings')} />
      case 'notes':
        return <Notes notes={notes} onAdd={addNote} onDelete={deleteNote} onTogglePin={togglePin} />
      case 'sprint':
        return <SprintView sprint={sprint} currentWeek={currentWeek} progress={progress} tasks={tasks} onUpdateWeekGoal={updateWeekGoal} onUpdateGoal={updateSprintGoal} onReset={resetSprint} />
      case 'settings':
        return <Settings settings={settings} saveSettings={saveSettings} google={google} onBackup={handleBackup} companies={companies} onAddCompany={addCompany} onUpdateCompany={updateCompany} onDeleteCompany={deleteCompany} />
      default: return null
    }
  }

  const missedCount = missedTasks.filter(t => t.status === 'todo').length

  return (
    <div className="flex h-screen bg-surface-100 overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} missedCount={missedCount} completedToday={completedToday} onSettings={() => setActiveView('settings')} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar sprint={sprint} currentWeek={currentWeek} progress={progress} vision={vision} onSaveVision={saveVision}
          onEditSprint={() => setShowSprintSetup(true)} companies={companies} activeClient={activeClient} onSelectClient={setActiveClient}
          onNewTask={() => openAddTask({ dueDate: new Date().toISOString().split('T')[0] })} onNewProject={() => openAddProject({ companyId: activeClient })}
          onNewMeeting={() => setMeetingModal({ open: true, meeting: {} })} onBriefing={() => setActiveView('briefing')} />
        <div className="flex-1 overflow-hidden pb-14 md:pb-0">{renderView()}</div>
      </div>
      <MobileNav activeView={activeView} setActiveView={setActiveView} missedCount={missedCount} />
      {taskModal.open && <TaskModal task={taskModal.task} companies={companies} projects={projects} onSave={handleSaveTask} onClose={closeTaskModal} onBreakdown={openBreakdown} timeHandlers={timeHandlers} />}
      {meetingModal.open && <MeetingModal meeting={meetingModal.meeting} companies={companies} projects={projects} onSave={handleSaveMeeting} onClose={() => setMeetingModal({ open: false, meeting: null })} />}
      {projectModal.open && <ProjectModal project={projectModal.project} companies={companies} goals={goals} defaultCompanyId={projectModal.project?.companyId} onSave={handleSaveProject} onClose={() => setProjectModal({ open: false, project: null })} />}
      {breakdownModal.open && <BreakdownModal task={breakdownModal.task} apiKey={settings.anthropicKey} onApply={applyBreakdown} onClose={() => setBreakdownModal({ open: false, task: null })} />}
      <CelebrationBurst active={celebration} onDone={() => setCelebration(false)} />
    </div>
  )
}

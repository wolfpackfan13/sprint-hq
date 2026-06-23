import { useState, useCallback } from 'react'
import { useTasks } from './hooks/useTasks'
import { useSprint } from './hooks/useSprint'
import { useNotes } from './hooks/useNotes'
import { WeekBanner } from './components/WeekBanner'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { TaskModal } from './components/TaskModal'
import { SprintSetup } from './components/SprintSetup'
import { Today } from './views/Today'
import { ThisWeek } from './views/ThisWeek'
import { Missed } from './views/Missed'
import { Notes } from './views/Notes'
import { SprintView } from './views/SprintView'

export default function App() {
  const [activeView, setActiveView] = useState('today')
  const [taskModal, setTaskModal] = useState({ open: false, task: null })
  const [showSprintSetup, setShowSprintSetup] = useState(false)

  const {
    tasks, todayTasks, allThisWeekTasks, missedTasks,
    completedToday, saveTask, completeTask, uncompleteTask, deleteTask
  } = useTasks()

  const {
    sprint, saveSprint, updateWeekGoal, updateSprintGoal, resetSprint,
    currentWeek, progress
  } = useSprint()

  const { notes, addNote, deleteNote, togglePin } = useNotes()

  const openAddTask = useCallback((defaults = {}) => {
    setTaskModal({ open: true, task: defaults })
  }, [])

  const openEditTask = useCallback((task) => {
    // Handle reschedule shortcut from Missed view
    if (task.reschedule) {
      saveTask({ id: task.id, dueDate: task.newDate })
      return
    }
    setTaskModal({ open: true, task })
  }, [saveTask])

  const closeModal = useCallback(() => {
    setTaskModal({ open: false, task: null })
  }, [])

  const handleSaveTask = useCallback((taskData) => {
    saveTask(taskData)
    closeModal()
  }, [saveTask, closeModal])

  // First-run: no sprint configured
  if (!sprint && !showSprintSetup) {
    return (
      <SprintSetup
        onSave={(data) => {
          saveSprint(data)
        }}
      />
    )
  }

  // Sprint settings re-setup
  if (showSprintSetup) {
    return (
      <SprintSetup
        onSave={(data) => {
          saveSprint(data)
          setShowSprintSetup(false)
        }}
      />
    )
  }

  const renderView = () => {
    switch (activeView) {
      case 'today':
        return (
          <Today
            tasks={todayTasks}
            completedToday={completedToday}
            onAdd={openAddTask}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={openEditTask}
            onDelete={deleteTask}
          />
        )
      case 'week':
        return (
          <ThisWeek
            tasks={allThisWeekTasks}
            allTasks={allThisWeekTasks}
            onAdd={openAddTask}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={openEditTask}
            onDelete={deleteTask}
          />
        )
      case 'missed':
        return (
          <Missed
            tasks={missedTasks}
            onAdd={openAddTask}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={openEditTask}
            onDelete={deleteTask}
          />
        )
      case 'notes':
        return (
          <Notes
            notes={notes}
            onAdd={addNote}
            onDelete={deleteNote}
            onTogglePin={togglePin}
          />
        )
      case 'sprint':
        return (
          <SprintView
            sprint={sprint}
            currentWeek={currentWeek}
            progress={progress}
            tasks={tasks}
            onUpdateWeekGoal={updateWeekGoal}
            onUpdateGoal={updateSprintGoal}
            onReset={() => {
              resetSprint()
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        missedCount={missedTasks.filter(t => t.status === 'todo').length}
        completedToday={completedToday}
        onSettings={() => setShowSprintSetup(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Week progress banner */}
        <WeekBanner
          sprint={sprint}
          currentWeek={currentWeek}
          progress={progress}
          onEdit={() => setShowSprintSetup(true)}
        />

        {/* View content — scrollable */}
        <div className="flex-1 overflow-hidden pb-16 md:pb-0">
          {renderView()}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav
        activeView={activeView}
        setActiveView={setActiveView}
        missedCount={missedTasks.filter(t => t.status === 'todo').length}
      />

      {/* Task modal */}
      {taskModal.open && (
        <TaskModal
          task={taskModal.task}
          onSave={handleSaveTask}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

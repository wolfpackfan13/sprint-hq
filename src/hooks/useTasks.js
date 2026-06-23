import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import { dateUtils } from '../utils/dateUtils'

const genId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export function useTasks() {
  const [tasks, setTasks] = useState(() => storage.get('tasks', []))

  const persist = (updated) => { storage.set('tasks', updated); return updated }

  const addTask = useCallback((data) => {
    let created
    setTasks(prev => {
      created = {
        id: genId(),
        title: data.title || '',
        notes: data.notes || '',
        companyId: data.companyId || null,
        projectId: data.projectId || null,
        dueDate: data.dueDate || null,
        priority: data.priority || 'medium',
        status: 'todo',
        isTop3: data.isTop3 || false,
        subtasks: data.subtasks || [],        // [{id, title, done}]
        timeEntries: data.timeEntries || [],  // [{id, start, end, seconds, manual, note}]
        resources: data.resources || [],      // [{id, label, url}]
        createdAt: new Date().toISOString(),
        completedAt: null,
      }
      return persist([...prev, created])
    })
    return created
  }, [])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => persist(prev.map(t => t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const deleteTask = useCallback((id) => {
    setTasks(prev => persist(prev.filter(t => t.id !== id)))
  }, [])

  const completeTask = useCallback((id) => {
    setTasks(prev => persist(prev.map(t =>
      t.id === id ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t
    )))
  }, [])

  const uncompleteTask = useCallback((id) => {
    setTasks(prev => persist(prev.map(t =>
      t.id === id ? { ...t, status: 'todo', completedAt: null } : t
    )))
  }, [])

  const toggleTop3 = useCallback((id) => {
    setTasks(prev => {
      const current = prev.find(t => t.id === id)
      const top3Count = prev.filter(t => t.isTop3 && t.dueDate === dateUtils.today() && t.status === 'todo').length
      if (!current.isTop3 && top3Count >= 3) return prev  // cap at 3
      return persist(prev.map(t => t.id === id ? { ...t, isTop3: !t.isTop3 } : t))
    })
  }, [])

  // ── Subtasks ───────────────────────────────────
  const setSubtasks = useCallback((id, subtasks) => {
    setTasks(prev => persist(prev.map(t => t.id === id ? { ...t, subtasks } : t)))
  }, [])

  const toggleSubtask = useCallback((taskId, subId) => {
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: (t.subtasks||[]).map(s => s.id === subId ? { ...s, done: !s.done } : s) }
    })))
  }, [])

  // ── Time tracking ──────────────────────────────
  const addTimeEntry = useCallback((id, seconds) => {
    if (!seconds || seconds < 1) return
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== id) return t
      const entry = { id: `te_${Date.now()}`, start: new Date(Date.now() - seconds*1000).toISOString(), end: new Date().toISOString(), seconds }
      return { ...t, timeEntries: [...(t.timeEntries||[]), entry] }
    })))
  }, [])

  const addManualTimeEntry = useCallback((id, seconds, dateStr, note='') => {
    if (!seconds || seconds < 1) return
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== id) return t
      const when = dateStr ? new Date(dateStr + 'T12:00:00').toISOString() : new Date().toISOString()
      const entry = { id: `te_${Date.now()}`, start: when, end: when, seconds, manual: true, note }
      return { ...t, timeEntries: [...(t.timeEntries||[]), entry] }
    })))
  }, [])

  const updateTimeEntry = useCallback((taskId, entryId, seconds) => {
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, timeEntries: (t.timeEntries||[]).map(e => e.id === entryId ? { ...e, seconds } : e) }
    })))
  }, [])

  const deleteTimeEntry = useCallback((taskId, entryId) => {
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, timeEntries: (t.timeEntries||[]).filter(e => e.id !== entryId) }
    })))
  }, [])

  const setResources = useCallback((id, resources) => {
    setTasks(prev => persist(prev.map(t => t.id === id ? { ...t, resources } : t)))
  }, [])

  const saveTask = useCallback((data) => {
    if (data.id) updateTask(data.id, data)
    else addTask(data)
  }, [addTask, updateTask])

  // ── Derived views ──────────────────────────────
  const sortByPriority = (arr) => {
    const order = { high: 0, medium: 1, low: 2 }
    return [...arr].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
    })
  }

  const today = dateUtils.today()
  const todayTasks = tasks.filter(t => dateUtils.isToday(t.dueDate))
  const allThisWeekTasks = tasks.filter(t => dateUtils.isThisWeek(t.dueDate))
  const missedTasks = tasks.filter(t => dateUtils.isMissed(t))
  const top3Tasks = tasks.filter(t => t.isTop3 && t.dueDate === today && t.status === 'todo')

  const completedToday = tasks.filter(t =>
    t.status === 'done' && t.completedAt && t.completedAt.split('T')[0] === today
  ).length

  const tasksForProject = (projectId) => tasks.filter(t => t.projectId === projectId)

  return {
    tasks,
    todayTasks: sortByPriority(todayTasks),
    allThisWeekTasks: sortByPriority(allThisWeekTasks),
    missedTasks: sortByPriority(missedTasks),
    top3Tasks,
    completedToday,
    tasksForProject,
    addTask, updateTask, deleteTask, completeTask, uncompleteTask, saveTask,
    toggleTop3, setSubtasks, toggleSubtask, addTimeEntry, addManualTimeEntry, updateTimeEntry, deleteTimeEntry, setResources,
  }
}

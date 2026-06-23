import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import { dateUtils } from '../utils/dateUtils'

const genId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export function useTasks() {
  const [tasks, setTasks] = useState(() => storage.get('tasks', []))

  const persist = useCallback((newTasks) => {
    setTasks(newTasks)
    storage.set('tasks', newTasks)
  }, [])

  const addTask = useCallback((data) => {
    const task = {
      id: genId(),
      title: data.title || '',
      notes: data.notes || '',
      project: data.project || null,
      projectColor: data.projectColor || null,
      dueDate: data.dueDate || null,
      priority: data.priority || 'medium',
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    persist(prev => {
      const updated = [...(Array.isArray(prev) ? prev : tasks), task]
      storage.set('tasks', updated)
      return updated
    })
    return task
  }, [tasks, persist])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t)
      storage.set('tasks', updated)
      return updated
    })
  }, [])

  const deleteTask = useCallback((id) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id)
      storage.set('tasks', updated)
      return updated
    })
  }, [])

  const completeTask = useCallback((id) => {
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t
      )
      storage.set('tasks', updated)
      return updated
    })
  }, [])

  const uncompleteTask = useCallback((id) => {
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, status: 'todo', completedAt: null } : t
      )
      storage.set('tasks', updated)
      return updated
    })
  }, [])

  const saveTask = useCallback((data) => {
    if (data.id) {
      updateTask(data.id, data)
    } else {
      addTask(data)
    }
  }, [addTask, updateTask])

  // Filtered views
  const todayTasks = tasks.filter(t => dateUtils.isToday(t.dueDate))
  const thisWeekTasks = tasks.filter(t => dateUtils.isThisWeek(t.dueDate) && !dateUtils.isToday(t.dueDate))
  const allThisWeekTasks = tasks.filter(t => dateUtils.isThisWeek(t.dueDate))
  const missedTasks = tasks.filter(t => dateUtils.isMissed(t))

  const sortByPriority = (taskArr) => {
    const order = { high: 0, medium: 1, low: 2 }
    return [...taskArr].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
    })
  }

  const completedToday = tasks.filter(t =>
    t.status === 'done' && t.completedAt &&
    t.completedAt.split('T')[0] === dateUtils.today()
  ).length

  return {
    tasks,
    todayTasks: sortByPriority(todayTasks),
    thisWeekTasks: sortByPriority(thisWeekTasks),
    allThisWeekTasks: sortByPriority(allThisWeekTasks),
    missedTasks: sortByPriority(missedTasks),
    completedToday,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    saveTask,
  }
}

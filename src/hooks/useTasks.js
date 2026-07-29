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

  const bulkUpdate = useCallback((ids, updates) => {
    const idSet = new Set(ids)
    setTasks(prev => persist(prev.map(t => idSet.has(t.id) ? { ...t, ...updates } : t)))
  }, [])

  const bulkDelete = useCallback((ids) => {
    const idSet = new Set(ids)
    setTasks(prev => persist(prev.filter(t => !idSet.has(t.id))))
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

  // Atomic: log time to an existing task, or find/create a target task and
  // attach the entry — all in ONE setState so nothing is lost to a race.
  // target = { taskId?, companyId?, projectId?, title? }
  // opts = { dateStr? } — if provided, entry is dated (manual/past); else now.
  const logTimeToTarget = useCallback((target, seconds, opts = {}) => {
    if (!seconds || seconds < 1) return
    const { taskId, companyId = null, projectId = null, title } = target
    const { dateStr } = opts
    const when = dateStr ? new Date(dateStr + 'T12:00:00').toISOString() : new Date().toISOString()
    const makeEntry = () => ({ id: `te_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, start: when, end: when, seconds, manual: !!dateStr })

    setTasks(prev => {
      // 1. Explicit task id
      if (taskId) {
        const exists = prev.some(t => t.id === taskId)
        if (exists) return persist(prev.map(t => t.id === taskId ? { ...t, timeEntries: [...(t.timeEntries||[]), makeEntry()] } : t))
      }
      // 2. Find an existing matching "tracked time" task
      const label = (title && title.trim()) || 'Tracked time'
      const match = prev.find(t => t.title === label && (t.companyId||null) === companyId && (t.projectId||null) === projectId && t.status !== 'done')
      if (match) return persist(prev.map(t => t.id === match.id ? { ...t, timeEntries: [...(t.timeEntries||[]), makeEntry()] } : t))
      // 3. Create a new task WITH the entry already embedded (atomic)
      const created = {
        id: genId(), title: label, notes: '', companyId, projectId,
        dueDate: dateStr || new Date().toISOString().split('T')[0], priority: 'low',
        status: 'todo', isTop3: false, subtasks: [], timeEntries: [makeEntry()], resources: [],
        createdAt: new Date().toISOString(), completedAt: null,
      }
      return persist([...prev, created])
    })
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

  // ── Ledger operations ──────────────────────────
  // Patch arbitrary fields on one entry: seconds, start, end, note, billable, rate
  const patchTimeEntry = useCallback((taskId, entryId, patch) => {
    setTasks(prev => persist(prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, timeEntries: (t.timeEntries || []).map(e => e.id === entryId ? { ...e, ...patch } : e) }
    })))
  }, [])

  // Move time entries. refs = [{ taskId, entryId }]
  //   mode 'entry' — detach those entries and reattach them under the target
  //   mode 'task'  — leave entries alone, retag their parent task(s) instead
  // target = { companyId, projectId, taskId?, title? }
  const moveTimeEntries = useCallback((refs, target, mode = 'entry') => {
    if (!refs || refs.length === 0) return
    setTasks(prev => {
      if (mode === 'task') {
        const taskIds = new Set(refs.map(r => r.taskId))
        return persist(prev.map(t => taskIds.has(t.id)
          ? { ...t,
              companyId: target.companyId !== undefined ? target.companyId : t.companyId,
              projectId: target.projectId !== undefined ? target.projectId : t.projectId }
          : t))
      }

      // Entry mode: lift the entries out first, then land them in one pass
      const byTask = {}
      refs.forEach(r => { if (!byTask[r.taskId]) byTask[r.taskId] = new Set(); byTask[r.taskId].add(r.entryId) })
      const moving = []
      const next = prev.map(t => {
        const ids = byTask[t.id]
        if (!ids) return t
        const keep = []
        ;(t.timeEntries || []).forEach(e => { if (ids.has(e.id)) moving.push(e); else keep.push(e) })
        return { ...t, timeEntries: keep }
      })
      if (moving.length === 0) return prev

      if (target.taskId && next.some(t => t.id === target.taskId)) {
        return persist(next.map(t => t.id === target.taskId
          ? { ...t, timeEntries: [...(t.timeEntries || []), ...moving] } : t))
      }

      const companyId = target.companyId ?? null
      const projectId = target.projectId ?? null
      const label = (target.title && target.title.trim()) || 'Tracked time'
      const match = next.find(t => t.title === label && (t.companyId || null) === companyId
        && (t.projectId || null) === projectId && t.status !== 'done')
      if (match) {
        return persist(next.map(t => t.id === match.id
          ? { ...t, timeEntries: [...(t.timeEntries || []), ...moving] } : t))
      }

      const created = {
        id: genId(), title: label, notes: '', companyId, projectId,
        dueDate: new Date().toISOString().split('T')[0], priority: 'low',
        status: 'todo', isTop3: false, subtasks: [], timeEntries: moving, resources: [],
        createdAt: new Date().toISOString(), completedAt: null,
      }
      return persist([...next, created])
    })
  }, [])

  const deleteTimeEntries = useCallback((refs) => {
    if (!refs || refs.length === 0) return
    const byTask = {}
    refs.forEach(r => { if (!byTask[r.taskId]) byTask[r.taskId] = new Set(); byTask[r.taskId].add(r.entryId) })
    setTasks(prev => persist(prev.map(t => {
      const ids = byTask[t.id]
      if (!ids) return t
      return { ...t, timeEntries: (t.timeEntries || []).filter(e => !ids.has(e.id)) }
    })))
  }, [])

  const setResources = useCallback((id, resources) => {
    setTasks(prev => persist(prev.map(t => t.id === id ? { ...t, resources } : t)))
  }, [])

  const saveTask = useCallback((data) => {
    if (data.id) { updateTask(data.id, data); return { id: data.id } }
    return addTask(data)
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
  // A completed task only stays in active views on the day it was completed; after that it lives in the archive
  const completedTodayOnly = (t) => t.status !== 'done' || (t.completedAt && t.completedAt.split('T')[0] === today)
  const todayTasks = tasks.filter(t => dateUtils.isToday(t.dueDate) && completedTodayOnly(t))
  const allThisWeekTasks = tasks.filter(t => dateUtils.isThisWeek(t.dueDate) && completedTodayOnly(t))
  const missedTasks = tasks.filter(t => dateUtils.isMissed(t))
  const top3Tasks = tasks.filter(t => t.isTop3 && t.dueDate === today && t.status === 'todo')
  const unscheduledTasks = tasks.filter(t => !t.dueDate && t.status === 'todo')

  const completedToday = tasks.filter(t =>
    t.status === 'done' && t.completedAt && t.completedAt.split('T')[0] === today
  ).length

  const tasksForProject = (projectId) => tasks.filter(t => t.projectId === projectId)

  return {
    tasks,
    todayTasks: sortByPriority(todayTasks),
    unscheduledTasks: sortByPriority(unscheduledTasks),
    allThisWeekTasks: sortByPriority(allThisWeekTasks),
    missedTasks: sortByPriority(missedTasks),
    top3Tasks,
    completedToday,
    tasksForProject,
    addTask, updateTask, deleteTask, bulkUpdate, bulkDelete, completeTask, uncompleteTask, saveTask,
    toggleTop3, setSubtasks, toggleSubtask, addTimeEntry, addManualTimeEntry, logTimeToTarget, updateTimeEntry, deleteTimeEntry, setResources,
    patchTimeEntry, moveTimeEntries, deleteTimeEntries,
  }
}

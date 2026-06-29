import { useState, useEffect, useRef, useCallback } from 'react'

// Global single-timer with editable start time and live assignment.
// Tracks startMs (the timestamp it began). Editing startMs recalculates
// elapsed live without stopping. Assignment holds client/project/task,
// changeable on the fly.
export function useTimer(onStop) {
  const [running, setRunning] = useState(false)
  const [startMs, setStartMs] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [assignment, setAssignment] = useState({ companyId: null, projectId: null, taskId: null })
  const intervalRef = useRef(null)

  const start = useCallback((assign = {}) => {
    setAssignment({ companyId: assign.companyId || null, projectId: assign.projectId || null, taskId: assign.taskId || null })
    setStartMs(Date.now())
    setRunning(true)
    setElapsed(0)
  }, [])

  // Stop and return the session for logging. Caller decides where it lands.
  const stop = useCallback(() => {
    if (!running || !startMs) return null
    const secs = Math.floor((Date.now() - startMs) / 1000)
    const session = { ...assignment, seconds: secs, startMs, endMs: Date.now() }
    setRunning(false)
    setStartMs(null)
    setElapsed(0)
    setAssignment({ companyId: null, projectId: null, taskId: null })
    return session
  }, [running, startMs, assignment])

  // Edit the start time WITHOUT stopping — elapsed recalculates live.
  // newStartMs is a timestamp; must be in the past and not after now.
  const setStartTime = useCallback((newStartMs) => {
    const clamped = Math.min(newStartMs, Date.now())
    setStartMs(clamped)
    setElapsed(Math.floor((Date.now() - clamped) / 1000))
  }, [])

  // Change assignment on the fly (running or not)
  const assign = useCallback((partial) => {
    setAssignment(prev => ({ ...prev, ...partial }))
  }, [])

  const toggle = useCallback((taskId) => {
    if (running && assignment.taskId === taskId) {
      const session = stop()
      if (session && onStop) onStop(session)
    } else {
      start({ taskId })
    }
  }, [running, assignment.taskId, start, stop, onStop])

  useEffect(() => {
    if (running && startMs) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startMs) / 1000))
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, startMs])

  return {
    running, elapsed, startMs, assignment,
    activeTaskId: assignment.taskId,
    start, stop, setStartTime, assign, toggle,
    isRunning: (id) => running && assignment.taskId === id,
  }
}

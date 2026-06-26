import { useState, useEffect, useRef, useCallback } from 'react'

// Global single-timer. Can run attached to a task, OR unassigned (taskId null)
// and assigned afterward. onStop(taskId, seconds) is called when stopping an
// attached timer. For unassigned stops, the caller handles assignment via the
// returned pendingSeconds.
export function useTimer(onStop) {
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  const start = useCallback((taskId = null) => {
    // If something is already running, stop+log it first (if attached)
    if (running && activeTaskId) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      onStop?.(activeTaskId, secs)
    }
    setActiveTaskId(taskId)
    setRunning(true)
    startRef.current = Date.now()
    setElapsed(0)
  }, [running, activeTaskId, onStop])

  // Stop. If attached to a task, logs automatically and returns seconds.
  // If unassigned, returns { seconds } so caller can prompt for assignment.
  const stop = useCallback(() => {
    if (!running) return null
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    if (activeTaskId) onStop?.(activeTaskId, secs)
    setRunning(false)
    setActiveTaskId(null)
    setElapsed(0)
    startRef.current = null
    return { taskId: activeTaskId, seconds: secs }
  }, [running, activeTaskId, onStop])

  // Assign the currently-running unassigned timer to a task (keeps running)
  const assignTo = useCallback((taskId) => {
    setActiveTaskId(taskId)
  }, [])

  const toggle = useCallback((taskId) => {
    if (running && activeTaskId === taskId) stop()
    else start(taskId)
  }, [running, activeTaskId, start, stop])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  return {
    activeTaskId, running, elapsed,
    start, stop, toggle, assignTo,
    isRunning: (id) => running && activeTaskId === id,
  }
}

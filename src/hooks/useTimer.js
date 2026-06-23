import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer(onStop) {
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  const start = useCallback((taskId) => {
    // If another task is running, stop it first
    if (activeTaskId && activeTaskId !== taskId) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      onStop?.(activeTaskId, secs)
    }
    setActiveTaskId(taskId)
    startRef.current = Date.now()
    setElapsed(0)
  }, [activeTaskId, onStop])

  const stop = useCallback(() => {
    if (!activeTaskId) return
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    onStop?.(activeTaskId, secs)
    setActiveTaskId(null)
    setElapsed(0)
    startRef.current = null
  }, [activeTaskId, onStop])

  const toggle = useCallback((taskId) => {
    if (activeTaskId === taskId) stop()
    else start(taskId)
  }, [activeTaskId, start, stop])

  useEffect(() => {
    if (activeTaskId) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [activeTaskId])

  return { activeTaskId, elapsed, start, stop, toggle, isRunning: (id) => activeTaskId === id }
}

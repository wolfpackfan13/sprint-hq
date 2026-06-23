import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import { dateUtils } from '../utils/dateUtils'

const genId = (prefix = 'mtg') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`

export function useMeetings() {
  const [meetings, setMeetings] = useState(() => storage.get('meetings', []))

  const persist = (updated) => {
    storage.set('meetings', updated)
    return updated
  }

  const addMeeting = useCallback((data) => {
    setMeetings(prev => {
      const meeting = {
        id: genId(),
        title: '',
        date: dateUtils.today(),
        time: '',
        attendees: '',
        companyId: null,
        projectId: null,
        goalId: null,
        notes: '',
        actionItems: [],
        createdAt: new Date().toISOString(),
        ...data,
      }
      return persist([meeting, ...prev])
    })
  }, [])

  const updateMeeting = useCallback((id, data) => {
    setMeetings(prev => persist(prev.map(m => m.id === id ? { ...m, ...data } : m)))
  }, [])

  const deleteMeeting = useCallback((id) => {
    setMeetings(prev => persist(prev.filter(m => m.id !== id)))
  }, [])

  const addActionItem = useCallback((meetingId, title, dueDate = null) => {
    setMeetings(prev => persist(prev.map(m => {
      if (m.id !== meetingId) return m
      const item = { id: genId('ai'), title, dueDate, done: false, taskId: null }
      return { ...m, actionItems: [...(m.actionItems || []), item] }
    })))
  }, [])

  const toggleActionItem = useCallback((meetingId, itemId) => {
    setMeetings(prev => persist(prev.map(m => {
      if (m.id !== meetingId) return m
      return {
        ...m,
        actionItems: m.actionItems.map(ai =>
          ai.id === itemId ? { ...ai, done: !ai.done } : ai
        )
      }
    })))
  }, [])

  const markActionItemPushed = useCallback((meetingId, itemId, taskId) => {
    setMeetings(prev => persist(prev.map(m => {
      if (m.id !== meetingId) return m
      return {
        ...m,
        actionItems: m.actionItems.map(ai =>
          ai.id === itemId ? { ...ai, taskId } : ai
        )
      }
    })))
  }, [])

  const updateActionItem = useCallback((meetingId, itemId, data) => {
    setMeetings(prev => persist(prev.map(m => {
      if (m.id !== meetingId) return m
      return {
        ...m,
        actionItems: m.actionItems.map(ai =>
          ai.id === itemId ? { ...ai, ...data } : ai
        )
      }
    })))
  }, [])

  const deleteActionItem = useCallback((meetingId, itemId) => {
    setMeetings(prev => persist(prev.map(m => {
      if (m.id !== meetingId) return m
      return { ...m, actionItems: m.actionItems.filter(ai => ai.id !== itemId) }
    })))
  }, [])

  const todayMeetings = meetings.filter(m => m.date === dateUtils.today())
  const upcomingMeetings = meetings.filter(m => m.date > dateUtils.today())
  const pastMeetings = meetings.filter(m => m.date < dateUtils.today())

  const pendingActionItems = meetings.flatMap(m =>
    (m.actionItems || [])
      .filter(ai => !ai.done && !ai.taskId)
      .map(ai => ({ ...ai, meetingTitle: m.title, meetingId: m.id, meetingDate: m.date }))
  )

  return {
    meetings,
    todayMeetings,
    upcomingMeetings,
    pastMeetings,
    pendingActionItems,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    addActionItem,
    toggleActionItem,
    markActionItemPushed,
    updateActionItem,
    deleteActionItem,
  }
}

import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const genId = () => `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export function useNotes() {
  const [notes, setNotes] = useState(() => storage.get('notes', []))

  const addNote = useCallback((content) => {
    if (!content.trim()) return
    setNotes(prev => {
      const note = {
        id: genId(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        pinned: false,
      }
      const updated = [note, ...prev]
      storage.set('notes', updated)
      return updated
    })
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      storage.set('notes', updated)
      return updated
    })
  }, [])

  const togglePin = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)
      storage.set('notes', updated)
      return updated
    })
  }, [])

  const updateNote = useCallback((id, content) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, content } : n)
      storage.set('notes', updated)
      return updated
    })
  }, [])

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return { notes: sortedNotes, addNote, deleteNote, togglePin, updateNote }
}

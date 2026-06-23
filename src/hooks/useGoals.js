import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const genId = () => `goal_${Date.now()}`

export function useGoals() {
  const [vision, setVision] = useState(() => storage.get('vision', ''))
  const [goals, setGoals] = useState(() => storage.get('goals', []))

  const saveVision = useCallback((text) => {
    setVision(text)
    storage.set('vision', text)
  }, [])

  const addGoal = useCallback((data) => {
    setGoals(prev => {
      const goal = {
        id: genId(),
        title: '',
        description: '',
        why: '',
        timeframe: '12-week',
        companyId: null,
        status: 'active',
        createdAt: new Date().toISOString(),
        ...data,
      }
      const updated = [goal, ...prev]
      storage.set('goals', updated)
      return updated
    })
  }, [])

  const updateGoal = useCallback((id, data) => {
    setGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, ...data } : g)
      storage.set('goals', updated)
      return updated
    })
  }, [])

  const deleteGoal = useCallback((id) => {
    setGoals(prev => {
      const updated = prev.filter(g => g.id !== id)
      storage.set('goals', updated)
      return updated
    })
  }, [])

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'complete')

  return { vision, goals, activeGoals, completedGoals, saveVision, addGoal, updateGoal, deleteGoal }
}

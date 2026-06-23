import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import { dateUtils } from '../utils/dateUtils'

export function useSprint() {
  const [sprint, setSprint] = useState(() => storage.get('sprint', null))

  const saveSprint = useCallback((data) => {
    const updated = { ...data }
    setSprint(updated)
    storage.set('sprint', updated)
  }, [])

  const updateWeekGoal = useCallback((weekNum, goal) => {
    setSprint(prev => {
      const updated = {
        ...prev,
        weeklyGoals: { ...(prev.weeklyGoals || {}), [weekNum]: goal }
      }
      storage.set('sprint', updated)
      return updated
    })
  }, [])

  const updateSprintGoal = useCallback((goal) => {
    setSprint(prev => {
      const updated = { ...prev, goal }
      storage.set('sprint', updated)
      return updated
    })
  }, [])

  const resetSprint = useCallback(() => {
    setSprint(null)
    storage.remove('sprint')
  }, [])

  const currentWeek = sprint ? dateUtils.sprintWeek(sprint.startDate) : 1
  const progress = sprint ? dateUtils.sprintProgress(sprint.startDate) : 0
  const endDate = sprint ? dateUtils.sprintEndDate(sprint.startDate) : ''
  const weeksRemaining = Math.max(0, 12 - currentWeek)

  return {
    sprint,
    saveSprint,
    updateWeekGoal,
    updateSprintGoal,
    resetSprint,
    currentWeek,
    progress,
    endDate,
    weeksRemaining,
  }
}

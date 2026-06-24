import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const genId = () => `proj_${Date.now()}_${Math.random().toString(36).slice(2,5)}`

export function useProjects() {
  const [projects, setProjects] = useState(() => storage.get('projects', []))

  const persist = (updated) => { storage.set('projects', updated); return updated }

  const addProject = useCallback((data) => {
    let created
    setProjects(prev => {
      created = {
        id: genId(),
        name: '',
        companyId: null,
        goalId: null,
        status: 'active',   // active | done | archived
        dueDate: null,
        notes: '',
        resources: [],      // [{id, label, url}]
        color: null,
        createdAt: new Date().toISOString(),
        ...data,
      }
      return persist([...prev, created])
    })
    return created
  }, [])

  const updateProject = useCallback((id, data) => {
    setProjects(prev => persist(prev.map(p => p.id === id ? { ...p, ...data } : p)))
  }, [])

  const deleteProject = useCallback((id) => {
    setProjects(prev => persist(prev.filter(p => p.id !== id)))
  }, [])

  const getProject = (id) => projects.find(p => p.id === id) || null
  const projectsForCompany = (companyId) => projects.filter(p => p.companyId === companyId)
  const activeProjects = projects.filter(p => p.status === 'active')

  return {
    projects, activeProjects,
    addProject, updateProject, deleteProject,
    getProject, projectsForCompany,
  }
}

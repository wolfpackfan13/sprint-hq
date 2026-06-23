import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const DEFAULT_COMPANIES = [
  { id: 'refuge-homes',  name: 'Refuge Homes',    color: '#2D7A50', emoji: '🏠' },
  { id: 'flip-projects', name: 'Flip Projects',    color: '#F59E0B', emoji: '🔨' },
  { id: 'content',       name: 'Content & Brand',  color: '#3B82F6', emoji: '📱' },
  { id: 'mayfly',        name: 'Mayfly Project',   color: '#EC4899', emoji: '🎣' },
  { id: 'personal',      name: 'Personal',         color: '#8B5CF6', emoji: '⚡' },
  { id: 'admin',         name: 'Admin',            color: '#6B7280', emoji: '📋' },
]

const genId = () => `co_${Date.now()}`

export function useCompanies() {
  const [companies, setCompanies] = useState(() => {
    const saved = storage.get('companies', null)
    if (!saved) {
      storage.set('companies', DEFAULT_COMPANIES)
      return DEFAULT_COMPANIES
    }
    return saved
  })

  const addCompany = useCallback((data) => {
    setCompanies(prev => {
      const c = { id: genId(), ...data }
      const updated = [...prev, c]
      storage.set('companies', updated)
      return updated
    })
  }, [])

  const updateCompany = useCallback((id, data) => {
    setCompanies(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c)
      storage.set('companies', updated)
      return updated
    })
  }, [])

  const deleteCompany = useCallback((id) => {
    setCompanies(prev => {
      const updated = prev.filter(c => c.id !== id)
      storage.set('companies', updated)
      return updated
    })
  }, [])

  const getCompany = (id) => companies.find(c => c.id === id) || null

  return { companies, addCompany, updateCompany, deleteCompany, getCompany }
}

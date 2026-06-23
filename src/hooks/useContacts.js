import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const genId = () => `con_${Date.now()}_${Math.random().toString(36).slice(2,6)}`

export function useContacts() {
  const [contacts, setContacts] = useState(() => storage.get('contacts', []))

  const addContact = useCallback((data) => {
    setContacts(prev => {
      const contact = {
        id: genId(),
        name: '',
        company: '',
        companyId: null,
        role: '',
        email: '',
        phone: '',
        notes: '',
        tags: [],
        lastContactDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        ...data,
      }
      const updated = [contact, ...prev]
      storage.set('contacts', updated)
      return updated
    })
  }, [])

  const updateContact = useCallback((id, data) => {
    setContacts(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c)
      storage.set('contacts', updated)
      return updated
    })
  }, [])

  const deleteContact = useCallback((id) => {
    setContacts(prev => {
      const updated = prev.filter(c => c.id !== id)
      storage.set('contacts', updated)
      return updated
    })
  }, [])

  const touchContact = useCallback((id) => {
    updateContact(id, { lastContactDate: new Date().toISOString().split('T')[0] })
  }, [updateContact])

  const filterByCompany = (companyId) =>
    companyId ? contacts.filter(c => c.companyId === companyId) : contacts

  return { contacts, addContact, updateContact, deleteContact, touchContact, filterByCompany }
}

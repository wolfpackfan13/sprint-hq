import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import { genId as makeId } from '../utils/ids'
import { dateUtils } from '../utils/dateUtils'

const genId = () => makeId('con')

export function useContacts() {
  const [contacts, setContacts] = useState(() => storage.get('contacts', []))

  const persist = (updated) => {
    storage.set('contacts', updated)
    return updated
  }

  const addContact = useCallback((data) => {
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
      stage: 'needs_review',
      nextTouchOn: '',
      nextTouchReason: '',
      networkLabel: null,
      source: null,
      referredBy: null,
      becameClientOn: '',
      lastContactDate: dateUtils.today(),
      createdAt: new Date().toISOString(),
      ...data,
    }
    setContacts(prev => persist([contact, ...prev]))
    return contact
  }, [])

  const updateContact = useCallback((id, data) => {
    setContacts(prev => persist(prev.map(c => c.id === id ? { ...c, ...data } : c)))
  }, [])

  // Several contacts in one write (convert-to-client for a whole firm, undo).
  const updateContacts = useCallback((patches) => {
    const byId = new Map(patches.map(p => [p.id, p]))
    setContacts(prev => persist(prev.map(c => byId.has(c.id) ? { ...c, ...byId.get(c.id) } : c)))
  }, [])

  const deleteContact = useCallback((id) => {
    setContacts(prev => persist(prev.filter(c => c.id !== id)))
  }, [])

  const touchContact = useCallback((id) => {
    updateContact(id, { lastContactDate: dateUtils.today() })
  }, [updateContact])

  // Done on a next touch: contact happened today, and the next one is set.
  const completeTouch = useCallback((id, { nextTouchOn = '', nextTouchReason = '', contactedOn } = {}) => {
    const on = contactedOn || dateUtils.today()
    setContacts(prev => persist(prev.map(c => {
      if (c.id !== id) return c
      const last = (c.lastContactDate || '') > on ? c.lastContactDate : on
      return { ...c, lastContactDate: last, nextTouchOn, nextTouchReason }
    })))
  }, [])

  const filterByCompany = (companyId) =>
    companyId ? contacts.filter(c => c.companyId === companyId) : contacts

  return { contacts, addContact, updateContact, updateContacts, deleteContact, touchContact, completeTouch, filterByCompany }
}

import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const genId = () => `inv_${Date.now()}`

export function useInvoices() {
  const [invoices, setInvoices] = useState(() => storage.get('invoices', []))
  const [profile, setProfile] = useState(() => storage.get('invoiceProfile', {
    businessName: '',
    businessEmail: '',
    businessAddress: '',
    nextNumber: 1001,
  }))

  const saveProfile = useCallback((data) => {
    setProfile(prev => {
      const updated = { ...prev, ...data }
      storage.set('invoiceProfile', updated)
      return updated
    })
  }, [])

  const saveInvoice = useCallback((data) => {
    setInvoices(prev => {
      const inv = { id: genId(), createdAt: new Date().toISOString(), ...data }
      const updated = [inv, ...prev]
      storage.set('invoices', updated)
      return updated
    })
    // bump invoice number
    setProfile(prev => {
      const updated = { ...prev, nextNumber: (prev.nextNumber || 1001) + 1 }
      storage.set('invoiceProfile', updated)
      return updated
    })
  }, [])

  const deleteInvoice = useCallback((id) => {
    setInvoices(prev => {
      const updated = prev.filter(i => i.id !== id)
      storage.set('invoices', updated)
      return updated
    })
  }, [])

  return { invoices, profile, saveProfile, saveInvoice, deleteInvoice }
}

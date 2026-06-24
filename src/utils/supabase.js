import { createClient } from '@supabase/supabase-js'

// SprintHQ Supabase project
const SUPABASE_URL = 'https://vrxwlcdbxfizyyaitfcx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_J8-YdTgGpGS1z5fiW9F3cQ_1BnQ0Mur'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: 'sprintHQ_auth',
  },
})

// The localStorage keys that make up the full app dataset
export const SYNCED_KEYS = [
  'tasks', 'sprint', 'notes', 'contacts', 'meetings',
  'goals', 'vision', 'companies', 'projects',
  'invoices', 'invoiceProfile', 'settings',
]

// Maps each table's fields between the app's camelCase shape and the
// database's snake_case columns. JSONB columns (subtasks, resources, etc.)
// pass through untouched.

// table -> { appKey: dbColumn }
export const FIELD_MAPS = {
  companies: {
    id: 'id', name: 'name', color: 'color', emoji: 'emoji',
    billable: 'billable', hourlyRate: 'hourly_rate', sortOrder: 'sort_order',
    createdAt: 'created_at',
  },
  goals: {
    id: 'id', title: 'title', description: 'description', why: 'why',
    timeframe: 'timeframe', companyId: 'company_id', status: 'status',
    createdAt: 'created_at',
  },
  projects: {
    id: 'id', name: 'name', companyId: 'company_id', goalId: 'goal_id',
    status: 'status', dueDate: 'due_date', notes: 'notes',
    resources: 'resources', color: 'color', createdAt: 'created_at',
  },
  tasks: {
    id: 'id', title: 'title', notes: 'notes', companyId: 'company_id',
    projectId: 'project_id', dueDate: 'due_date', priority: 'priority',
    status: 'status', isTop3: 'is_top3', subtasks: 'subtasks',
    timeEntries: 'time_entries', resources: 'resources',
    createdAt: 'created_at', completedAt: 'completed_at',
  },
  meetings: {
    id: 'id', title: 'title', date: 'date', time: 'time',
    attendees: 'attendees', companyId: 'company_id', projectId: 'project_id',
    goalId: 'goal_id', notes: 'notes', actionItems: 'action_items',
    createdAt: 'created_at',
  },
  contacts: {
    id: 'id', name: 'name', company: 'company', companyId: 'company_id',
    role: 'role', email: 'email', phone: 'phone', notes: 'notes',
    tags: 'tags', lastContactDate: 'last_contact_date', createdAt: 'created_at',
  },
  notes: {
    id: 'id', content: 'content', pinned: 'pinned', createdAt: 'created_at',
  },
  invoices: {
    id: 'id', number: 'number', client: 'client', total: 'total',
    date: 'date', createdAt: 'created_at',
  },
}

// Which localStorage key holds the array for each table
export const TABLE_STORAGE_KEY = {
  companies: 'companies',
  goals: 'goals',
  projects: 'projects',
  tasks: 'tasks',
  meetings: 'meetings',
  contacts: 'contacts',
  notes: 'notes',
  invoices: 'invoices',
}

// Singleton state keys (stored in app_state table, key/value)
export const SINGLETON_KEYS = ['sprint', 'vision', 'settings', 'invoiceProfile', 'eventNotes']

// Convert an app object -> DB row (camelCase -> snake_case)
export function toRow(table, obj, userId) {
  const map = FIELD_MAPS[table]
  const row = { user_id: userId }
  for (const [appKey, dbCol] of Object.entries(map)) {
    if (obj[appKey] !== undefined) {
      let v = obj[appKey]
      // Normalize empty-string dates to null (Postgres date columns reject '')
      if ((dbCol === 'due_date' || dbCol === 'date' || dbCol === 'last_contact_date' || dbCol === 'completed_at') && v === '') v = null
      row[dbCol] = v
    }
  }
  return row
}

// Convert a DB row -> app object (snake_case -> camelCase)
export function fromRow(table, row) {
  const map = FIELD_MAPS[table]
  const obj = {}
  for (const [appKey, dbCol] of Object.entries(map)) {
    if (row[dbCol] !== undefined && row[dbCol] !== null) obj[appKey] = row[dbCol]
  }
  // Ensure JSONB array fields default to []
  const arrayFields = ['subtasks', 'timeEntries', 'resources', 'actionItems', 'tags']
  arrayFields.forEach(f => { if (FIELD_MAPS[table][f] && obj[f] == null) obj[f] = [] })
  return obj
}

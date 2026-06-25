-- ============================================================
-- SprintHQ relational schema
-- Each table has user_id + row-level security so each user
-- only ever sees their own data. Nested detail (subtasks, time
-- entries, resources, action items) stays as JSONB columns on
-- the parent row — full relational structure where it matters.
-- ============================================================

-- COMPANIES / AREAS
create table if not exists companies (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default '',
  color text,
  emoji text,
  billable boolean default false,
  hourly_rate numeric default 0,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GOALS
create table if not exists goals (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  description text default '',
  why text default '',
  timeframe text default '12-week',
  company_id text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROJECTS
create table if not exists projects (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default '',
  company_id text,
  goal_id text,
  status text default 'active',
  due_date date,
  notes text default '',
  resources jsonb default '[]'::jsonb,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASKS
create table if not exists tasks (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  notes text default '',
  company_id text,
  project_id text,
  due_date date,
  priority text default 'medium',
  status text default 'todo',
  is_top3 boolean default false,
  subtasks jsonb default '[]'::jsonb,
  time_entries jsonb default '[]'::jsonb,
  resources jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz,
  updated_at timestamptz default now()
);

-- MEETINGS
create table if not exists meetings (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  date date,
  time text default '',
  attendees text default '',
  company_id text,
  project_id text,
  goal_id text,
  notes text default '',
  action_items jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CONTACTS
create table if not exists contacts (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default '',
  company text default '',
  company_id text,
  role text default '',
  email text default '',
  phone text default '',
  notes text default '',
  tags jsonb default '[]'::jsonb,
  last_contact_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NOTES (brain dump)
create table if not exists notes (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text default '',
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SINGLETON settings/state per user (sprint, vision, settings,
-- invoiceProfile, eventNotes) — these are single objects, not lists,
-- so one row keyed by name is the right fit.
create table if not exists app_state (
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- INVOICES (history)
create table if not exists invoices (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  number int,
  client text,
  total numeric,
  date date,
  created_at timestamptz default now()
);

-- ============================================================
-- Row-level security: each user sees only their own rows
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['companies','goals','projects','tasks','meetings','contacts','notes','app_state','invoices']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_all on %I', t);
    execute format($p$create policy own_all on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)$p$, t);
  end loop;
end $$;

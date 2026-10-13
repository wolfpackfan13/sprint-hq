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
  contact_ids jsonb not null default '[]'::jsonb,
  external_id text,
  summary text default '',
  recording_url text default '',
  source text default 'manual',
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
  stage text not null default 'needs_review'
    check (stage in ('nurturing','in_conversation','proposal_out','client','past_client','network','needs_review')),
  next_touch_on date,
  next_touch_reason text default '',
  network_label text
    check (network_label is null or network_label in ('referral_partner','collaborator','personal')),
  source text,
  referred_by text,
  became_client_on date,
  source_ref text,
  suggested_stage text
    check (suggested_stage is null or suggested_stage in ('nurturing','in_conversation','proposal_out','client','past_client','network')),
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

-- ============================================================
-- Gmail sync (migrations 006 and 007). The hourly schedule and
-- its Vault secret are in 007; run that file for those.
-- ============================================================

-- One row per user: the server-held Google key and sync progress.
-- RLS on with no policies: only the edge functions can read it.
create table if not exists google_connections (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  google_email     text not null,
  refresh_token    text not null,              -- encrypted by google-auth
  scopes           text not null default '',
  client_id        text,
  connected_at     timestamptz not null default now(),
  history_id       text,
  backfill_days    int not null default 90 check (backfill_days between 1 and 730),
  sync_state       jsonb not null default '{}'::jsonb,
  sync_started_at  timestamptz,
  last_sync_at     timestamptz,
  last_sync_status text check (last_sync_status is null or last_sync_status in ('ok', 'error', 'reauth_needed')),
  last_sync_error  text,
  last_sync_counts jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);
alter table google_connections enable row level security;
revoke all on google_connections from anon, authenticated;

-- One row per Gmail thread with a CRM contact on it. Headers only.
-- The app can read its own rows; only the edge functions write.
create table if not exists email_threads (
  id               text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject          text not null default '',
  participants     jsonb not null default '[]'::jsonb,
  contact_ids      jsonb not null default '[]'::jsonb,
  message_count    int not null default 1,
  first_message_at timestamptz,
  last_message_at  timestamptz not null,
  last_direction   text not null check (last_direction in ('in', 'out')),
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, id),
  check (id <> '')
);
create index if not exists email_threads_recent on email_threads (user_id, last_message_at desc);
alter table email_threads enable row level security;
drop policy if exists own_select on email_threads;
create policy own_select on email_threads for select using (auth.uid() = user_id);
revoke all on email_threads from anon, authenticated;
grant select on email_threads to authenticated;

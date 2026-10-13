-- ============================================================
-- 006: Gmail sync for the Relationships CRM, and a Google key
--      held on the server.
--
-- Adds two tables. Nothing that exists today changes.
--
-- google_connections
--   One row per user: the long-lived Google key (refresh token)
--   that google-auth swaps for hour-long passes, plus where
--   gmail-sync left off. Row-level security is on with NO
--   policies, and the app's roles have no grants, so only the
--   server functions can read it. The app never sees the key.
--   google-auth encrypts the key before storing it.
--
-- email_threads
--   One row per Gmail thread that involves someone in the CRM.
--   Headers only: subject, who was on it, when, and which way the
--   last message went. No message bodies. gmail-sync writes it;
--   the app reads it through the normal sync and cannot write it.
--
-- Contacts need no new columns. Email moves last_contact_date
-- forward, and people added from Gmail get source = 'gmail'.
--
-- Safe to run before the functions are deployed: nothing uses
-- these tables until then. Safe to re-run.
--
-- Run in the Supabase SQL editor.
-- ============================================================

begin;

-- ── google_connections ──────────────────────────────────────
create table if not exists google_connections (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  google_email     text not null,
  refresh_token    text not null,              -- encrypted by google-auth
  scopes           text not null default '',
  connected_at     timestamptz not null default now(),

  -- Gmail's position marker (historyId). Null until the first
  -- backfill finishes; after that each run reads only what changed.
  -- To backfill again with a different window, set backfill_days
  -- and clear history_id.
  history_id       text,
  backfill_days    int not null default 90,

  -- Run state. sync_started_at is also the lock that stops two
  -- hourly runs from overlapping.
  sync_started_at  timestamptz,
  last_sync_at     timestamptz,
  last_sync_status text,
  last_sync_error  text,
  last_sync_counts jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),

  constraint google_connections_status_check check (
    last_sync_status is null
    or last_sync_status in ('ok', 'error', 'reauth_needed')
  ),
  constraint google_connections_backfill_days_check check (
    backfill_days between 1 and 730
  )
);

alter table google_connections enable row level security;

-- No policies on purpose. With RLS on and no grants, a signed-in
-- user and the public key both see nothing. Only the service role
-- (the edge functions) reads and writes this table.
drop policy if exists own_all on google_connections;
revoke all on google_connections from anon, authenticated;

-- ── email_threads ───────────────────────────────────────────
create table if not exists email_threads (
  id               text not null,              -- Gmail thread id
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject          text not null default '',

  -- Lowercased addresses on the thread other than yours, so a
  -- contact added later can still be matched to older threads.
  participants     jsonb not null default '[]'::jsonb,
  contact_ids      jsonb not null default '[]'::jsonb,

  message_count    int not null default 1,
  first_message_at timestamptz,
  last_message_at  timestamptz not null,
  last_direction   text not null,              -- 'in' or 'out'
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  primary key (user_id, id),
  constraint email_threads_id_not_blank check (id <> ''),
  constraint email_threads_direction_check check (last_direction in ('in', 'out'))
);

-- Contact history lists threads newest first.
create index if not exists email_threads_recent
  on email_threads (user_id, last_message_at desc);

alter table email_threads enable row level security;

-- Read-only for the app: you can see your own threads, and only
-- the server functions can add or change them.
drop policy if exists own_all on email_threads;
drop policy if exists own_select on email_threads;
create policy own_select on email_threads for select
  using (auth.uid() = user_id);

revoke all on email_threads from anon, authenticated;
grant select on email_threads to authenticated;

commit;

-- ------------------------------------------------------------
-- Verify. Expect rls = true on both rows.
-- ------------------------------------------------------------
-- select relname as table_name, relrowsecurity as rls
-- from pg_class
-- where relname in ('google_connections', 'email_threads')
--   and relnamespace = 'public'::regnamespace;

-- ------------------------------------------------------------
-- Verify the app's roles: expect only SELECT for authenticated
-- on email_threads, and nothing at all on google_connections.
-- ------------------------------------------------------------
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_name in ('google_connections', 'email_threads')
--   and grantee in ('anon', 'authenticated')
-- order by 1, 2, 3;

-- ------------------------------------------------------------
-- After the first sync: the latest threads and how many CRM
-- contacts each one matched.
-- ------------------------------------------------------------
-- select subject, last_direction, last_message_at,
--        jsonb_array_length(contact_ids) as contacts
-- from email_threads
-- order by last_message_at desc
-- limit 20;

-- ============================================================
-- 002: Make Circleback ingest idempotent.
--
-- The circleback-meeting-intelligence edge function did a bare
-- `insert` with a fresh crypto.randomUUID() per row. It wrote a
-- [circleback:<linkId>] tag into notes but never read it back, so
-- every call created another 6-10 tasks. With a Circleback webhook
-- pointed at the function, that fires on every delivery AND on every
-- retry — and because the function calls Claude (max_tokens 4000)
-- before responding, a slow run can exceed the webhook timeout, so
-- Circleback retries while the first invocation is still inserting.
--
-- This ledger moves the guard out of the prompt and into the
-- database, where it protects every caller: webhook, scheduled task,
-- manual curl, or retry. The claim is taken BEFORE any work happens,
-- so two concurrent deliveries cannot both proceed.
--
-- The app never reads or writes this table — it is not in
-- TABLE_STORAGE_KEY, so the sync engine leaves it alone. That is
-- deliberate: deleting the tasks in Sprint HQ must not un-process
-- the meeting, which is exactly how the old notes-LIKE guard failed.
--
-- Run in the Supabase SQL editor. Take a backup first.
-- ============================================================

begin;

create table if not exists circleback_processed (
  user_id       uuid references auth.users(id) on delete cascade not null,
  link_id       text not null,
  status        text not null default 'processing',  -- processing | done | failed
  tasks_created int  not null default 0,
  meeting_title text,
  processed_at  timestamptz not null default now(),
  primary key (user_id, link_id),
  constraint circleback_processed_link_id_not_blank check (link_id <> '')
);

alter table circleback_processed enable row level security;
drop policy if exists own_all on circleback_processed;
create policy own_all on circleback_processed for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Seed the ledger from tasks already in the table, so the first
-- webhook delivery after deploy does not re-insert meetings that
-- were already processed.
--
-- Tasks tagged with an EMPTY linkId are skipped on purpose: they
-- cannot be attributed to a meeting. See the note at the bottom.
-- ------------------------------------------------------------
insert into circleback_processed (user_id, link_id, status, tasks_created, processed_at)
select
  user_id,
  substring(notes from '\[circleback:([^\]]*)\]') as link_id,
  'done',
  count(*),
  min(created_at)
from tasks
where notes like '%[circleback:%'
  and coalesce(substring(notes from '\[circleback:([^\]]*)\]'), '') <> ''
group by 1, 2
on conflict (user_id, link_id) do nothing;

commit;

-- ------------------------------------------------------------
-- INVENTORY (run first, read it, then decide on the cleanup below)
--
-- One row per meeting per insert batch. A link_id with more than one
-- batch was processed more than once. A blank link_id means the
-- webhook payload arrived in a shape the function did not understand
-- (`payload.meeting` was undefined), so linkId fell back to "" and
-- every one of those tasks is tagged [circleback:] identically.
-- ------------------------------------------------------------
-- select
--   coalesce(substring(notes from '\[circleback:([^\]]*)\]'), '(untagged)') as link_id,
--   date_trunc('minute', created_at) as batch,
--   count(*) as tasks,
--   min(title) as sample_title
-- from tasks
-- where notes like '%[circleback:%'
-- group by 1, 2
-- order by 1, 2;

-- ------------------------------------------------------------
-- CLEANUP: keep the first batch per meeting, drop the later ones.
--
-- Only removes tasks that are still 'todo' with no time logged and
-- no subtasks — anything worked on is left alone. Blank link_ids are
-- left alone too, since they cannot be grouped by meeting reliably.
--
-- Run the inventory above first. This is a delete.
-- ------------------------------------------------------------
-- with batches as (
--   select
--     id, user_id, status, time_entries, subtasks,
--     substring(notes from '\[circleback:([^\]]*)\]') as link_id,
--     dense_rank() over (
--       partition by user_id, substring(notes from '\[circleback:([^\]]*)\]')
--       order by date_trunc('minute', created_at)
--     ) as batch_no
--   from tasks
--   where notes like '%[circleback:%'
--     and coalesce(substring(notes from '\[circleback:([^\]]*)\]'), '') <> ''
-- )
-- delete from tasks t
-- using batches b
-- where t.id = b.id
--   and t.user_id = b.user_id
--   and b.batch_no > 1
--   and t.status = 'todo'
--   and coalesce(jsonb_array_length(t.time_entries), 0) = 0
--   and coalesce(jsonb_array_length(t.subtasks), 0) = 0;

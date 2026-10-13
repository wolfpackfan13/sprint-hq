-- ============================================================
-- 007: Hourly Gmail sync, and two columns the functions need.
--
-- 1. google_connections gets client_id (which Google OAuth client
--    issued the key, so the hourly sync can renew passes without
--    the app) and sync_state (backfill progress, saved after every
--    page so a long first sync finishes over several runs).
-- 2. A random secret is created in Vault. The schedule sends it,
--    and gmail-sync only syncs every account for a caller that has
--    it. The last statement prints it: copy it into Supabase →
--    Edge Functions → Secrets as GMAIL_SYNC_SECRET.
-- 3. gmail-sync is scheduled at 17 minutes past every hour. It is
--    deployed in Supabase as Gmail-sync (function names are
--    case-sensitive in the URL).
--
-- Run in the Supabase SQL editor after 006. Safe to run before the
-- functions are deployed: until then the hourly call gets a 404
-- and nothing changes. Safe to re-run; the secret is kept.
-- ============================================================

begin;

alter table google_connections
  add column if not exists client_id  text,
  add column if not exists sync_state jsonb not null default '{}'::jsonb;

commit;

-- ── Extensions ──────────────────────────────────────────────
-- Already on if another schedule exists. Both ship with Supabase.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ── Secret ──────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'gmail_sync_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'gmail_sync_secret',
      'Sent by the hourly gmail-sync schedule; same value as the GMAIL_SYNC_SECRET function secret'
    );
  end if;
end $$;

-- ── Schedule ────────────────────────────────────────────────
select cron.unschedule(jobid) from cron.job where jobname = 'gmail-sync-hourly';

select cron.schedule(
  'gmail-sync-hourly',
  '17 * * * *',
  $job$
  select net.http_post(
    url := 'https://vrxwlcdbxfizyyaitfcx.supabase.co/functions/v1/Gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gmail_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $job$
);

-- ── Copy this value into Edge Functions → Secrets as GMAIL_SYNC_SECRET
select decrypted_secret as gmail_sync_secret
from vault.decrypted_secrets
where name = 'gmail_sync_secret';

-- ------------------------------------------------------------
-- Check the schedule ran: one row per hour, newest first. status
-- 'succeeded' means the call went out; the function's own result
-- is in google_connections.last_sync_status.
-- ------------------------------------------------------------
-- select status, return_message, start_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'gmail-sync-hourly')
-- order by start_time desc
-- limit 5;

-- ------------------------------------------------------------
-- How the last sync went.
-- ------------------------------------------------------------
-- select google_email, last_sync_at, last_sync_status, last_sync_error,
--        last_sync_counts, history_id is not null as backfill_done
-- from google_connections;

-- ------------------------------------------------------------
-- Pause the hourly sync:   select cron.unschedule('gmail-sync-hourly');
-- ------------------------------------------------------------

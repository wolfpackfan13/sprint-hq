-- ============================================================
-- 003: Carry the follow-up email and the resolved company on the
--      ledger, and capture the raw webhook payload.
--
-- Three problems this addresses.
--
-- 1. The follow-up Gmail draft has never been created. The edge
--    function generates the email but has no Gmail credentials, and
--    the scheduled task that was supposed to create the draft posted
--    to a function slug that does not exist (404) AND read the
--    database through a Supabase MCP connection that does not have
--    this project. It failed at both ends. Parking the email on the
--    ledger lets a separate draft pass pick it up later.
--
-- 2. Every Circleback task lands with company_id null, because the
--    webhook does not send a company and the function had no
--    fallback. Recording the resolved company here makes it
--    auditable.
--
-- 3. Nobody has ever seen the raw webhook payload. Capturing it
--    means the next real meeting tells us exactly which fields
--    Circleback sends, instead of us guessing.
--
-- Run in the Supabase SQL editor after 002.
-- ============================================================

begin;

alter table circleback_processed
  add column if not exists company_id      text,
  add column if not exists email_subject   text,
  add column if not exists email_body      text,
  add column if not exists draft_to        text,
  add column if not exists draft_id        text,
  add column if not exists draft_created_at timestamptz,
  add column if not exists raw_payload     jsonb;

-- The draft pass polls for done rows that still have an email waiting.
create index if not exists circleback_processed_pending_drafts
  on circleback_processed (user_id)
  where status = 'done' and draft_created_at is null and email_subject is not null;

commit;

-- ------------------------------------------------------------
-- After the next real meeting, this shows exactly what Circleback
-- posts — run it to confirm whether attendees are included, and
-- what the field names actually are.
-- ------------------------------------------------------------
-- select link_id, meeting_title, company_id,
--        jsonb_pretty(raw_payload) as payload
-- from circleback_processed
-- where raw_payload is not null
-- order by processed_at desc
-- limit 1;

-- ------------------------------------------------------------
-- Drafts still waiting to be created.
-- ------------------------------------------------------------
-- select link_id, meeting_title, draft_to, email_subject, processed_at
-- from circleback_processed
-- where status = 'done' and draft_created_at is null and email_subject is not null
-- order by processed_at;

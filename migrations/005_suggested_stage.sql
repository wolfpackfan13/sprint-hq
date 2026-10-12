-- ============================================================
-- 005: Suggested stage for people added from a call.
--
-- The Circleback processor now adds new attendees to Needs review.
-- Every contact in Needs review has stage = 'needs_review', so the
-- stage the call suggested (client, in conversation, network...)
-- needs a column of its own. The Needs review sheet preselects it,
-- so a correct guess takes one tap.
--
-- RUN THIS BEFORE DEPLOYING THE UPDATED circleback-meeting-processor.
-- The function writes this column when it creates a contact; without
-- it the insert fails and the meeting is marked failed.
--
-- The app change can ship before or after: it only sends this
-- column for contacts that already have a value from the database.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================

begin;

alter table contacts
  add column if not exists suggested_stage text;

alter table contacts drop constraint if exists contacts_suggested_stage_check;
alter table contacts add constraint contacts_suggested_stage_check check (
  suggested_stage is null or suggested_stage in (
    'nurturing', 'in_conversation', 'proposal_out',
    'client', 'past_client', 'network'
  )
);

commit;

-- ------------------------------------------------------------
-- CHECK: the column exists and the email index from 004 is there.
-- The processor relies on contacts_email_unique to stop a second
-- contact being created for the same address.
-- ------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'contacts' and column_name = 'suggested_stage';
-- select indexname from pg_indexes
--   where tablename = 'contacts' and indexname = 'contacts_email_unique';

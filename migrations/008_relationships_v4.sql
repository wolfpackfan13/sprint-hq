-- ============================================================
-- 008: Relationships v4.
--
-- Two tracks per person (business stage + referral stage), referral
-- partners with terms and rewards, more than one email per person,
-- client history, the AI next step cache, the calendar event behind
-- a next touch, tasks linked to a person, and meetings linked to the
-- calendar event they were logged from.
--
-- RUN THIS FIRST, before deploying the app change or the updated
-- Gmail-sync and circleback-meeting-processor functions. The new app
-- writes these columns on every contact, task and meeting save, and both
-- functions read other_emails, referral_stage and next_touch_event_id;
-- without them Supabase rejects the write or the read until this runs.
--
-- Contacts labelled "Referral partner" go back to plain Network (the
-- label is cleared). Partners now mean an agreement with a reward, set
-- from the contact page.
--
-- Run in the Supabase SQL editor. Take a backup first. Safe to re-run:
-- every statement checks before it changes anything.
-- ============================================================

begin;

-- ── contacts ────────────────────────────────────────────────
alter table contacts
  add column if not exists referral_stage      text,
  add column if not exists referral_terms      text default '',
  add column if not exists invited_on          date,
  add column if not exists partner_since       date,
  -- On the person who was referred: what you owe whoever referred them.
  add column if not exists reward_amount       numeric(12, 2),
  add column if not exists reward_paid_on      date,
  -- When their last stretch as a client ended ("Client in 2025").
  add column if not exists client_until        date,
  -- Every address besides the main one. Lower case.
  add column if not exists other_emails        jsonb not null default '[]'::jsonb,
  -- The Google Calendar event that is this person's next touch.
  add column if not exists next_touch_event_id text,
  -- The AI summary and suggested next steps, with what they were built from.
  add column if not exists next_step           jsonb;

alter table contacts drop constraint if exists contacts_referral_stage_check;
alter table contacts add constraint contacts_referral_stage_check check (
  referral_stage is null or referral_stage in ('invited', 'partner')
);

-- Old "Referral partner" labels go back to Network.
update contacts set network_label = null where network_label = 'referral_partner';

-- Gmail sync and the Circleback processor look people up by any address.
create index if not exists contacts_other_emails
  on contacts using gin (other_emails);

-- ── tasks ───────────────────────────────────────────────────
-- A task added from someone's page belongs to them.
alter table tasks
  add column if not exists contact_id text;

create index if not exists tasks_contact
  on tasks (user_id, contact_id)
  where contact_id is not null;

-- ── meetings ────────────────────────────────────────────────
-- The calendar event a logged conversation came from, so its To log
-- reminder clears.
alter table meetings
  add column if not exists calendar_event_id text;

commit;

-- ------------------------------------------------------------
-- CHECK
-- ------------------------------------------------------------
-- select count(*) filter (where network_label = 'referral_partner') as old_labels_left,
--        count(*) filter (where referral_stage is not null)         as on_referral_track
-- from contacts;

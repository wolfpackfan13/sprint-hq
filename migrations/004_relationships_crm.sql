-- ============================================================
-- 004: Relationships CRM.
--
-- Adds a relationship stage, next touch, referral and conversion
-- fields to contacts, and links meetings to the people in them.
-- No new tables: the sync engine keeps working as it does today,
-- with the new columns mapped in src/utils/dataMap.js.
--
-- RUN THIS BEFORE DEPLOYING THE APP CHANGE. The new app version
-- writes these columns on every contact and meeting save; without
-- them Supabase rejects the write and the sync indicator shows an
-- error until the migration runs.
--
-- Existing contacts land in 'needs_review', so each one gets sorted
-- into Leads, Clients, or Network once from the Relationships page.
--
-- Run in the Supabase SQL editor. Take a backup first. Safe to
-- re-run: every statement checks before it changes anything.
-- ============================================================

begin;

-- ── contacts ────────────────────────────────────────────────
alter table contacts
  add column if not exists stage             text not null default 'needs_review',
  add column if not exists next_touch_on     date,
  add column if not exists next_touch_reason text default '',
  add column if not exists network_label     text,
  add column if not exists source            text,
  add column if not exists referred_by       text,
  add column if not exists became_client_on  date,
  add column if not exists source_ref        text;

alter table contacts drop constraint if exists contacts_stage_check;
alter table contacts add constraint contacts_stage_check check (stage in (
  'nurturing', 'in_conversation', 'proposal_out',
  'client', 'past_client', 'network', 'needs_review'
));

alter table contacts drop constraint if exists contacts_network_label_check;
alter table contacts add constraint contacts_network_label_check check (
  network_label is null or network_label in ('referral_partner', 'collaborator', 'personal')
);

-- Leads sort and the Today card both read by next touch.
create index if not exists contacts_next_touch
  on contacts (user_id, next_touch_on)
  where next_touch_on is not null;

-- ── meetings ────────────────────────────────────────────────
alter table meetings
  add column if not exists contact_ids   jsonb not null default '[]'::jsonb,
  add column if not exists external_id   text,
  add column if not exists summary       text default '',
  add column if not exists recording_url text default '',
  add column if not exists source        text default 'manual';

-- One meeting row per Circleback meeting, shared by the webhook and
-- the Notion import. Not partial, so an upsert can target it; meetings
-- with no external_id are unaffected because nulls never collide.
drop index if exists meetings_external_id_unique;
create unique index meetings_external_id_unique
  on meetings (user_id, external_id);

-- ── one contact per email ───────────────────────────────────
-- Circleback ingest and the Notion import match people by email.
-- Existing duplicates would make this index fail, so it is only
-- created when there are none; otherwise a notice says so and the
-- inventory query at the bottom lists them.
do $$
begin
  if exists (
    select 1 from contacts
    where nullif(lower(trim(email)), '') is not null
    group by user_id, lower(trim(email))
    having count(*) > 1
  ) then
    raise notice 'Duplicate contact emails found: contacts_email_unique was NOT created. Run the inventory query at the bottom of 004, merge the duplicates, then re-run this migration.';
  else
    -- Blank emails become null, and nulls never collide, so contacts
    -- without an email are unaffected. Not partial, so an upsert can
    -- target (user_id, nullif(lower(trim(email)), '')).
    drop index if exists contacts_email_unique;
    execute 'create unique index contacts_email_unique
             on contacts (user_id, (nullif(lower(trim(email)), '''')))';
  end if;
end $$;

commit;

-- ------------------------------------------------------------
-- CHECK: every existing contact should now read needs_review.
-- ------------------------------------------------------------
-- select stage, count(*) from contacts group by stage;

-- ------------------------------------------------------------
-- INVENTORY: duplicate emails, if the notice above appeared.
-- ------------------------------------------------------------
-- select lower(trim(email)) as email, count(*), array_agg(name) as names
-- from contacts
-- where nullif(lower(trim(email)), '') is not null
-- group by user_id, lower(trim(email))
-- having count(*) > 1;

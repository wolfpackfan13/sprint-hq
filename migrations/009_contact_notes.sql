-- ============================================================
-- 009: Notes on a relationship.
--
-- Dated notes on each person ("Expanding to Durham next spring"),
-- kept apart from the Profile. Newest first; each is
-- { id, at, text }. The AI next step reads the recent ones.
--
-- Run in the Supabase SQL editor BEFORE the app change that adds the
-- Notes section: the app writes this column on every contact save.
-- Safe to re-run.
-- ============================================================

alter table contacts
  add column if not exists notes_log jsonb not null default '[]'::jsonb;

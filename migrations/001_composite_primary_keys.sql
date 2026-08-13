-- ============================================================
-- 001: Scope primary keys to the owning user.
--
-- Every table used `id text primary key`, which is global across
-- all users. Two consequences:
--
--   1. DEFAULT_COMPANIES seeds fixed IDs ('refuge-homes', 'personal',
--      'admin', ...) for every new signup, so the second user to sync
--      hits a primary key violation on `companies` and their sync fails.
--   2. Timestamp-based IDs collided whenever two users created a record
--      in the same millisecond, and could be claimed in advance.
--
-- Making the key (user_id, id) removes both. RLS already restricts
-- visibility, so this changes uniqueness only.
--
-- Run in the Supabase SQL editor. Take a backup first.
-- ============================================================

begin;

do $$
declare
  t text;
  pk_name text;
begin
  foreach t in array array[
    'companies','goals','projects','tasks','meetings','contacts','notes','invoices'
  ]
  loop
    -- Drop the existing single-column primary key by its actual name
    select con.conname into pk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where con.contype = 'p'
      and rel.relname = t
      and ns.nspname = 'public';

    if pk_name is not null then
      execute format('alter table public.%I drop constraint %I', t, pk_name);
    end if;

    -- Re-key on (user_id, id)
    execute format(
      'alter table public.%I add constraint %I primary key (user_id, id)',
      t, t || '_pkey'
    );
  end loop;
end $$;

commit;

-- ------------------------------------------------------------
-- Verify: should list (user_id, id) for each table above.
-- ------------------------------------------------------------
-- select rel.relname as table_name,
--        string_agg(att.attname, ', ' order by k.ord) as primary_key
-- from pg_constraint con
-- join pg_class rel on rel.oid = con.conrelid
-- join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
-- join pg_attribute att on att.attrelid = rel.oid and att.attnum = k.attnum
-- where con.contype = 'p' and rel.relnamespace = 'public'::regnamespace
-- group by rel.relname order by rel.relname;

-- ------------------------------------------------------------
-- Separately: confirm the legacy blob table is locked down or gone.
-- If the migration to relational tables is complete, drop it.
-- ------------------------------------------------------------
-- select relrowsecurity from pg_class where relname = 'app_data';
-- alter table if exists public.app_data enable row level security;
-- drop policy if exists own_all on public.app_data;
-- create policy own_all on public.app_data for all
--   using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Manual ordering of the home screen's top picks.
--
-- Promoting an agency (companies.is_promoted) and featuring a trip
-- (packages.is_featured) says *that* they lead their row; this table says in
-- which order. The administrator sets it on the dashboard's "App management"
-- page, and the app applies it inside the promoted/featured block only —
-- everything below keeps the existing automatic ranking.
--
-- Deliberately a separate table rather than a column on companies/packages:
-- those tables are guarded by triggers an agency's own updates pass through
-- (protect_company_admin_fields, protect_reviewed_trip_changes), so a new
-- column there would need those security-critical functions edited. A table of
-- its own gets the same admin-only RLS as home_sections, with nothing else to
-- reason about.
--
-- A row with no matching promotion is inert, so un-promoting an agency simply
-- parks its position until it is promoted again.

create table if not exists home_rank (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete cascade,
  package_id  uuid references packages(id) on delete cascade,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  -- Exactly one target per row.
  constraint home_rank_one_target check (num_nonnulls(company_id, package_id) = 1),
  -- Plain unique constraints rather than partial indexes: PostgREST's upsert
  -- emits "ON CONFLICT (col)", which cannot infer a partial index. Postgres
  -- treats NULLs as distinct, so the rows holding the other kind of target
  -- never collide here.
  constraint home_rank_company_key unique (company_id),
  constraint home_rank_package_key unique (package_id)
);

create or replace function touch_home_rank()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists home_rank_touch on home_rank;
create trigger home_rank_touch
  before update on home_rank
  for each row execute function touch_home_rank();

-- Read by every client (the home screen serves signed-out guests too);
-- written by administrators only, exactly like home_sections.
alter table home_rank enable row level security;

drop policy if exists "public read home rank" on home_rank;
create policy "public read home rank" on home_rank
  for select using (true);

drop policy if exists "admin manage home rank" on home_rank;
create policy "admin manage home rank" on home_rank
  for all using (is_admin()) with check (is_admin());

grant select on home_rank to anon, authenticated;
grant insert, update, delete on home_rank to authenticated;

do $$
begin
  alter publication supabase_realtime add table home_rank;
exception when duplicate_object then null;
end $$;

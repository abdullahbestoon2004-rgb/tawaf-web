-- Home screen layout, curated by the administrator in the dashboard's
-- "App management" page and read by the Flutter app's home screen.
--
-- The app already reads two curation signals from elsewhere:
--   * home_ads              — the sponsors / carousel slides
--   * companies.is_promoted — "top agencies" ordering
--   * packages.is_featured  — "top trips" ordering
-- What was missing is the order of the home screen itself, which was hardcoded
-- in lib/screens/home/home_screen.dart. This table moves that decision into the
-- database so an administrator can reorder, hide, or cap each section without a
-- new app release.
--
-- Keys must match HomeSection.knownKeys in the Flutter app
-- (lib/models/home_section_model.dart) and HOME_SECTION_KEYS in the dashboard
-- (src/pages/dashboard/app-management.tsx). Adding a section means adding the
-- key in all three places; an unknown key is ignored by both surfaces rather
-- than breaking the screen.

create table if not exists home_sections (
  key         text primary key,
  sort_order  integer not null default 0,
  -- A hidden section is skipped entirely by the app.
  is_visible  boolean not null default true,
  -- How many cards the section may show. Null means "no cap"; the app applies
  -- its own ranking either way.
  max_items   integer check (max_items is null or (max_items between 1 and 50)),
  updated_at  timestamptz not null default now()
);

create index if not exists home_sections_order_idx on home_sections(sort_order);

create or replace function touch_home_sections()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists home_sections_touch on home_sections;
create trigger home_sections_touch
  before update on home_sections
  for each row execute function touch_home_sections();

-- The home screen is served to signed-out guests too, so reads are public.
-- Writes are administrator-only, in line with home_ads.
alter table home_sections enable row level security;

drop policy if exists "public read home sections" on home_sections;
create policy "public read home sections" on home_sections
  for select using (true);

drop policy if exists "admin manage home sections" on home_sections;
create policy "admin manage home sections" on home_sections
  for all using (is_admin()) with check (is_admin());

grant select on home_sections to anon, authenticated;
grant insert, update, delete on home_sections to authenticated;

-- Seed with the order the app shipped with, so switching the home screen over
-- to this table is a no-op until an administrator changes something.
insert into home_sections (key, sort_order, is_visible, max_items) values
  ('prayer_times',   0, true, null),
  ('active_booking', 1, true, null),
  ('carousel',       2, true, null),
  ('categories',     3, true, null),
  ('agencies',       4, true, null),
  ('trips',          5, true, 6)
on conflict (key) do nothing;

-- The dashboard subscribes to both tables so a second administrator's edit
-- lands live in an open workspace.
do $$
begin
  alter publication supabase_realtime add table home_sections;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table home_ads;
exception when duplicate_object then null;
end $$;

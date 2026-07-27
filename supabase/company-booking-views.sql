-- Per-company-user booking inbox state.
--
-- "New" means this particular staff member has not opened the booking. It is
-- deliberately separate from payment and operational state: another employee
-- viewing a booking must not clear this user's badge, and viewing a booking
-- must not hide an unresolved cash balance.

create table if not exists public.company_booking_views (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

create index if not exists company_booking_views_company_user_idx
  on public.company_booking_views (company_id, user_id);

create index if not exists company_booking_views_user_idx
  on public.company_booking_views (user_id);

-- The feature starts with the existing inbox as a clean baseline. Without this
-- one-time seed, every historical booking would incorrectly appear as new on
-- launch. Future bookings have no row and therefore appear unseen.
insert into public.company_booking_views (booking_id, company_id, user_id, viewed_at)
select b.id, b.company_id, c.owner_id, now()
  from public.bookings b
  join public.companies c on c.id = b.company_id
 where c.owner_id is not null
union
select b.id, b.company_id, s.user_id, now()
  from public.bookings b
  join public.agency_staff s on s.company_id = b.company_id
 where s.status = 'active'
on conflict (booking_id, user_id) do nothing;

create or replace function public.seed_booking_views_for_company_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.company_id is distinct from new.company_id
    or old.user_id is distinct from new.user_id
  ) then
    insert into public.company_booking_views (booking_id, company_id, user_id, viewed_at)
    select b.id, b.company_id, new.user_id, now()
      from public.bookings b
     where b.company_id = new.company_id
    on conflict (booking_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists after_company_staff_booking_view_baseline on public.agency_staff;
create trigger after_company_staff_booking_view_baseline
after insert or update of status, company_id, user_id on public.agency_staff
for each row execute function public.seed_booking_views_for_company_staff();

revoke all on function public.seed_booking_views_for_company_staff() from public, anon, authenticated;

alter table public.company_booking_views enable row level security;

drop policy if exists "staff read own booking views" on public.company_booking_views;
create policy "staff read own booking views"
  on public.company_booking_views
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and public.can_access_company(company_id, 'bookings')
  );

grant select on public.company_booking_views to authenticated;
revoke insert, update, delete on public.company_booking_views from anon, authenticated;

create or replace function public.set_company_booking_view(
  p_booking_id uuid,
  p_viewed boolean default true
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := (select auth.uid());
  booking_company_id uuid;
  result_viewed_at timestamptz;
begin
  if viewer_id is null then
    raise exception 'authentication required';
  end if;

  select company_id
    into booking_company_id
    from public.bookings
   where id = p_booking_id;

  if booking_company_id is null then
    raise exception 'booking not found';
  end if;

  if not public.can_access_company(booking_company_id, 'bookings') then
    raise exception 'not your booking';
  end if;

  if p_viewed then
    insert into public.company_booking_views (
      booking_id,
      company_id,
      user_id,
      viewed_at
    )
    values (
      p_booking_id,
      booking_company_id,
      viewer_id,
      now()
    )
    on conflict (booking_id, user_id)
    do update
       set company_id = excluded.company_id,
           viewed_at = excluded.viewed_at
    returning viewed_at into result_viewed_at;

    return result_viewed_at;
  end if;

  delete from public.company_booking_views
   where booking_id = p_booking_id
     and user_id = viewer_id;

  return null;
end;
$$;

revoke all on function public.set_company_booking_view(uuid, boolean) from public, anon;
grant execute on function public.set_company_booking_view(uuid, boolean) to authenticated;

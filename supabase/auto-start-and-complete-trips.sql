-- Tawaf — trip lifecycle safety net (auto-start / auto-complete + client notices)
-- Applied to project wvgrdmzezwdwcyicwgev as migration `auto_start_and_complete_trips`.
--
-- WHY
--   transition_booking('start'/'complete') both require an agency to press a
--   button. If they forget:
--     * the pilgrim's app still reads "You are ready to travel" while they are
--       standing in Makkah, and
--     * a booking that is never completed never fires
--       after_completed_booking_pilgrims, so companies.pilgrims_served (the
--       marketplace trust signal) never grows, the review prompt never unlocks,
--       and the client stays flagged as having an active booking forever.
--
-- DESIGN — safety net, not the primary path
--   The agency keeps manual control (delayed flights, early returns); the cron
--   only catches what they forgot. Auto-complete waits one FULL day past the
--   return date so the agency always gets first refusal.
--   Money is untouched: commission is booked at confirm, not at complete.
--   Both functions are SECURITY DEFINER because pg_cron has no auth.uid(), so
--   transition_booking's can_access_company() could never pass. They mirror
--   expire_stale_bookings(): lock the package, re-check the row under the lock,
--   then update — a concurrent agency action cannot be clobbered.
--
-- ROLE REVIEW
--   client    — no new rights; only receives the two notifications below.
--   companies — unchanged manual controls; cron acts as a backstop.
--   admin     — unchanged (read-only oversight in the dashboard).
--
-- CROSS-REPO IMPACT (Flutter app)
--   Two NEW notification `type` strings are emitted: 'tripStarted' and
--   'tripCompleted'. The app's NotificationType enum has been extended to match;
--   older app builds fall back to `promo` via the enum's orElse, so they degrade
--   safely rather than crashing.
--
-- CRON (registered separately, see bottom of this file)
--   auto-start-departed-bookings     30 0 * * *
--   auto-complete-returned-bookings  45 0 * * *
--   Both run after expire-departed-packages (00:15) so the day's package state
--   settles first.

-- 1. Departure day: ready/confirmed -> in_progress.
--    'confirmed' is included because transition_booking('start') allows it too;
--    a pilgrim who departs is travelling whether or not the agency ever pressed
--    "Mark ready".
create or replace function public.auto_start_departed_bookings()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare candidate record;
declare b bookings%rowtype;
declare started_count int := 0;
begin
  for candidate in
    select id, package_id from bookings
    where operational_stage in ('confirmed','ready')
      and departure_date is not null
      and departure_date <= current_date
    order by departure_date
  loop
    perform 1 from packages where id = candidate.package_id for update;
    select * into b from bookings where id = candidate.id for update;
    if b.operational_stage in ('confirmed','ready')
       and b.departure_date is not null
       and b.departure_date <= current_date then
      update bookings set operational_stage = 'in_progress',
        status = 'confirmed',
        started_at = coalesce(started_at, now())
      where id = b.id;
      started_count := started_count + 1;
    end if;
  end loop;
  return started_count;
end;
$function$;

-- 2. One day after the return date: in_progress -> completed.
--    bookings has no return date of its own, so it comes from the package;
--    when that is null we fall back to departure + the package's day count.
create or replace function public.auto_complete_returned_bookings()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare candidate record;
declare b bookings%rowtype;
declare completed_count int := 0;
begin
  for candidate in
    select bk.id, bk.package_id,
           coalesce(p.return_date, bk.departure_date + coalesce(p.days, 0)) as ends_on
    from bookings bk
    join packages p on p.id = bk.package_id
    where bk.operational_stage = 'in_progress'
      and coalesce(p.return_date, bk.departure_date + coalesce(p.days, 0))
          < current_date
  loop
    -- One full day of grace after the trip ends, so the agency gets the first
    -- chance to close it out themselves.
    if candidate.ends_on >= current_date then continue; end if;
    perform 1 from packages where id = candidate.package_id for update;
    select * into b from bookings where id = candidate.id for update;
    if b.operational_stage = 'in_progress' then
      update bookings set operational_stage = 'completed',
        status = 'completed',
        completed_at = coalesce(completed_at, now())
      where id = b.id;
      completed_count := completed_count + 1;
    end if;
  end loop;
  return completed_count;
end;
$function$;

-- 3. Tell the client when their trip starts and when it is closed out.
--    Mirrors private.notify_client_booking_ready(): one row per real stage
--    change, so neither the dashboard nor the app may insert these itself or
--    the pilgrim is notified twice.
create or replace function private.notify_client_trip_stage()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare package_title text;
begin
  if new.operational_stage is not distinct from old.operational_stage
     or new.operational_stage not in ('in_progress','completed') then
    return new;
  end if;
  if new.client_id is null then
    return new;
  end if;

  select title into package_title from public.packages where id = new.package_id;

  insert into public.notifications (user_id, type, arg, booking_id)
  values (
    new.client_id,
    case new.operational_stage
      when 'in_progress' then 'tripStarted'
      else 'tripCompleted'
    end,
    package_title,
    new.id
  );
  return new;
end;
$function$;

drop trigger if exists after_notify_client_trip_stage on public.bookings;
create trigger after_notify_client_trip_stage
after update of operational_stage on public.bookings
for each row execute function private.notify_client_trip_stage();

-- 4. Schedules (run once; cron.schedule upserts by name).
-- select cron.schedule('auto-start-departed-bookings', '30 0 * * *',
--   'select public.auto_start_departed_bookings();');
-- select cron.schedule('auto-complete-returned-bookings', '45 0 * * *',
--   'select public.auto_complete_returned_bookings();');

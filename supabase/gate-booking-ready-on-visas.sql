-- Tawaf — gate transition_booking('ready') on traveller visas
-- Applied to project wvgrdmzezwdwcyicwgev as migration `gate_booking_ready_on_visas`.
--
-- WHY
--   The Flutter client's progress tracker (lib/models/client_booking_progress.dart)
--   enters its final "Ready to travel" stage the moment bookings.operational_stage
--   becomes 'ready'. Both agency surfaces — this web dashboard AND the Flutter
--   agency screens — call transition_booking, and each had (or could grow) an
--   ungated "Mark ready" button. Enforcing the rule in the RPC makes it impossible
--   for either UI to push a pilgrim to "Ready" while a visa is still pending.
--
-- WHAT CHANGED
--   Only the 'ready' branch: after the existing access/stage checks, it now raises
--     'all traveller visas must be approved before the trip is ready'
--   when any booking_travellers row on the booking has visa_status <> 'approved'.
--   Bookings with ZERO traveller rows remain allowed (legacy-data safety).
--
-- ROLE REVIEW
--   client   — cannot call 'ready' at all (unchanged).
--   companies— 'ready' additionally requires all visas approved.
--   admin    — same guard applies (is_admin passes can_access_company).
--
-- CROSS-REPO IMPACT
--   Flutter agency "Mark ready" button now receives this error if tapped early;
--   the web dashboard disables its buttons client-side before the RPC is reached.

create or replace function public.transition_booking(p_booking_id uuid, p_action text, p_reason text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b bookings%rowtype;
declare package_id_value uuid;
declare next_stage text;
declare next_legacy booking_status;
declare release_seats boolean := false;
begin
  if p_action = 'accept' then
    raise exception 'bookings are confirmed automatically after successful payment';
  end if;

  select package_id into package_id_value from bookings where id = p_booking_id;
  if package_id_value is null then raise exception 'booking not found'; end if;
  perform 1 from packages where id = package_id_value for update;
  select * into b from bookings where id = p_booking_id for update;
  if b.operational_stage in ('requested','needs_information','awaiting_payment')
     and b.expires_at is not null and b.expires_at <= now() then
    raise exception 'booking request has expired';
  end if;

  if p_action = 'request_information' then
    if not can_access_company(b.company_id, 'bookings')
       or b.operational_stage not in ('requested','needs_information') then
      raise exception 'information cannot be requested';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'a reason is required'; end if;
    next_stage := 'needs_information'; next_legacy := 'pending';
  elsif p_action = 'reject' then
    if not can_access_company(b.company_id, 'bookings')
       or b.operational_stage not in ('requested','needs_information','awaiting_payment') then
      raise exception 'booking cannot be rejected';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'a reason is required'; end if;
    next_stage := 'rejected'; next_legacy := 'cancelled'; release_seats := true;
  elsif p_action = 'cancel' then
    if not (b.client_id = (select auth.uid())
            or can_access_company(b.company_id, 'bookings'))
       or b.operational_stage not in
          ('requested','needs_information','awaiting_payment','confirmed','ready') then
      raise exception 'booking cannot be cancelled';
    end if;
    if nullif(btrim(p_reason), '') is null then
      raise exception 'a cancellation reason is required';
    end if;
    next_stage := 'cancelled'; next_legacy := 'cancelled'; release_seats := true;
  elsif p_action = 'ready' then
    if not can_access_company(b.company_id, 'bookings')
       or b.operational_stage <> 'confirmed' then
      raise exception 'booking cannot be marked ready';
    end if;
    if exists (
      select 1 from booking_travellers t
      where t.booking_id = b.id and t.visa_status <> 'approved'
    ) then
      raise exception 'all traveller visas must be approved before the trip is ready';
    end if;
    next_stage := 'ready'; next_legacy := 'confirmed';
  elsif p_action = 'start' then
    if not can_access_company(b.company_id, 'bookings')
       or b.operational_stage not in ('confirmed','ready') then
      raise exception 'booking cannot be started';
    end if;
    next_stage := 'in_progress'; next_legacy := 'confirmed';
  elsif p_action = 'complete' then
    if not can_access_company(b.company_id, 'bookings')
       or b.operational_stage not in ('confirmed','ready','in_progress') then
      raise exception 'booking cannot be completed';
    end if;
    if b.departure_date is not null and b.departure_date > current_date then
      raise exception 'a future trip cannot be completed';
    end if;
    next_stage := 'completed'; next_legacy := 'completed';
  else
    raise exception 'invalid booking action';
  end if;

  update bookings set operational_stage = next_stage, status = next_legacy,
    status_reason = nullif(btrim(p_reason), ''),
    ready_at = case when p_action = 'ready' then now() else ready_at end,
    started_at = case when p_action = 'start' then now() else started_at end,
    completed_at = case when p_action = 'complete' then now() else completed_at end,
    cancelled_at = case when p_action in ('cancel','reject') then now() else cancelled_at end,
    cancelled_by = case when p_action in ('cancel','reject') then auth.uid() else cancelled_by end,
    expires_at = case
      when next_stage in ('confirmed','ready','in_progress','completed','cancelled','rejected')
        then null
      else expires_at
    end
  where id = p_booking_id;
  if release_seats then
    update packages set seats_reserved = greatest(0, seats_reserved - b.travellers)
    where id = b.package_id;
  end if;
  perform write_audit('booking', p_booking_id, p_action,
    jsonb_build_object('stage', b.operational_stage),
    jsonb_build_object('stage', next_stage), p_reason);
end;
$function$;

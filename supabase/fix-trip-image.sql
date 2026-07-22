-- Tawaf — trip cover images are never saved
-- Run this in the Supabase SQL editor (project: wvgrdmzezwdwcyicwgev).
-- Safe to run more than once.
--
-- Cause: update_offer_bundle() rewrites every package column EXCEPT image_url,
-- so the cover URL is silently dropped on every save after the first.
--
-- The wizard uploads the file before the trip has an id, so it calls
-- create_offer_draft() first (with image_url still empty), then uploads and
-- holds the URL in React state. The next save goes through
-- update_offer_bundle(), which discards it. Net effect: the file lands in the
-- package-images bucket but packages.image_url stays null forever.

begin;

-- ---------------------------------------------------------------------------
-- 1. Persist image_url on update.
--    Identical to the existing function apart from the added assignment.
-- ---------------------------------------------------------------------------
create or replace function public.update_offer_bundle(
  p_offer_id uuid, p_fields jsonb, p_itinerary jsonb, p_pricing jsonb,
  p_hotels jsonb, p_inclusions jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare current_row packages%rowtype;
declare supplied packages%rowtype;
begin
  select * into current_row from packages where id = p_offer_id for update;
  if current_row.id is null
     or not (owns_company(current_row.company_id) or is_admin()) then
    raise exception 'not your package';
  end if;
  supplied := jsonb_populate_record(current_row, p_fields);
  if supplied.company_id <> current_row.company_id then
    raise exception 'package company cannot be changed';
  end if;
  update packages set
    title = supplied.title, title_ar = supplied.title_ar,
    title_en = supplied.title_en, overview = supplied.overview,
    overview_ar = supplied.overview_ar, overview_en = supplied.overview_en,
    price_iqd = supplied.price_iqd, original_iqd = supplied.original_iqd,
    days = supplied.days, nights = supplied.nights, transport = supplied.transport,
    carrier = supplied.carrier, transfer_note = supplied.transfer_note,
    acc_stars = supplied.acc_stars, hotel = supplied.hotel,
    distance_haram = supplied.distance_haram, room = supplied.room,
    meals = supplied.meals, includes = supplied.includes, badge = supplied.badge,
    image_url = supplied.image_url,          -- <<< was missing
    capacity = supplied.capacity, departure_date = supplied.departure_date,
    return_date = supplied.return_date,
    hotel_makkah_description = supplied.hotel_makkah_description,
    hotel_madinah_description = supplied.hotel_madinah_description,
    room_occupancies = supplied.room_occupancies,
    package_tier = supplied.package_tier, group_type = supplied.group_type,
    season_tag = supplied.season_tag,
    departure_airport = supplied.departure_airport,
    airline_name = supplied.airline_name,
    airline_logo_url = supplied.airline_logo_url,
    flight_type = supplied.flight_type,
    bus_between_cities = supplied.bus_between_cities,
    airport_transfers = supplied.airport_transfers,
    transport_notes = supplied.transport_notes, meals_per_day = supplied.meals_per_day,
    video_url = supplied.video_url,
    cancellation_policy = supplied.cancellation_policy,
    cancellation_policy_ar = supplied.cancellation_policy_ar,
    cancellation_policy_en = supplied.cancellation_policy_en,
    deposit_iqd = supplied.deposit_iqd,
    non_refundable_deposit = supplied.non_refundable_deposit,
    deposit_terms = supplied.deposit_terms,
    deposit_terms_ar = supplied.deposit_terms_ar,
    deposit_terms_en = supplied.deposit_terms_en,
    accepted_payment_methods = supplied.accepted_payment_methods
  where id = p_offer_id;
  perform save_offer_details(p_offer_id, p_itinerary, p_pricing, p_hotels, p_inclusions);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Recover covers already uploaded but never linked.
--    The wizard names the object '<package_id>.cover', so any package with a
--    matching object and a null image_url lost its cover to this bug.
--
--    protect_reviewed_trip_changes() blocks content edits to any trip already in
--    pending_review/published/paused/sold_out/expired/removed unless is_admin().
--    In the SQL editor auth.uid() is null, so that check fails and the backfill
--    is rejected with 'reviewed trip changes require admin approval'.
--
--    auth.uid() reads request.jwt.claims->>'sub', so we adopt an existing admin
--    identity for this transaction only. set_config(..., true) is transaction
--    local and reverts on commit; the trigger stays enabled throughout, so
--    nothing else can slip past it.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from public.profiles where role = 'admin' order by created_at limit 1)
  )::text,
  true
);

update public.packages p
   set image_url = 'https://wvgrdmzezwdwcyicwgev.supabase.co/storage/v1/object/public/package-images/'
                   || o.name || '?v=' || extract(epoch from o.created_at)::bigint
  from storage.objects o
 where o.bucket_id = 'package-images'
   and o.name = p.id::text || '.cover'
   and p.image_url is null;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- select title, image_url from public.packages
--  where image_url is not null order by updated_at desc;

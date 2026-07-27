-- Tawaf — client notifications for the visa decision and trip-ready steps
-- Applied to project wvgrdmzezwdwcyicwgev as migration `notify_client_visa_and_ready`.
--
-- WHY
--   The booking lifecycle notified the client on payment/confirm and on the document
--   verdict, but two steps were silent:
--     * visa decision  — agency approves/rejects a traveller's visa
--     * trip ready     — booking reaches operational_stage='ready'
--   (The 'ready' transition keeps the legacy `status` at 'confirmed', so the existing
--    notify_booking_status_change trigger never fired for it.)
--
-- WHAT
--   Two SECURITY DEFINER triggers in the `private` schema, mirroring
--   private.notify_client_document_review():
--     1. after_notify_client_visa_review  (booking_travellers, UPDATE OF visa_status)
--        -> inserts type 'visaApproved' | 'visaRejected', arg = traveller full_name
--     2. after_notify_client_booking_ready (bookings, UPDATE OF operational_stage)
--        -> inserts type 'bookingReady', arg = package title
--   Both fire only on a real transition and bypass RLS (definer-owned).
--
-- CROSS-REPO IMPACT (Flutter app: /Users/abdulla/Desktop/projects/umrah)
--   The app's NotificationType enum + notifications screen + l10n were extended with
--   visaApproved / visaRejected / bookingReady so these `type` strings render as real
--   messages instead of the generic fallback. Keep the enum names in sync with the
--   strings inserted here.

create or replace function private.notify_client_visa_review()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.visa_status is not distinct from old.visa_status
     or new.visa_status not in ('approved', 'rejected') then
    return new;
  end if;
  if new.client_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, type, arg, booking_id)
  values (
    new.client_id,
    case new.visa_status when 'approved' then 'visaApproved' else 'visaRejected' end,
    new.full_name,
    new.booking_id
  );
  return new;
end;
$function$;

drop trigger if exists after_notify_client_visa_review on public.booking_travellers;
create trigger after_notify_client_visa_review
  after update of visa_status on public.booking_travellers
  for each row execute function private.notify_client_visa_review();


create or replace function private.notify_client_booking_ready()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare package_title text;
begin
  if new.operational_stage is not distinct from old.operational_stage
     or new.operational_stage <> 'ready' then
    return new;
  end if;
  if new.client_id is null then
    return new;
  end if;

  select title into package_title from public.packages where id = new.package_id;

  insert into public.notifications (user_id, type, arg, booking_id)
  values (new.client_id, 'bookingReady', package_title, new.id);
  return new;
end;
$function$;

drop trigger if exists after_notify_client_booking_ready on public.bookings;
create trigger after_notify_client_booking_ready
  after update of operational_stage on public.bookings
  for each row execute function private.notify_client_booking_ready();

-- Tawaf — two admin/trust fixes.
-- Applied to project wvgrdmzezwdwcyicwgev as migrations:
--   fix_reviews_moderation_bypass
--   audit_commission_changes

---------------------------------------------------------------------------
-- 1. Close the review moderation bypass  (SECURITY / CORRECTNESS BUG)
---------------------------------------------------------------------------
-- BUG
--   `reviews` carried two PERMISSIVE SELECT policies:
--     public read reviews  -> qual: true            (role public)
--     read visible reviews -> moderation_status = 'visible'
--                             OR owns_company OR is_admin
--   Postgres ORs permissive policies together, so `true` swallowed the second
--   one entirely: a review an admin hid or removed stayed world-readable and
--   review moderation did nothing at all.
--
-- FIX
--   Drop the blanket policy. `read visible reviews` already grants exactly the
--   intended access for anon + authenticated:
--     * anyone sees reviews whose moderation_status is 'visible'
--     * the owning company still sees its own hidden/flagged reviews
--     * admin sees everything
--
-- CROSS-REPO IMPACT (Flutter app)
--   The app reads reviews on agency/offer pages and will now correctly stop
--   showing moderated-away reviews. No client code change required.
drop policy if exists "public read reviews" on public.reviews;

---------------------------------------------------------------------------
-- 2. Make commission changes auditable
---------------------------------------------------------------------------
-- WHY
--   resolve_commission_rate() resolves offer override -> agency override ->
--   5% platform default, and the admin dashboard can now edit the agency tier
--   directly. A commission rate is money: an unexplained change six months from
--   now is indistinguishable from theft, including to the platform owner.
--   Every other privileged action already lands in audit_logs via write_audit();
--   these two tables were the gap.
--
--   bookings.commission_rate is snapshotted at creation, so this records the
--   *policy* change and never rewrites money already booked.
--
-- ROLE REVIEW
--   Only admin can write these tables (RLS: is_admin()), so only admin actions
--   are recorded. audit_logs stays append-only — it has a SELECT policy for
--   admin and no INSERT/UPDATE/DELETE policy, so rows can only arrive through
--   write_audit()'s SECURITY DEFINER context and nobody can edit them after.

create or replace function public.audit_commercial_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare entity text;
declare subject uuid;
begin
  if tg_table_name = 'agency_commercial_settings' then
    entity := 'company';
    subject := coalesce(new.agency_id, old.agency_id);
  else
    entity := 'package';
    subject := coalesce(new.offer_id, old.offer_id);
  end if;

  perform write_audit(
    entity,
    subject,
    case tg_op when 'INSERT' then 'commission_set'
               when 'UPDATE' then 'commission_changed'
               else 'commission_cleared' end,
    case when tg_op = 'INSERT' then null
         else to_jsonb(old) - 'updated_by' - 'updated_at' end,
    case when tg_op = 'DELETE' then null
         else to_jsonb(new) - 'updated_by' - 'updated_at' end,
    null
  );
  return coalesce(new, old);
end;
$function$;

drop trigger if exists after_agency_commission_audit on public.agency_commercial_settings;
create trigger after_agency_commission_audit
after insert or update or delete on public.agency_commercial_settings
for each row execute function public.audit_commercial_settings();

drop trigger if exists after_offer_commission_audit on public.offer_commercial_settings;
create trigger after_offer_commission_audit
after insert or update or delete on public.offer_commercial_settings
for each row execute function public.audit_commercial_settings();

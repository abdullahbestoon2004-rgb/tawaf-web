-- Tawaf — multi-branch agencies.
-- Applied to project wvgrdmzezwdwcyicwgev as migrations:
--   company_branches_foundation
--   branch_marketplace_visibility_gate
--
-- MODEL
--   A branch IS a companies row with parent_company_id set. Every operational
--   table already points at company_id (packages, bookings, payments,
--   commissions, agency_ledger, payouts, agency_staff, traveller_documents,
--   trip_*, inquiries), so a branch inherits its own inventory, money, staff,
--   licence and verification with NO foreign-key migration and NO policy
--   rewrites. A separate company_branches table would have meant re-pointing
--   ~15 FKs and every RLS policy.
--
--   Deliberately ONE level deep: chains make the cascade rules and the
--   "whose money is this" question ambiguous.
--
--   Note the pre-existing companies.branches text[] is unrelated: it is
--   decorative profile copy and is NOT the branch entity.
--
-- ROLE REVIEW
--   client    — sees a branch as an ordinary agency (name, licence, rating are
--               per branch, which is correct: the branch is the counterparty).
--               New restriction: offers from a branch whose head office is not
--               live are no longer visible.
--   companies — a group owner reaches every branch through the widened
--               owns_company(); staff membership stays strictly per branch, so
--               a Sulaymaniyah clerk still cannot see Erbil passports.
--   admin     — unchanged; verifies each branch on its own licence.
--
-- CROSS-REPO IMPACT (Flutter app)
--   fetchMyCompany() used .maybeSingle() on owner_id, which throws once an
--   owner holds a head office AND branches. Fixed in the app to order head
--   offices first and take one. The app has no branch switcher yet, so mobile
--   agency screens operate on the head office.

alter table public.companies
  add column if not exists parent_company_id uuid references public.companies(id) on delete restrict;

create index if not exists companies_parent_company_id_idx
  on public.companies(parent_company_id);

-- 1. Structural guard: no self-parenting, no chains, and a company that already
--    has branches cannot itself become one.
create or replace function public.enforce_single_level_branches()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.parent_company_id is null then return new; end if;
  if new.parent_company_id = new.id then
    raise exception 'a company cannot be its own branch';
  end if;
  if exists (select 1 from companies p
             where p.id = new.parent_company_id and p.parent_company_id is not null) then
    raise exception 'branches are one level deep: the parent is already a branch';
  end if;
  if exists (select 1 from companies c where c.parent_company_id = new.id) then
    raise exception 'this company already has branches and cannot become one';
  end if;
  return new;
end;
$function$;

drop trigger if exists before_company_branch_guard on public.companies;
create trigger before_company_branch_guard
before insert or update of parent_company_id on public.companies
for each row execute function public.enforce_single_level_branches();

-- 2. The single change that grants a group owner access to every branch.
--    Every policy routes through owns_company()/can_access_company(), so
--    widening this one function propagates group access everywhere.
create or replace function public.owns_company(cid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists(
    select 1 from companies c
    where c.id = cid
      and (
        c.owner_id = (select auth.uid())
        or exists (
          select 1 from companies p
          where p.id = c.parent_company_id
            and p.owner_id = (select auth.uid())
        )
      )
  );
$function$;

-- 3. Marketplace gate: a branch is only sellable if its head office is live.
--    Returns true when there is no parent, so single-office agencies are
--    unaffected.
create or replace function public.company_group_active(cid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select p.is_active and p.is_verified and p.verification_status = 'approved'
       from companies c
       join companies p on p.id = c.parent_company_id
      where c.id = cid),
    true
  );
$function$;

-- 4. Suspending a head office takes its branches down. Without this you suspend
--    the group for fraud and every branch keeps selling. Reinstatement is
--    deliberately NOT cascaded: each branch is re-checked on its own merits.
create or replace function public.cascade_parent_suspension()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.is_active is false and old.is_active is true)
     or (new.verification_status in ('suspended','rejected')
         and old.verification_status is distinct from new.verification_status) then
    update companies
       set is_active = false,
           verification_status = 'suspended',
           verification_reason = coalesce(
             nullif(btrim(new.verification_reason), ''),
             'Head office suspended'
           )
     where parent_company_id = new.id
       and (is_active or verification_status not in ('suspended','rejected'));

    perform write_audit('company', new.id, 'branches_suspended_by_parent',
      null, jsonb_build_object('parent', new.id), new.verification_reason);
  end if;
  return new;
end;
$function$;

drop trigger if exists after_company_suspension_cascade on public.companies;
create trigger after_company_suspension_cascade
after update of is_active, verification_status on public.companies
for each row execute function public.cascade_parent_suspension();

-- 5. Commission becomes four tiers: trip -> branch -> head office -> 5%.
create or replace function public.resolve_commission_rate(p_package_id uuid)
returns numeric
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(os.commission_rate, acs.commission_rate, pcs.commission_rate, 0.0500)
  from packages p
  join companies c on c.id = p.company_id
  left join offer_commercial_settings os on os.offer_id = p.id
  left join agency_commercial_settings acs on acs.agency_id = c.id
  left join agency_commercial_settings pcs on pcs.agency_id = c.parent_company_id
  where p.id = p_package_id;
$function$;

-- 6. Apply the group gate to marketplace visibility. The cascade above handles a
--    head office that goes down after its branches are live; this closes the
--    other direction — a branch verified while its parent is still pending.
drop policy if exists "public read packages" on public.packages;
create policy "public read packages" on public.packages
for select to anon, authenticated
using (
  (
    is_published
    and lifecycle_status = 'published'
    and (departure_date is null or departure_date >= current_date)
    and exists (
      select 1 from companies c
      where c.id = packages.company_id
        and c.is_active and c.is_verified
        and c.verification_status = 'approved'
    )
    and company_group_active(packages.company_id)
  )
  or owns_company(company_id)
  or is_admin()
);

drop policy if exists "read visible offers" on public.packages;
create policy "read visible offers" on public.packages
for select to anon, authenticated
using (
  (
    lifecycle_status = 'published'
    and is_published
    and departure_date >= current_date
    and exists (
      select 1 from companies c
      where c.id = packages.company_id
        and c.status = 'active' and c.is_active and c.is_verified
    )
    and company_group_active(packages.company_id)
  )
  or owns_company(company_id)
  or is_admin()
);

create or replace function public.can_read_offer(p_offer_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select exists (
    select 1 from packages p join companies c on c.id = p.company_id
    where p.id = p_offer_id and (
      (p.lifecycle_status = 'published' and p.is_published
       and (p.departure_date is null or p.departure_date >= current_date)
       and c.status = 'active' and c.is_active and c.is_verified
       and company_group_active(c.id))
      or owns_company(p.company_id) or is_admin()
    )
  );
$function$;

---------------------------------------------------------------------------
-- Creating a branch (admin or group owner), for reference:
--   insert into public.companies(name, owner_id, parent_company_id, location)
--   values ('Al-Noor Travel — Erbil', '<owner-uuid>', '<head-office-uuid>', 'Erbil');
-- The branch then submits its own licence and is verified separately.
---------------------------------------------------------------------------

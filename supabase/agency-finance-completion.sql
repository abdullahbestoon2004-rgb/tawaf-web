-- Tawaf — completing the agency (companies) financial page.
-- Applied to project wvgrdmzezwdwcyicwgev as three migrations:
--   agency_ledger_running_balances
--   agency_payout_requests_and_entry_types
--   booking_commission_tier_snapshot
--
-- WHAT WAS MISSING, AND WHY EACH PIECE IS SHAPED THE WAY IT IS
--
-- 1. TWO BALANCES, NOT ONE.
--    agency_ledger has always mixed two unrelated obligations in a single
--    signed number: money Tawaf owes the agency (its share of online bookings)
--    and money the agency owes Tawaf (commission on cash it took at its own
--    counter). The sign was the only thing telling them apart, which makes
--    "your balance" a figure nobody can act on — and lets cash an agency is
--    holding disguise itself as earnings it can withdraw. The existing entry
--    types already partition cleanly, so the split needed no data migration,
--    only somewhere to record it.
--
-- 2. RUNNING BALANCES BY TRIGGER, NOT BY EDITING THE WRITE PATHS.
--    balance_after is computed in a BEFORE INSERT trigger rather than inside
--    post_ledger_entry(). Every writer therefore gets it — the settlement RPCs,
--    refund_booking(), and anything the admin dashboard or the Flutter app
--    calls now or later — and no existing ledger write path had to be edited.
--
-- 3. PAYOUT STATUSES ARE ADDITIVE. NOTHING WAS RENAMED.
--    The four states the dashboard needs (requested / approved / paid /
--    rejected) were ADDED alongside the existing pending / completed / failed.
--    Renaming would have rewritten live rows and every read path in the admin
--    dashboard and the Flutter app, neither of which is updated in this
--    session. payout_state() is the single place that maps the seven stored
--    values onto the four logical ones. Nothing else should switch on
--    payouts.status directly.
--
-- ROLE REVIEW (client / companies / admin)
--   client    — no policy on any table here mentions them; unchanged.
--   companies — gain exactly one new right: INSERT their own payout row, and
--               only with status 'requested'. They still cannot UPDATE or
--               DELETE a payout, and still have no write of any kind on
--               agency_ledger. Every rule about a request (minimum, cap,
--               one-at-a-time, who asked) is enforced in a trigger, so the form
--               cannot talk its way past any of them.
--   admin     — unchanged. record_payout(), create_payout(), complete_payout()
--               and fail_payout() all still write the values they always wrote
--               and are not touched by the request validation, which returns
--               early for anything that is not a 'requested' row.
--
-- CROSS-REPO IMPACT (Flutter app + admin dashboard) — read this before shipping
--   * agency_ledger gains TWO COLUMNS (balance_after, cash_balance_after).
--     Additive; select * keeps working.
--   * agency_ledger.entry_type CHECK now also allows 'payout_hold' and
--     'cancellation_fee'. ANY CODE THAT SWITCHES ON entry_type WILL MEET VALUES
--     IT HAS NEVER SEEN. A payout_hold in particular is a reservation, not a
--     movement: code that sums amount_iqd to get a balance must exclude it or
--     it will double-count every requested payout.
--   * payouts.status CHECK now also allows requested/approved/paid/rejected,
--     and the table gains requested_by/requested_at/decided_by/decided_at/
--     decision_reason. Existing rows and existing writers are untouched, but a
--     reader that assumes three possible statuses will now see seven.
--   * ledger_payout_once changed from UNIQUE(payout_id) to
--     UNIQUE(payout_id, entry_type) — a relaxation, matching the shape
--     ledger_payment_once already had. One payout now legitimately carries two
--     entries: the hold at request and the payment at completion.
--   * bookings gains commission_tier (nullable). Deliberately NOT backfilled.
--   * The backfill below is the only UPDATE ever run against agency_ledger. It
--     disables the append-only trigger inside the transaction and touches only
--     the two new columns — no amount, type, date or link is altered.

---------------------------------------------------------------------------
-- 1. Which balance an entry moves
---------------------------------------------------------------------------
-- The single place that classifies an entry type. Anything added to the CHECK
-- constraint later must be classified here or it silently moves neither total.

create or replace function public.ledger_balance_bucket(p_entry_type text)
returns text language sql immutable set search_path to 'public' as $function$
  select case p_entry_type
    -- Tawaf holds the pilgrim's money and owes the agency its share.
    when 'booking_credit'        then 'earnings'
    when 'payout'                then 'earnings'
    when 'refund_reversal'       then 'earnings'
    when 'cancellation_fee'      then 'earnings'
    -- The agency took the money at its own counter and owes the commission.
    when 'cash_commission_debit' then 'cash'
    when 'adjustment'            then 'cash'
    -- A reservation, not a movement: the money is still owed to the agency, it
    -- is merely spoken for. It reduces what is AVAILABLE to request, which is
    -- the earnings balance minus everything currently held.
    when 'payout_hold'           then 'hold'
    else 'earnings'
  end;
$function$;

alter table public.agency_ledger add column if not exists balance_after bigint;
alter table public.agency_ledger add column if not exists cash_balance_after bigint;

comment on column public.agency_ledger.balance_after is
  'Earnings balance after this entry (what Tawaf owes the agency). Written by the ledger_running_balance trigger; never set by callers.';
comment on column public.agency_ledger.cash_balance_after is
  'Cash-collected balance after this entry (negative = the agency owes Tawaf commission). Written by the same trigger.';

create or replace function public.ledger_running_balance()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  bucket text := ledger_balance_bucket(new.entry_type);
  prior_earnings bigint;
  prior_cash bigint;
begin
  -- The same lock the settlement RPCs take. Without it two concurrent inserts
  -- for one company both read the same prior balance and both write the same
  -- balance_after, and the column silently stops being a running total.
  perform pg_advisory_xact_lock(hashtext('payout-' || new.company_id::text));

  select coalesce(sum(amount_iqd) filter (where ledger_balance_bucket(entry_type) = 'earnings'), 0),
         coalesce(sum(amount_iqd) filter (where ledger_balance_bucket(entry_type) = 'cash'), 0)
    into prior_earnings, prior_cash
  from agency_ledger where company_id = new.company_id;

  new.balance_after := prior_earnings + case when bucket = 'earnings' then new.amount_iqd else 0 end;
  new.cash_balance_after := prior_cash + case when bucket = 'cash' then new.amount_iqd else 0 end;
  return new;
end; $function$;

drop trigger if exists ledger_running_balance on public.agency_ledger;
create trigger ledger_running_balance
  before insert on public.agency_ledger
  for each row execute function public.ledger_running_balance();

-- Backfill. agency_ledger is append-only by trigger, so the one moment it is
-- legal to UPDATE a row is a migration adding a column the rows predate.
alter table public.agency_ledger disable trigger ledger_no_update_delete;

with ordered as (
  select id,
         sum(case when ledger_balance_bucket(entry_type) = 'earnings' then amount_iqd else 0 end)
           over (partition by company_id order by created_at, id
                 rows between unbounded preceding and current row) as running_earnings,
         sum(case when ledger_balance_bucket(entry_type) = 'cash' then amount_iqd else 0 end)
           over (partition by company_id order by created_at, id
                 rows between unbounded preceding and current row) as running_cash
  from agency_ledger
)
update agency_ledger l
   set balance_after = o.running_earnings,
       cash_balance_after = o.running_cash
  from ordered o
 where o.id = l.id;

alter table public.agency_ledger enable trigger ledger_no_update_delete;

---------------------------------------------------------------------------
-- 2. Entry types
---------------------------------------------------------------------------
-- Deliberately NOT added: a separate 'commission_charge'. On an online booking
-- the commission is already deducted inside booking_credit (payout_iqd = total
-- − commission), and on a cash booking it IS cash_commission_debit. A third
-- entry would double-count one of the two. The per-booking commission stays
-- readable from the booking's own snapshot columns, which is where the
-- drill-down reads it.

alter table public.agency_ledger drop constraint if exists agency_ledger_entry_type_check;
alter table public.agency_ledger add constraint agency_ledger_entry_type_check
  check (entry_type = any (array[
    'booking_credit', 'cash_commission_debit', 'payout', 'refund_reversal',
    'adjustment', 'payout_hold', 'cancellation_fee'
  ]));

-- One payout now carries two entries — the hold at request and the payment at
-- completion — so uniqueness has to be per (payout, type), exactly as
-- ledger_payment_once already is for payments.
drop index if exists public.ledger_payout_once;
create unique index if not exists ledger_payout_once
  on public.agency_ledger (payout_id, entry_type) where payout_id is not null;

---------------------------------------------------------------------------
-- 3. Payout lifecycle
---------------------------------------------------------------------------

alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status = any (array[
    'requested', 'approved', 'paid', 'rejected',   -- the agency-facing lifecycle
    'pending', 'completed', 'failed'               -- what the existing RPCs write
  ]));

alter table public.payouts add column if not exists requested_by uuid references public.profiles(id);
alter table public.payouts add column if not exists requested_at timestamptz;
alter table public.payouts add column if not exists decided_by uuid references public.profiles(id);
alter table public.payouts add column if not exists decided_at timestamptz;
alter table public.payouts add column if not exists decision_reason text;

create or replace function public.payout_state(p_status text)
returns text language sql immutable set search_path to 'public' as $function$
  select case p_status
    when 'requested' then 'requested'
    -- An admin-created payout is already past the request step: it exists
    -- because an admin decided to make it, and is waiting to be paid.
    when 'pending'   then 'approved'
    when 'approved'  then 'approved'
    when 'completed' then 'paid'
    when 'paid'      then 'paid'
    when 'failed'    then 'rejected'
    when 'rejected'  then 'rejected'
    else p_status
  end;
$function$;

-- One place decides the floor. A request below it is refused by the database,
-- not merely discouraged by the form.
create or replace function public.payout_minimum_iqd()
returns bigint language sql immutable set search_path to 'public' as $function$
  select 50000::bigint;
$function$;

---------------------------------------------------------------------------
-- 4. Balances, defined once
---------------------------------------------------------------------------
-- All four read the same buckets the ledger trigger writes, so the figure the
-- agency sees, the figure a request is capped at, and the figure the admin
-- settles against cannot drift apart.

create or replace function public.agency_earnings_balance(p_company_id uuid)
returns bigint language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(amount_iqd) filter (where ledger_balance_bucket(entry_type) = 'earnings'), 0)::bigint
  from agency_ledger where company_id = p_company_id;
$function$;

-- Money already spoken for by a request or an approval that has not been paid
-- or rejected yet. Derived from the payout rows rather than from the hold
-- entries, so a hold can never be left stranded by a missing release entry.
create or replace function public.agency_held_balance(p_company_id uuid)
returns bigint language sql stable security definer set search_path to 'public' as $function$
  select coalesce(sum(amount_iqd), 0)::bigint
  from payouts
  where company_id = p_company_id
    and payout_state(status) in ('requested', 'approved');
$function$;

create or replace function public.agency_available_balance(p_company_id uuid)
returns bigint language sql stable security definer set search_path to 'public' as $function$
  select greatest(0, agency_earnings_balance(p_company_id) - agency_held_balance(p_company_id));
$function$;

-- Positive means the agency owes Tawaf. Kept apart from earnings on purpose.
create or replace function public.agency_cash_owed(p_company_id uuid)
returns bigint language sql stable security definer set search_path to 'public' as $function$
  select greatest(0, -coalesce(sum(amount_iqd) filter (where ledger_balance_bucket(entry_type) = 'cash'), 0))::bigint
  from agency_ledger where company_id = p_company_id;
$function$;

---------------------------------------------------------------------------
-- 5. The request path
---------------------------------------------------------------------------
-- Insert-only, per the security model: the agency may create a request and read
-- it back, and can never move it forward.

create or replace function public.validate_payout_request()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  available bigint;
begin
  -- Admin-created payouts (record_payout, create_payout) insert 'completed' or
  -- 'pending' and are left exactly as they were.
  if payout_state(new.status) <> 'requested' then
    return new;
  end if;

  if not can_access_company(new.company_id, 'finance') then
    raise exception 'not permitted for this company';
  end if;

  if exists (select 1 from payouts
             where company_id = new.company_id
               and payout_state(status) in ('requested', 'approved')
               and id is distinct from new.id) then
    raise exception 'a payout request is already in progress';
  end if;

  if new.amount_iqd < payout_minimum_iqd() then
    raise exception 'below the % minimum', payout_minimum_iqd();
  end if;

  available := agency_available_balance(new.company_id);
  if new.amount_iqd > available then
    raise exception 'request % exceeds available balance %', new.amount_iqd, available;
  end if;

  -- Set here rather than trusted from the client.
  new.requested_by := auth.uid();
  new.requested_at := now();
  new.completed_at := null;
  return new;
end; $function$;

drop trigger if exists validate_payout_request on public.payouts;
create trigger validate_payout_request
  before insert on public.payouts
  for each row execute function public.validate_payout_request();

-- The hold is an audit record of when the money was spoken for. It moves
-- neither running balance (ledger_balance_bucket returns 'hold'); what it does
-- is make the reservation visible in the ledger the agency reads.
create or replace function public.write_payout_hold()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if payout_state(new.status) = 'requested' then
    perform post_ledger_entry(
      new.company_id, null, null, new.id, 'payout_hold', -new.amount_iqd,
      'Payout requested');
  end if;
  return new;
end; $function$;

drop trigger if exists write_payout_hold on public.payouts;
create trigger write_payout_hold
  after insert on public.payouts
  for each row execute function public.write_payout_hold();

drop policy if exists "agency requests own payout" on public.payouts;
create policy "agency requests own payout" on public.payouts
  for insert to authenticated
  with check (
    can_access_company(company_id, 'finance')
    and status = 'requested'
    and completed_at is null
  );

grant insert on public.payouts to authenticated;

---------------------------------------------------------------------------
-- 6. Which commission tier applied
---------------------------------------------------------------------------
-- bookings already snapshots the RATE and the money. What it never recorded is
-- WHICH rule produced that rate. Without it the drill-down could only answer
-- "which tier applied?" by reading today's config — exactly the recomputation
-- the snapshot columns exist to prevent, since a rate changed last week would
-- rewrite the history of every booking taken before it.
--
-- resolve_commission_tier() mirrors resolve_commission_rate()'s precedence
-- exactly — offer, agency, parent group, default. If one is ever reordered the
-- other must be too.

create or replace function public.resolve_commission_tier(p_package_id uuid)
returns text language sql stable security definer set search_path to 'public' as $function$
  select case
    when os.commission_rate is not null then 'offer'
    when acs.commission_rate is not null then coalesce(nullif(btrim(acs.commission_tier), ''), 'agency')
    when pcs.commission_rate is not null then coalesce(nullif(btrim(pcs.commission_tier), ''), 'group')
    else 'default'
  end
  from packages p
  join companies c on c.id = p.company_id
  left join offer_commercial_settings os on os.offer_id = p.id
  left join agency_commercial_settings acs on acs.agency_id = c.id
  left join agency_commercial_settings pcs on pcs.agency_id = c.parent_company_id
  where p.id = p_package_id;
$function$;

alter table public.bookings add column if not exists commission_tier text;

comment on column public.bookings.commission_tier is
  'Snapshot of which rule produced commission_rate at booking time (offer / an agency tier name / group / default). Null on rows created before this column existed — deliberately not backfilled, since the tier that applied then is not recoverable from current config.';

-- A trigger of its own rather than an edit to fill_booking_amounts(): that
-- function is the booking write path the Flutter app depends on, and this needs
-- to add a column, not change how any existing one is computed.
create or replace function public.snapshot_commission_tier()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.commission_tier is null and new.package_id is not null then
    new.commission_tier := resolve_commission_tier(new.package_id);
  end if;
  return new;
end; $function$;

drop trigger if exists before_commission_tier_snapshot on public.bookings;
create trigger before_commission_tier_snapshot
  before insert on public.bookings
  for each row execute function public.snapshot_commission_tier();

---------------------------------------------------------------------------
-- 7. Grants
---------------------------------------------------------------------------
-- Trigger functions are reachable over /rest/v1/rpc unless revoked; triggers
-- themselves execute as the table owner regardless.

revoke all on function public.ledger_running_balance() from public, anon, authenticated;
revoke all on function public.validate_payout_request() from public, anon, authenticated;
revoke all on function public.write_payout_hold() from public, anon, authenticated;
revoke all on function public.snapshot_commission_tier() from public, anon, authenticated;

revoke all on function public.ledger_balance_bucket(text) from public, anon;
revoke all on function public.payout_state(text), public.payout_minimum_iqd(),
  public.agency_earnings_balance(uuid), public.agency_held_balance(uuid),
  public.agency_available_balance(uuid), public.agency_cash_owed(uuid) from public, anon;
revoke all on function public.resolve_commission_tier(uuid) from public, anon;

grant execute on function public.ledger_balance_bucket(text) to authenticated;
grant execute on function public.payout_state(text), public.payout_minimum_iqd(),
  public.agency_earnings_balance(uuid), public.agency_held_balance(uuid),
  public.agency_available_balance(uuid), public.agency_cash_owed(uuid) to authenticated;
grant execute on function public.resolve_commission_tier(uuid) to authenticated;

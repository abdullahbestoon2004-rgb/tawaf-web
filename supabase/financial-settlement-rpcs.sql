-- Tawaf — admin settlement actions for the Financial page.
-- Applied to project wvgrdmzezwdwcyicwgev as migration:
--   financial_settlement_rpcs
--
-- WHY
--   The ledger already existed (agency_ledger + post_ledger_entry() + the
--   append-only ledger_no_update_delete trigger). What was missing was a single
--   atomic action the admin dashboard can call from a "Pay now" modal.
--   create_payout() and complete_payout() are two round trips: a crash between
--   them leaves a pending payout that has reserved balance but posted no ledger
--   entry, so the company's balance is wrong and nothing says why. Both of the
--   old functions are left untouched so anything else on this Supabase project
--   keeps working.
--
-- THE TWO DIRECTIONS
--   true_up_booking_ledger() already posts in both directions:
--     * pay_method = 'cash'  -> NEGATIVE cash_commission_debit. The company took
--       the pilgrim's money at its own counter and owes Tawaf the commission.
--     * card / fib           -> POSITIVE booking_credit. Tawaf took the money
--       and owes the company its net share.
--   Every booking paid so far is cash, so every live balance is negative. A
--   payout-only admin page would therefore have had nothing it could ever do,
--   which is why record_commission_collection() exists alongside record_payout().
--
-- ROLE REVIEW (client / companies / admin)
--   Both functions are SECURITY DEFINER and gated on is_admin(), so they are the
--   only write path into payouts. payouts and agency_ledger still carry no
--   INSERT/UPDATE/DELETE policy at all, so companies and clients can never write
--   either table directly. Companies keep read access to their own rows through
--   can_access_company(..., 'finance'); admin reads everything because
--   can_access_company() short-circuits on is_admin(). agency_ledger stays
--   append-only — settlement is a new compensating row, never an edit.
--
-- CROSS-REPO IMPACT (Flutter app)
--   Additive only: two new functions, no table, column, policy or existing
--   function changed. The Flutter app needs no update. Note for whoever works
--   there next: `payouts` rows now appear with status 'completed' written in one
--   step, so any app code that assumes a payout is always 'pending' first would
--   need revisiting.

---------------------------------------------------------------------------
-- 1. record_payout — money leaving Tawaf, to a company
---------------------------------------------------------------------------
create or replace function public.record_payout(
  p_company_id uuid,
  p_amount_iqd bigint,
  p_method text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  bal bigint;
  pid uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_amount_iqd <= 0 then raise exception 'amount must be positive'; end if;
  -- Whitelisted rather than free text: the method is reconciliation evidence,
  -- and "Bank"/"bank"/"transfer" as three spellings of one method makes the
  -- export useless six months from now.
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'fib') then
    raise exception 'unsupported payout method %', coalesce(p_method, 'null');
  end if;

  -- Same lock create_payout() takes, so the two can never interleave and both
  -- pass a balance check against the same starting balance.
  perform pg_advisory_xact_lock(hashtext('payout-' || p_company_id::text));

  select coalesce(sum(amount_iqd), 0) into bal
  from agency_ledger where company_id = p_company_id;
  -- Payouts still pending from create_payout() are already spoken for.
  bal := bal - coalesce((select sum(amount_iqd) from payouts
                         where company_id = p_company_id and status = 'pending'), 0);
  if p_amount_iqd > bal then
    raise exception 'payout % exceeds available balance %', p_amount_iqd, bal;
  end if;

  insert into payouts (company_id, amount_iqd, method, reference, status, completed_at)
  values (p_company_id, p_amount_iqd, p_method, nullif(btrim(p_reference), ''),
          'completed', now())
  returning id into pid;

  perform post_ledger_entry(
    p_company_id, null, null, pid, 'payout', -p_amount_iqd,
    'Payout to agency (' || coalesce(nullif(btrim(p_reference), ''), pid::text) || ')');

  perform write_audit('company', p_company_id, 'payout_recorded', null,
    jsonb_build_object('payout_id', pid, 'amount_iqd', p_amount_iqd,
                       'method', p_method, 'reference', nullif(btrim(p_reference), '')),
    nullif(btrim(p_reference), ''));

  return pid;
end;
$function$;

---------------------------------------------------------------------------
-- 2. record_commission_collection — money coming in, from a company
---------------------------------------------------------------------------
-- Clears a negative balance. Until this existed there was no way to clear one,
-- so a company that had already settled up still read as owing money forever.
--
-- The mirror record in `commissions` (status owed -> collected) is advanced in
-- the same transaction, oldest first, so that table and the ledger cannot drift
-- apart. A commission row is only flipped when the money covers it in full;
-- a part payment leaves it owed and the ledger carries the difference.
create or replace function public.record_commission_collection(
  p_company_id uuid,
  p_amount_iqd bigint,
  p_method text,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  owed bigint;
  remaining bigint;
  row_commission commissions%rowtype;
  ref text := nullif(btrim(p_reference), '');
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_amount_iqd <= 0 then raise exception 'amount must be positive'; end if;
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'fib') then
    raise exception 'unsupported collection method %', coalesce(p_method, 'null');
  end if;

  perform pg_advisory_xact_lock(hashtext('payout-' || p_company_id::text));

  -- A negative ledger balance is what the company owes; anything else means
  -- there is nothing to collect.
  select -coalesce(sum(amount_iqd), 0) into owed
  from agency_ledger where company_id = p_company_id;
  if owed <= 0 then
    raise exception 'company owes nothing';
  end if;
  if p_amount_iqd > owed then
    raise exception 'collection % exceeds outstanding commission %', p_amount_iqd, owed;
  end if;

  perform post_ledger_entry(
    p_company_id, null, null, null, 'adjustment', p_amount_iqd,
    'Commission collected from agency via ' || p_method
      || coalesce(' (' || ref || ')', ''));

  remaining := p_amount_iqd;
  for row_commission in
    select * from commissions
    where company_id = p_company_id and status = 'owed'
    order by created_at
    for update
  loop
    exit when remaining < row_commission.amount_iqd;
    update commissions
       set status = 'collected', collected_at = now()
     where id = row_commission.id;
    remaining := remaining - row_commission.amount_iqd;
  end loop;

  perform write_audit('company', p_company_id, 'commission_collected', null,
    jsonb_build_object('amount_iqd', p_amount_iqd, 'method', p_method,
                       'reference', ref), ref);
end;
$function$;

revoke all on function public.record_payout(uuid, bigint, text, text) from public, anon;
revoke all on function public.record_commission_collection(uuid, bigint, text, text) from public, anon;
grant execute on function public.record_payout(uuid, bigint, text, text) to authenticated;
grant execute on function public.record_commission_collection(uuid, bigint, text, text) to authenticated;

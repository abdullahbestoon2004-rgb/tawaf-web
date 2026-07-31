-- Tawaf — the cost side of the Financial page.
-- Apply to project wvgrdmzezwdwcyicwgev as migration:
--   finance_expenses_budgets_and_receipts
--
-- WHY
--   Until now the finance surface could only answer "who owes whom". Every
--   figure came off bookings, commissions and agency_ledger, and all three only
--   ever record money the marketplace moved. Nothing recorded money SPENT, so
--   neither Tawaf's profit nor an agency's per-trip margin was computable at
--   all — there was no cost side to subtract.
--
--   Three additions, no existing table, column, policy or function changed:
--     1. expenses         — the cost side, for both books
--     2. finance_budgets  — a monthly target per category, for budget-vs-actual
--     3. finance_receipts — a real sequential receipt number for settlements
--
-- ONE TABLE, TWO BOOKS
--   expenses.company_id is NULLABLE and that nullability is the whole design:
--     NULL      -> a Tawaf platform expense (salaries, marketing, gateway fees).
--                  Admin only, in every direction.
--     set       -> that agency's own cost (a hotel, a bus, a visa batch).
--                  Readable and writable by the agency's finance people.
--   A second table for platform costs would have doubled every query, every
--   policy and every chart for one boolean's worth of difference.
--
--   expenses.package_id is what makes per-trip margin possible: revenue and
--   commission already hang off bookings.package_id, so tagging a cost with the
--   same trip closes the loop (revenue - commission - expenses = margin).
--
-- APPEND-ONLY IN SPIRIT, NOT IN LETTER
--   agency_ledger is strictly append-only because it is the settlement record
--   and a rewritten row there means a wrong balance. An expense is a human
--   bookkeeping entry — typos happen and a hard-immutable expense table would
--   just fill with correcting twins. So expenses are UPDATE-able through an RPC
--   that audits the before/after, and are retired with void_expense() rather
--   than deleted: status flips to 'void' and every analytic filters it out, so
--   the row survives for the audit trail. Nothing here can ever mutate the
--   ledger.
--
-- ROLE REVIEW (client / companies / admin)
--   * client   — no policy on any of the three tables mentions them and none is
--                public, so a client sees nothing. Deliberate: expenses expose
--                an agency's cost base, which is commercially sensitive.
--   * companies— read their own rows (can_access_company(..., 'finance'), so an
--                owner, a manager or an accountant, not a booking clerk).
--                Writes go through SECURITY DEFINER RPCs gated on the same
--                check, never through a table policy, matching how payouts and
--                agency_ledger already work.
--   * admin    — everything, via can_access_company()'s is_admin()
--                short-circuit, plus the platform rows (company_id is null)
--                which are admin-only by an explicit is_admin() branch.
--   None of the three tables carries an INSERT/UPDATE/DELETE policy, so the
--   RPCs below are the only write path that exists.
--
-- CROSS-REPO IMPACT (Flutter app)
--   Additive only — three new tables, four new functions, two new triggers on
--   existing tables that write to a new table and touch nothing else. The
--   Flutter app needs no update and no query it runs today changes behaviour.
--   Note for whoever works there next: if agencies are ever to file expenses
--   from the app, record_expense()/void_expense() are the entry points and the
--   'finance' permission is what gates them.

---------------------------------------------------------------------------
-- 0. Category vocabulary
---------------------------------------------------------------------------
-- Free text would make the breakdown chart useless within a month ("Hotel",
-- "hotels", "فندق" as three slices of the same thing), so both scopes are
-- whitelisted. The two lists are disjoint on purpose: a salary is never a trip
-- cost and a hotel is never a platform cost, and record_expense() picks the
-- list from whether company_id is null.

create or replace function public.platform_expense_categories()
returns text[] language sql immutable set search_path to 'public' as $function$
  select array['salaries','marketing','infrastructure','gateway_fees',
               'legal','office','travel','other']::text[];
$function$;

create or replace function public.company_expense_categories()
returns text[] language sql immutable set search_path to 'public' as $function$
  select array['hotel','flight','transport','visa','catering','guide',
               'insurance','staff','marketing','other']::text[];
$function$;

---------------------------------------------------------------------------
-- 1. expenses
---------------------------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  -- NULL = Tawaf's own cost. See "ONE TABLE, TWO BOOKS" above.
  company_id uuid references public.companies(id) on delete cascade,
  -- Set = a cost that belongs to one trip, which is what per-trip margin needs.
  package_id uuid references public.packages(id) on delete set null,
  category text not null,
  amount_iqd bigint not null check (amount_iqd > 0),
  -- Everything in this project settles in IQD, but hotels and airlines invoice
  -- in USD often enough that throwing the original figure away would make an
  -- invoice impossible to reconcile against its expense. amount_iqd stays the
  -- single number every total is built from; these two are evidence.
  currency text not null default 'IQD',
  amount_original numeric,
  fx_rate numeric,
  spent_at date not null default current_date,
  vendor text,
  reference text,
  note text,
  receipt_url text,
  status text not null default 'confirmed' check (status in ('confirmed','void')),
  void_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_category_scope check (
    case when company_id is null
      then category = any(public.platform_expense_categories())
      else category = any(public.company_expense_categories())
    end
  ),
  -- A platform cost has no trip: packages belong to companies.
  constraint expenses_platform_has_no_trip check (company_id is not null or package_id is null)
);

-- The two queries the page actually runs: "this company's costs over a period"
-- and "this trip's costs".
create index if not exists expenses_company_spent_idx on public.expenses (company_id, spent_at desc);
create index if not exists expenses_package_idx on public.expenses (package_id) where package_id is not null;
create index if not exists expenses_platform_spent_idx on public.expenses (spent_at desc) where company_id is null;

alter table public.expenses enable row level security;

drop policy if exists "finance reads expenses" on public.expenses;
create policy "finance reads expenses" on public.expenses
  for select using (
    case when company_id is null
      then public.is_admin()
      else public.can_access_company(company_id, 'finance')
    end
  );

---------------------------------------------------------------------------
-- 2. finance_budgets
---------------------------------------------------------------------------
-- One target per (book, category, month). Purely a comparison line on the
-- expense breakdown — nothing enforces it, and an over-budget month is
-- reported, never blocked.

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  category text not null,
  -- Always the first of the month; set_budget() truncates so callers cannot
  -- create two rows for one month by passing different days.
  month date not null,
  amount_iqd bigint not null check (amount_iqd >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- A plain UNIQUE would not hold for the platform book: NULLs compare distinct,
-- so (null, 'salaries', '2026-07-01') could be inserted twice.
create unique index if not exists finance_budgets_scope_idx
  on public.finance_budgets (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), category, month);

alter table public.finance_budgets enable row level security;

drop policy if exists "finance reads budgets" on public.finance_budgets;
create policy "finance reads budgets" on public.finance_budgets
  for select using (
    case when company_id is null
      then public.is_admin()
      else public.can_access_company(company_id, 'finance')
    end
  );

---------------------------------------------------------------------------
-- 3. finance_receipts
---------------------------------------------------------------------------
-- payouts.reference is whatever the admin typed into the settlement modal — a
-- bank transfer id, a scribble, sometimes nothing. That is evidence, not a
-- receipt number. An accountant needs a gapless sequence they can quote, so
-- every settlement in either direction gets one, issued by trigger rather than
-- by the settlement RPCs: record_payout() and record_commission_collection()
-- keep working untouched, and so does the legacy create_payout()/
-- complete_payout() pair, which would otherwise have been left without numbers.

create sequence if not exists public.finance_receipt_seq;

create table if not exists public.finance_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  kind text not null check (kind in ('payout','collection')),
  company_id uuid not null references public.companies(id) on delete cascade,
  amount_iqd bigint not null,
  method text,
  reference text,
  payout_id uuid references public.payouts(id) on delete set null,
  ledger_entry_id uuid references public.agency_ledger(id) on delete set null,
  issued_at timestamptz not null default now()
);

create index if not exists finance_receipts_company_idx on public.finance_receipts (company_id, issued_at desc);
create unique index if not exists finance_receipts_payout_idx on public.finance_receipts (payout_id) where payout_id is not null;
create unique index if not exists finance_receipts_ledger_idx on public.finance_receipts (ledger_entry_id) where ledger_entry_id is not null;

alter table public.finance_receipts enable row level security;

drop policy if exists "finance reads receipts" on public.finance_receipts;
create policy "finance reads receipts" on public.finance_receipts
  for select using (public.can_access_company(company_id, 'finance'));

create or replace function public.next_receipt_no()
returns text language sql volatile security definer set search_path to 'public' as $function$
  select 'TWF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('finance_receipt_seq')::text, 6, '0');
$function$;

-- Money out. Fires on insert for record_payout() (which writes 'completed'
-- directly) and on the pending -> completed update for complete_payout(); the
-- partial unique index on payout_id makes the second one a no-op if the first
-- already issued a number.
create or replace function public.issue_payout_receipt()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.status = 'completed'
     and not exists (select 1 from finance_receipts where payout_id = new.id) then
    insert into finance_receipts (receipt_no, kind, company_id, amount_iqd, method, reference, payout_id)
    values (next_receipt_no(), 'payout', new.company_id, new.amount_iqd,
            new.method, new.reference, new.id);
  end if;
  return new;
end; $function$;

drop trigger if exists payout_receipt on public.payouts;
create trigger payout_receipt
  after insert or update of status on public.payouts
  for each row execute function public.issue_payout_receipt();

-- Money in. A collection leaves no row of its own anywhere — it is a positive
-- 'adjustment' in the append-only ledger — so the ledger row is what gets the
-- number. add_ledger_adjustment() posts corrections through the same entry
-- type, and those are settlements of a kind too, so they are numbered as well.
create or replace function public.issue_collection_receipt()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.entry_type = 'adjustment' and new.amount_iqd > 0 then
    insert into finance_receipts (receipt_no, kind, company_id, amount_iqd, reference, ledger_entry_id)
    values (next_receipt_no(), 'collection', new.company_id, new.amount_iqd,
            new.description, new.id);
  end if;
  return new;
end; $function$;

drop trigger if exists collection_receipt on public.agency_ledger;
create trigger collection_receipt
  after insert on public.agency_ledger
  for each row execute function public.issue_collection_receipt();

---------------------------------------------------------------------------
-- 4. record_expense
---------------------------------------------------------------------------

create or replace function public.record_expense(
  p_company_id uuid,
  p_package_id uuid,
  p_category text,
  p_amount_iqd bigint,
  p_spent_at date default null,
  p_vendor text default null,
  p_reference text default null,
  p_note text default null,
  p_receipt_url text default null,
  p_currency text default 'IQD',
  p_amount_original numeric default null,
  p_fx_rate numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_id uuid;
  allowed text[];
begin
  -- Two scopes, two gates. A company accountant can never file against the
  -- platform book, and is_admin() short-circuits can_access_company() so an
  -- admin can file for anyone.
  if p_company_id is null then
    if not is_admin() then raise exception 'admin only'; end if;
    allowed := platform_expense_categories();
  else
    if not can_access_company(p_company_id, 'finance') then
      raise exception 'not permitted for this company';
    end if;
    allowed := company_expense_categories();
  end if;

  if p_amount_iqd is null or p_amount_iqd <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_category is null or not (p_category = any(allowed)) then
    raise exception 'unsupported category %', coalesce(p_category, 'null');
  end if;
  -- Without this an agency could attribute its costs to a rival's trip and
  -- corrupt that trip's margin. RLS on packages would not catch it: this
  -- function is SECURITY DEFINER.
  if p_package_id is not null then
    if p_company_id is null then raise exception 'a platform expense has no trip'; end if;
    if not exists (select 1 from packages where id = p_package_id and company_id = p_company_id) then
      raise exception 'trip does not belong to this company';
    end if;
  end if;
  -- A future-dated cost lands in a period that has not happened, which silently
  -- breaks every period total on the page.
  if coalesce(p_spent_at, current_date) > current_date then
    raise exception 'spent_at cannot be in the future';
  end if;

  insert into expenses (company_id, package_id, category, amount_iqd, currency,
                        amount_original, fx_rate, spent_at, vendor, reference,
                        note, receipt_url, created_by)
  values (p_company_id, p_package_id, p_category, p_amount_iqd,
          coalesce(nullif(btrim(p_currency), ''), 'IQD'),
          p_amount_original, p_fx_rate,
          coalesce(p_spent_at, current_date),
          nullif(btrim(p_vendor), ''), nullif(btrim(p_reference), ''),
          nullif(btrim(p_note), ''), nullif(btrim(p_receipt_url), ''),
          auth.uid())
  returning id into new_id;

  perform write_audit('expense', new_id, 'expense_recorded', null,
    jsonb_build_object('company_id', p_company_id, 'package_id', p_package_id,
                       'category', p_category, 'amount_iqd', p_amount_iqd,
                       'spent_at', coalesce(p_spent_at, current_date),
                       'vendor', nullif(btrim(p_vendor), '')),
    nullif(btrim(p_reference), ''));

  return new_id;
end;
$function$;

---------------------------------------------------------------------------
-- 5. update_expense
---------------------------------------------------------------------------
-- Scope is deliberately NOT editable: moving an expense between companies (or
-- between the two books) would rewrite history on both sides of the move. To
-- correct a misfiled expense, void it and file it again.

create or replace function public.update_expense(
  p_expense_id uuid,
  p_package_id uuid,
  p_category text,
  p_amount_iqd bigint,
  p_spent_at date,
  p_vendor text default null,
  p_reference text default null,
  p_note text default null,
  p_receipt_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  row_expense expenses%rowtype;
  allowed text[];
begin
  select * into row_expense from expenses where id = p_expense_id for update;
  if not found then raise exception 'expense not found'; end if;
  if row_expense.status = 'void' then raise exception 'a void expense cannot be edited'; end if;

  if row_expense.company_id is null then
    if not is_admin() then raise exception 'admin only'; end if;
    allowed := platform_expense_categories();
  else
    if not can_access_company(row_expense.company_id, 'finance') then
      raise exception 'not permitted for this company';
    end if;
    allowed := company_expense_categories();
  end if;

  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'amount must be positive'; end if;
  if p_category is null or not (p_category = any(allowed)) then
    raise exception 'unsupported category %', coalesce(p_category, 'null');
  end if;
  if p_package_id is not null then
    if row_expense.company_id is null then raise exception 'a platform expense has no trip'; end if;
    if not exists (select 1 from packages where id = p_package_id and company_id = row_expense.company_id) then
      raise exception 'trip does not belong to this company';
    end if;
  end if;
  if coalesce(p_spent_at, row_expense.spent_at) > current_date then
    raise exception 'spent_at cannot be in the future';
  end if;

  update expenses
     set package_id = p_package_id,
         category = p_category,
         amount_iqd = p_amount_iqd,
         spent_at = coalesce(p_spent_at, row_expense.spent_at),
         vendor = nullif(btrim(p_vendor), ''),
         reference = nullif(btrim(p_reference), ''),
         note = nullif(btrim(p_note), ''),
         receipt_url = nullif(btrim(p_receipt_url), ''),
         updated_at = now()
   where id = p_expense_id;

  perform write_audit('expense', p_expense_id, 'expense_updated',
    jsonb_build_object('category', row_expense.category, 'amount_iqd', row_expense.amount_iqd,
                       'spent_at', row_expense.spent_at, 'package_id', row_expense.package_id),
    jsonb_build_object('category', p_category, 'amount_iqd', p_amount_iqd,
                       'spent_at', coalesce(p_spent_at, row_expense.spent_at),
                       'package_id', p_package_id),
    nullif(btrim(p_reference), ''));
end;
$function$;

---------------------------------------------------------------------------
-- 6. void_expense
---------------------------------------------------------------------------

create or replace function public.void_expense(p_expense_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  row_expense expenses%rowtype;
begin
  select * into row_expense from expenses where id = p_expense_id for update;
  if not found then raise exception 'expense not found'; end if;
  if row_expense.status = 'void' then return; end if;

  if row_expense.company_id is null then
    if not is_admin() then raise exception 'admin only'; end if;
  elsif not can_access_company(row_expense.company_id, 'finance') then
    raise exception 'not permitted for this company';
  end if;

  update expenses
     set status = 'void', void_reason = nullif(btrim(p_reason), ''), updated_at = now()
   where id = p_expense_id;

  perform write_audit('expense', p_expense_id, 'expense_voided',
    jsonb_build_object('amount_iqd', row_expense.amount_iqd, 'category', row_expense.category),
    jsonb_build_object('status', 'void'),
    nullif(btrim(p_reason), ''));
end;
$function$;

---------------------------------------------------------------------------
-- 7. set_budget
---------------------------------------------------------------------------
-- Upsert on (book, category, month). Passing 0 is how a budget is cleared —
-- deleting the row would lose the fact that someone deliberately set it.

create or replace function public.set_budget(
  p_company_id uuid,
  p_category text,
  p_month date,
  p_amount_iqd bigint
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  allowed text[];
  first_of_month date := date_trunc('month', coalesce(p_month, current_date))::date;
begin
  if p_company_id is null then
    if not is_admin() then raise exception 'admin only'; end if;
    allowed := platform_expense_categories();
  else
    if not can_access_company(p_company_id, 'finance') then
      raise exception 'not permitted for this company';
    end if;
    allowed := company_expense_categories();
  end if;

  if p_category is null or not (p_category = any(allowed)) then
    raise exception 'unsupported category %', coalesce(p_category, 'null');
  end if;
  if p_amount_iqd is null or p_amount_iqd < 0 then raise exception 'budget cannot be negative'; end if;

  insert into finance_budgets (company_id, category, month, amount_iqd, updated_by)
  values (p_company_id, p_category, first_of_month, p_amount_iqd, auth.uid())
  on conflict (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), category, month)
  do update set amount_iqd = excluded.amount_iqd,
                updated_by = excluded.updated_by,
                updated_at = now();
end;
$function$;

---------------------------------------------------------------------------
-- 8. Grants
---------------------------------------------------------------------------
-- Same shape as the settlement RPCs: nothing for anon, execute for
-- authenticated, and the function body decides what that account may do.

-- The receipt helpers are internal. Left reachable, /rpc/next_receipt_no would
-- let any signed-in account burn sequence numbers and put gaps in a sequence
-- whose entire value is that it has none. Triggers run as the table owner, so
-- revoking EXECUTE does not stop them firing.
revoke all on function public.next_receipt_no() from public, anon, authenticated;
revoke all on function public.issue_payout_receipt() from public, anon, authenticated;
revoke all on function public.issue_collection_receipt() from public, anon, authenticated;

revoke all on function public.record_expense(uuid, uuid, text, bigint, date, text, text, text, text, text, numeric, numeric) from public, anon;
revoke all on function public.update_expense(uuid, uuid, text, bigint, date, text, text, text, text) from public, anon;
revoke all on function public.void_expense(uuid, text) from public, anon;
revoke all on function public.set_budget(uuid, text, date, bigint) from public, anon;

grant execute on function public.record_expense(uuid, uuid, text, bigint, date, text, text, text, text, text, numeric, numeric) to authenticated;
grant execute on function public.update_expense(uuid, uuid, text, bigint, date, text, text, text, text) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;
grant execute on function public.set_budget(uuid, text, date, bigint) to authenticated;
grant execute on function public.platform_expense_categories() to authenticated;
grant execute on function public.company_expense_categories() to authenticated;

grant select on public.expenses to authenticated;
grant select on public.finance_budgets to authenticated;
grant select on public.finance_receipts to authenticated;

---------------------------------------------------------------------------
-- 9. Realtime
---------------------------------------------------------------------------
-- The dashboard refetches on any change to a table it watches, the same way it
-- already reacts to agency_ledger and payouts, so an expense filed by a
-- colleague appears without a reload.

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'expenses') then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'finance_budgets') then
    alter publication supabase_realtime add table public.finance_budgets;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'finance_receipts') then
    alter publication supabase_realtime add table public.finance_receipts;
  end if;
end $$;

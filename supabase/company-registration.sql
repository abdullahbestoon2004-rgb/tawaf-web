-- Tawaf — company self-registration + admin approval
-- Run this in the Supabase SQL editor (project: wvgrdmzezwdwcyicwgev).
-- Safe to run more than once.
--
-- Context: `authenticated` was missing INSERT/UPDATE on public.companies, which is
-- what produced "permission denied for table companies" on the company profile
-- save. That privilege is checked before RLS, so no policy could ever allow it.

begin;

-- ---------------------------------------------------------------------------
-- 1. Restore the missing privileges.
--    Row access stays gated by the existing policies:
--      UPDATE  using  ((owner_id = auth.uid()) OR is_admin())
--      INSERT  with check (owner_id = auth.uid())
-- ---------------------------------------------------------------------------
grant insert, update on public.companies to authenticated;

-- profiles has the same drift: authenticated cannot update its own row.
grant update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Close the INSERT-side privilege escalation.
--
--    protect_company_admin_fields() only runs BEFORE UPDATE. With INSERT now
--    granted, a registering user could otherwise POST a row with
--    is_verified = true / verification_status = 'approved' and be published to
--    the marketplace as a verified agency without any admin review, because the
--    INSERT policy only checks owner_id.
--
--    This forces every self-registered company to start unverified and pending.
-- ---------------------------------------------------------------------------
create or replace function public.force_company_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('app.system_update', true), '') = 'on' then
    return new;                       -- trusted trigger/function insert
  end if;

  if not is_admin() then
    new.is_verified   := false;
    new.is_active     := true;
    new.is_promoted   := false;
    new.rating        := 0;
    new.reviews       := 0;
    new.pilgrims_served := 0;
    new.first_offer_approved := false;
    new.reviewed_at   := null;
    new.reviewed_by   := null;
    new.owner_id      := auth.uid();

    -- Applications may only enter the queue as 'pending'.
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'pending';
    end if;
    new.status := 'pending';
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;

  return new;
end; $$;

drop trigger if exists before_company_insert on public.companies;
create trigger before_company_insert
  before insert on public.companies
  for each row execute function public.force_company_insert_defaults();

-- ---------------------------------------------------------------------------
-- 3. anon must not be able to write.
--    RLS blocks it today (auth.uid() is null for anon, so every policy fails),
--    but the table-level grant should not be there at all — it is one loosened
--    policy away from becoming a real hole.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.companies from anon;
revoke insert, update, delete, truncate on public.profiles  from anon;

-- ---------------------------------------------------------------------------
-- 4. Fix admin approval leaving `status` behind.
--
--    review_company_application() sets verification_status / is_verified /
--    is_active but never `status`, so a company approved through the admin UI
--    stays on status = 'pending'. The admin dashboard counts active companies
--    with status = 'active', so approved companies never appear in that metric.
--    (Visible in the data: the only company ever approved via the RPC is the
--    only one with verification_status='approved' AND status='pending'.)
--
--    Only the `status` line is added; everything else is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.review_company_application(
  p_company_id uuid, p_decision text, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare old_row companies%rowtype;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_decision not in ('approved','needs_changes','rejected','suspended') then
    raise exception 'invalid company decision';
  end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason), '') is null then
    raise exception 'a reason is required';
  end if;
  select * into old_row from companies where id = p_company_id for update;
  if old_row.id is null then raise exception 'company not found'; end if;

  update companies set
    verification_status = p_decision,
    verification_reason = nullif(btrim(p_reason), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    is_verified = (p_decision = 'approved'),
    is_active   = (p_decision <> 'suspended'),
    status      = case p_decision
                    when 'approved'      then 'active'
                    when 'suspended'     then 'suspended'
                    when 'rejected'      then 'rejected'
                    else 'pending'          -- needs_changes
                  end
  where id = p_company_id;

  perform write_audit('company', p_company_id, 'reviewed',
    jsonb_build_object('status', old_row.verification_status),
    jsonb_build_object('status', p_decision), p_reason);
  insert into notifications(user_id, type, arg)
  values (old_row.owner_id, 'companyReview', p_decision);
end; $$;

-- Backfill companies already approved through the UI but left on the wrong status.
update public.companies
   set status = 'active'
 where verification_status = 'approved'
   and is_active
   and status <> 'active';

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- select grantee, string_agg(privilege_type, ', ' order by privilege_type)
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'companies'
-- group by grantee order by grantee;

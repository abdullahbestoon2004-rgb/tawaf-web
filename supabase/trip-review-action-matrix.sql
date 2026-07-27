-- Tawaf — trip review and company action matrix
--
-- New company trips move draft -> pending_review -> published/draft/rejected.
-- Requesting changes is intentionally different from rejecting: it returns the
-- trip to draft with an optional note, while rejection records a mandatory,
-- dedicated rejection_reason. Every submission creates an admin notification.

alter table public.packages
  add column if not exists rejection_reason text;

alter table public.packages
  drop constraint if exists packages_lifecycle_status_check;

alter table public.packages
  add constraint packages_lifecycle_status_check
  check (
    lifecycle_status = any (
      array[
        'draft'::text,
        'pending_review'::text,
        'needs_changes'::text,
        'published'::text,
        'paused'::text,
        'sold_out'::text,
        'completed'::text,
        'archived'::text,
        'expired'::text,
        'rejected'::text,
        'removed'::text
      ]
    )
  );

create or replace function public.submit_package(p_package_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  package_row packages%rowtype;
  company_ok boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in required';
  end if;

  select *
    into package_row
    from packages
   where id = p_package_id
   for update;

  if package_row.id is null or not (select owns_company(package_row.company_id)) then
    raise exception 'not your package';
  end if;

  select status = 'active' and is_active and is_verified
    into company_ok
    from companies
   where id = package_row.company_id;

  if not coalesce(company_ok, false) then
    raise exception 'company is not active';
  end if;

  if package_row.lifecycle_status not in ('draft', 'needs_changes', 'rejected', 'paused') then
    raise exception 'package cannot be submitted from %', package_row.lifecycle_status;
  end if;

  perform assert_offer_complete(package_row.id);

  update packages
     set lifecycle_status = 'pending_review',
         is_published = false,
         review_reason = null,
         rejection_reason = null,
         submitted_at = now()
   where id = package_row.id;

  perform write_audit(
    'package',
    package_row.id,
    'submitted',
    jsonb_build_object('status', package_row.lifecycle_status),
    jsonb_build_object('status', 'pending_review', 'version', package_row.content_version),
    null
  );

  insert into notifications(user_id, type, arg)
  select profile.id, 'packageSubmitted', package_row.title
    from profiles profile
   where profile.role = 'admin';
end;
$function$;

create or replace function public.withdraw_package(p_package_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  package_row packages%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in required';
  end if;

  select *
    into package_row
    from packages
   where id = p_package_id
   for update;

  if package_row.id is null or not (select owns_company(package_row.company_id)) then
    raise exception 'not your package';
  end if;

  if package_row.lifecycle_status <> 'pending_review' then
    raise exception 'only a pending trip can be withdrawn';
  end if;

  update packages
     set lifecycle_status = 'draft',
         is_published = false,
         submitted_at = null,
         review_reason = null,
         rejection_reason = null
   where id = package_row.id;

  perform write_audit(
    'package',
    package_row.id,
    'submission_withdrawn',
    jsonb_build_object('status', 'pending_review'),
    jsonb_build_object('status', 'draft'),
    null
  );
end;
$function$;

create or replace function public.review_package(
  p_package_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  old_row packages%rowtype;
  next_status text;
  clean_reason text := nullif(btrim(p_reason), '');
begin
  if not (select is_admin()) then
    raise exception 'admin only';
  end if;

  if p_decision not in ('published', 'needs_changes', 'rejected') then
    raise exception 'invalid package decision';
  end if;

  if p_decision = 'rejected' and clean_reason is null then
    raise exception 'a rejection reason is required';
  end if;

  select *
    into old_row
    from packages
   where id = p_package_id
   for update;

  if old_row.id is null then
    raise exception 'package not found';
  end if;

  if old_row.lifecycle_status <> 'pending_review' then
    raise exception 'only a pending trip can be reviewed';
  end if;

  next_status := case
    when p_decision = 'published' then 'published'
    when p_decision = 'rejected' then 'rejected'
    else 'draft'
  end;

  update packages
     set lifecycle_status = next_status,
         is_published = (next_status = 'published'),
         review_reason = case when p_decision = 'needs_changes' then clean_reason else null end,
         rejection_reason = case when p_decision = 'rejected' then clean_reason else null end,
         reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_package_id;

  perform write_audit(
    'package',
    p_package_id,
    'reviewed',
    jsonb_build_object('status', old_row.lifecycle_status),
    jsonb_build_object('status', next_status, 'decision', p_decision),
    clean_reason
  );

  perform notify_company_owner(
    old_row.company_id,
    'packageReview',
    coalesce(clean_reason, p_decision),
    null
  );
end;
$function$;

create or replace function public.protect_package_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (select is_admin()) then
    return old;
  end if;

  if (select owns_company(old.company_id))
     and old.lifecycle_status in ('draft', 'needs_changes', 'rejected')
     and not exists (
       select 1
         from bookings
        where package_id = old.id
     ) then
    return old;
  end if;

  raise exception 'only a booking-free draft or rejected trip can be deleted';
end;
$function$;

revoke all on function public.submit_package(uuid) from public, anon;
revoke all on function public.withdraw_package(uuid) from public, anon;
revoke all on function public.review_package(uuid, text, text) from public, anon;

grant execute on function public.submit_package(uuid) to authenticated;
grant execute on function public.withdraw_package(uuid) to authenticated;
grant execute on function public.review_package(uuid, text, text) to authenticated;

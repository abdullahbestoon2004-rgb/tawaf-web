-- Sold-out trips may adjust total capacity without opening general live-trip
-- editing. The RPC is the only path that raises capacity and can put the trip
-- back on sale when seats become available.

create or replace function public.protect_reviewed_trip_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  old_content jsonb;
  new_content jsonb;
  ignored_fields text[] := array[
    'lifecycle_status',
    'is_published',
    'review_reason',
    'rejection_reason',
    'submitted_at',
    'reviewed_at',
    'reviewed_by',
    'force_unpublish_reason',
    'content_version',
    'updated_at',
    'seats_reserved',
    'is_featured',
    'commission_rate'
  ];
begin
  if (select is_admin()) then
    return new;
  end if;

  if current_setting('tawaf.capacity_adjustment', true) = 'on'
     and old.lifecycle_status in ('published', 'sold_out')
     and old.capacity is distinct from new.capacity then
    return new;
  end if;

  if old.lifecycle_status in (
    'pending_review',
    'published',
    'paused',
    'sold_out',
    'completed',
    'archived',
    'expired',
    'removed'
  ) then
    old_content := to_jsonb(old) - ignored_fields;
    new_content := to_jsonb(new) - ignored_fields;
    if old_content is distinct from new_content
       or new.lifecycle_status in ('paused', 'removed') then
      raise exception 'reviewed trip changes require admin approval';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.adjust_package_capacity(
  p_package_id uuid,
  p_capacity integer
)
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

  if package_row.lifecycle_status not in ('published', 'sold_out') then
    raise exception 'capacity can only be adjusted for a live or sold-out trip';
  end if;

  if p_capacity <= package_row.seats_reserved then
    raise exception 'capacity must be greater than reserved seats (%)', package_row.seats_reserved;
  end if;

  perform set_config('tawaf.capacity_adjustment', 'on', true);

  update packages
     set capacity = p_capacity
   where id = package_row.id;

  perform write_audit(
    'package',
    package_row.id,
    'capacity_adjusted',
    jsonb_build_object('capacity', package_row.capacity, 'status', package_row.lifecycle_status),
    jsonb_build_object('capacity', p_capacity),
    null
  );
end;
$function$;

revoke all on function public.adjust_package_capacity(uuid, integer) from public, anon;
grant execute on function public.adjust_package_capacity(uuid, integer) to authenticated;

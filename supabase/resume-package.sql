-- Symmetric counterpart to pause_package: lets a company put a paused trip
-- straight back on sale without re-entering the admin review queue, since
-- pausing itself never required review either.
create or replace function public.resume_package(p_package_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare p packages%rowtype;
begin
  select * into p from packages where id = p_package_id for update;
  if p.id is null or not (owns_company(p.company_id) or is_admin()) then
    raise exception 'not your package';
  end if;
  if p.lifecycle_status <> 'paused' then
    raise exception 'package cannot be resumed from %', p.lifecycle_status;
  end if;

  update packages
     set lifecycle_status = 'published',
         is_published = true,
         review_reason = null
   where id = p.id;

  perform write_audit('package', p.id, 'resumed',
    jsonb_build_object('status', 'paused'),
    jsonb_build_object('status', 'published'), null);
end;
$function$;

revoke all on function public.resume_package(uuid) from public, anon;
grant execute on function public.resume_package(uuid) to authenticated;

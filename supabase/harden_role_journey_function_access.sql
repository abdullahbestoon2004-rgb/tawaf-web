-- Tawaf — keep internal workflow functions outside client role journeys
-- Applied to project wvgrdmzezwdwcyicwgev as migration
-- `harden_role_journey_function_access`.
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Trigger
-- functions and scheduled booking maintenance are internal implementation
-- details: the Flutter client, company workspace, and admin dashboard should
-- reach them only through their tables, approved RPCs, or scheduled jobs.

-- The admin broadcast RPC performs its own is_admin() check, but anonymous
-- callers should not be able to invoke it at all.
revoke execute on function public.admin_broadcast_notification(text, text)
  from public, anon;

-- These are invoked by trusted scheduled jobs. They are not user-facing RPCs.
revoke execute on function public.auto_start_departed_bookings()
  from public, anon, authenticated;
revoke execute on function public.auto_complete_returned_bookings()
  from public, anon, authenticated;
grant execute on function public.auto_start_departed_bookings()
  to service_role;
grant execute on function public.auto_complete_returned_bookings()
  to service_role;

-- Trigger functions execute through their triggers and do not need direct
-- EXECUTE privileges for API roles. Revoke every current trigger function so
-- future role simulation cannot call workflow internals directly.
do $$
declare trigger_function regprocedure;
begin
  for trigger_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prorettype = 'trigger'::regtype
  loop
    execute 'revoke execute on function ' || trigger_function
      || ' from public, anon, authenticated';
  end loop;
end;
$$;

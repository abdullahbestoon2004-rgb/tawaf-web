-- Tawaf — platform announcements, and letting a company open a conversation.
-- Applied to project wvgrdmzezwdwcyicwgev as migrations:
--   admin_broadcast_and_company_initiated_inquiries
--   fix_broadcast_audience_role_mapping
--   fix_broadcast_audit_entity_id
--
---------------------------------------------------------------------------
-- 1. Admin broadcast
---------------------------------------------------------------------------
-- Writes ONE notification row per recipient rather than a shared "announcement"
-- row, so every existing surface works unchanged: the app's notification list,
-- the unread badge, the realtime subscriptions and the local/desktop banners all
-- key on notifications.user_id.
--
-- Two things worth knowing:
--   * The public vocabulary is client / companies / admin, but the user_role
--     enum in this database is client / agency / admin. The audience keyword is
--     mapped onto the enum rather than renaming it, which would touch every
--     policy and both codebases. 'agency' is accepted as a synonym.
--   * audit_logs.entity_id is NOT NULL, so a platform-wide action still needs a
--     subject; the acting admin is used, which reads as "this admin broadcast to
--     the platform". Audience and recipient count live in new_state.
--
-- CROSS-REPO IMPACT (Flutter app)
--   Emits a NEW notification type: 'announcement', where `arg` is the message
--   body itself rather than a trip title. The app's NotificationType enum has
--   been extended to match; older builds fall back to `promo` via the enum's
--   orElse, so they degrade safely instead of crashing.
create or replace function public.admin_broadcast_notification(
  p_message text,
  p_audience text default 'all'
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare sent int;
declare target user_role;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if nullif(btrim(p_message), '') is null then
    raise exception 'a message is required';
  end if;
  if p_audience not in ('all','client','companies','agency','admin') then
    raise exception 'invalid audience';
  end if;

  target := case p_audience
    when 'client' then 'client'::user_role
    when 'companies' then 'agency'::user_role
    when 'agency' then 'agency'::user_role
    when 'admin' then 'admin'::user_role
    else null
  end;

  insert into notifications (user_id, type, arg)
  select p.id, 'announcement', btrim(p_message)
    from profiles p
   where target is null or p.role = target;

  get diagnostics sent = row_count;

  perform write_audit('platform', auth.uid(), 'announcement_sent', null,
    jsonb_build_object('audience', p_audience, 'recipients', sent),
    btrim(p_message));

  return sent;
end;
$function$;

---------------------------------------------------------------------------
-- 2. A company may open a conversation with its own client
---------------------------------------------------------------------------
-- Until now only a client could create an inquiry ("client starts inquiry"), so
-- an agency could reply but never reach out. An agency may now start one, but
-- ONLY with a client who actually holds a booking with that company, so the
-- table cannot become an outbound marketing channel.
--
-- ROLE REVIEW
--   client    — unchanged; still starts inquiries freely.
--   companies — may now insert, restricted to their own booked clients.
--               owns_company() means a head office can also open a conversation
--               on behalf of any of its branches.
--   admin     — unchanged (reads everything; broadcasts via the RPC above).
drop policy if exists "company starts inquiry with own client" on public.inquiries;
create policy "company starts inquiry with own client" on public.inquiries
for insert to authenticated
with check (
  owns_company(agency_id)
  and exists (
    select 1 from bookings b
    where b.company_id = inquiries.agency_id
      and b.client_id = inquiries.client_id
  )
);

---------------------------------------------------------------------------
-- STILL MISSING (client side of messaging)
---------------------------------------------------------------------------
-- The Flutter app has messaging UI for the AGENCY only
-- (lib/screens/agency/agency_messages_tab.dart) and the service layer exposes
-- fetchAgencyInquiries()/sendInquiryReply() but no fetchClientInquiries() or
-- startInquiry(). Until a client-side screen exists, pilgrims cannot open a
-- conversation from the app — the policies above are ready for it.

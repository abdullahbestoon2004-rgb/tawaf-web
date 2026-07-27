-- Tawaf — notification fan-out across branches, and the device-token store.
-- Applied to project wvgrdmzezwdwcyicwgev as migration
--   device_tokens_and_branch_notification_fanout
--
---------------------------------------------------------------------------
-- 1. Branch/staff fan-out
---------------------------------------------------------------------------
-- BUG
--   notify_company_owner() notified exactly one person: companies.owner_id of
--   that single company. A head office that owns branches therefore heard
--   nothing about anything happening in them, and agency staff heard nothing
--   at all.
--
-- FIX
--   Fan out to the branch's own owner, the head office owner, and staff holding
--   'manage_all'. DISTINCT collapses duplicates when one account fills several
--   of those roles (e.g. the group owner also owns the branch).
--
-- ROLE REVIEW
--   client    — unaffected (client notifications come from other triggers).
--   companies — a group owner now receives every branch's events; staff with
--               full authority are included. Staff without 'manage_all' are
--               deliberately NOT notified, to avoid spamming a documents clerk
--               with finance events.
--   admin     — unaffected.
create or replace function public.notify_company_owner(
  p_company_id uuid, p_type text, p_arg text, p_booking_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into notifications(user_id, type, arg, booking_id)
  select distinct recipients.uid, p_type, p_arg, p_booking_id
  from (
    select c.owner_id as uid from companies c where c.id = p_company_id
    union
    select p.owner_id
      from companies c
      join companies p on p.id = c.parent_company_id
     where c.id = p_company_id
    union
    select s.user_id
      from agency_staff s
     where s.company_id = p_company_id
       and s.status = 'active'
       and 'manage_all' = any(s.permissions)
  ) recipients
  where recipients.uid is not null;
end;
$function$;

-- Internal helper only: booking/package triggers call it. Leaving a
-- SECURITY DEFINER helper executable by PUBLIC would let a client manufacture
-- notifications for arbitrary companies.
revoke execute on function public.notify_company_owner(uuid, text, text, uuid)
  from public, anon, authenticated;

---------------------------------------------------------------------------
-- 2. Device token store
---------------------------------------------------------------------------
-- The Flutter app already calls register_device_token / unregister_device_token
-- and PushService.platformName already returns 'ios' | 'android' | 'web', but
-- neither the table nor the RPCs existed, so every registration silently failed
-- (the app swallows that error by design). 'web' is included so the dashboard
-- can register a browser push subscription against the same table.
--
-- NOTE: this is the STORAGE layer only. Actually delivering an OS-level push
-- still requires a sender with provider credentials — see the checklist at the
-- bottom of this file.
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  lang text not null default 'en' check (lang in ('en','ar','ku')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- A device token is personal: you may only see or remove your own. Nothing here
-- grants read access to anyone else's, so the sender must run with elevated
-- privileges (a Secret API Key inside an Edge Function) and never from a client.
drop policy if exists "own device tokens" on public.device_tokens;
create policy "own device tokens" on public.device_tokens
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Re-registering the same token (reinstall, token refresh, account switch) must
-- move it to the current user rather than fail on the unique constraint.
create or replace function public.register_device_token(
  p_token text,
  p_platform text,
  p_lang text default 'en'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'sign-in required'; end if;
  if nullif(btrim(p_token), '') is null then raise exception 'a device token is required'; end if;
  if length(p_token) > 4096 then raise exception 'device token is too long'; end if;
  if p_platform not in ('ios','android','web') then raise exception 'unsupported platform'; end if;

  insert into device_tokens(user_id, token, platform, lang)
  values (
    auth.uid(),
    btrim(p_token),
    p_platform,
    case when p_lang in ('en','ar','ku') then p_lang else 'en' end
  )
  on conflict (token) do update
     set user_id = auth.uid(),
         platform = excluded.platform,
         lang = excluded.lang,
         last_seen_at = now();
end;
$function$;

revoke execute on function public.register_device_token(text, text, text)
  from public, anon;
grant execute on function public.register_device_token(text, text, text)
  to authenticated;

create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  delete from device_tokens
   where token = btrim(p_token) and user_id = auth.uid();
end;
$function$;

revoke execute on function public.unregister_device_token(text)
  from public, anon;
grant execute on function public.unregister_device_token(text)
  to authenticated;

---------------------------------------------------------------------------
-- REMAINING WORK for real OS-level push (needs credentials we do not have)
---------------------------------------------------------------------------
--  a) Mobile: create a Firebase project, add google-services.json /
--     GoogleService-Info.plist to the Flutter app. The Firebase messaging and
--     local-notification implementations are already present in that repo.
--  b) Web: generate a VAPID keypair, add a service worker to the dashboard and
--     register the PushSubscription through register_device_token(..., 'web').
--  c) Mobile sender: the app repo's send-push Edge Function is deployed. Set
--     its FCM_SERVICE_ACCOUNT secret, then configure the Secret API Key Vault
--     entry documented in push-delivery.sql.
--  d) Web Push remains separate because browser subscriptions require VAPID.

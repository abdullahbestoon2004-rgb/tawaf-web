-- Tawaf — OS-level push delivery.
--
-- Applied to project wvgrdmzezwdwcyicwgev as the
-- real_push_notifications + secure_push_with_secret_key migrations.
--
-- This is step (c) of the checklist at the bottom of
-- notifications-branches-and-device-tokens.sql: the sender. Everything before
-- it — the notifications table, the branch fan-out, device_tokens and its RPCs
-- — is already live. What was missing is anything that actually posts to a push
-- provider, which is why a pilgrim whose app was closed learned nothing until
-- they reopened it.
--
-- CROSS-SURFACE IMPACT
--   Flutter app  — register_device_token() gains a third argument. The app in
--                  ~/Desktop/projects/umrah has been updated to pass it in the
--                  same change; an older installed build still works, because
--                  p_lang defaults to 'en'.
--   dashboard    — no dashboard code calls these RPCs today. When web push is
--                  added it should call register_device_token(token, 'web',
--                  lang) so browser notifications get the same treatment.
--   admin/client — the trigger fires for every notifications row regardless of
--                  which role owns it, so companies and admins receive their own
--                  events on their own devices. No RLS is relaxed: device_tokens
--                  is still readable only by its owner, and the sender reads it
--                  with a modern Secret API Key inside the Edge Function.
--
-- ORDER OF OPERATIONS — the trigger is inert until a secret API key named
-- `push_edge_secret_key` exists in Supabase Vault, so running this file alone
-- changes no delivery behaviour. Deploy the Edge Function and set
-- FCM_SERVICE_ACCOUNT first, then store that key in Vault.

---------------------------------------------------------------------------
-- 1. Per-device language
---------------------------------------------------------------------------
-- The sender runs in an Edge Function with no session and no BuildContext, so
-- it cannot ask the app what language to write in. Language is a device
-- setting in the app (shared_preferences, not the profile), so it belongs on
-- the device row: one account signed in on two handsets can legitimately want
-- Kurdish on one and Arabic on the other.
alter table public.device_tokens
  add column if not exists lang text not null default 'en'
    check (lang in ('en', 'ar', 'ku'));

---------------------------------------------------------------------------
-- 2. register_device_token gains the language
---------------------------------------------------------------------------
-- Dropped and recreated rather than overloaded: leaving the two-argument
-- version in place would make register_device_token(text, text) ambiguous for
-- PostgREST once a default is added. p_lang defaults to 'en', so an older
-- installed app that still sends two arguments keeps working.
drop function if exists public.register_device_token(text, text);

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
    -- An unknown locale is downgraded rather than rejected: a wrong-language
    -- notification is far better than no notification.
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
grant execute on function public.register_device_token(text, text, text) to authenticated;

---------------------------------------------------------------------------
-- 3. Fan out new notifications to the send-push Edge Function
---------------------------------------------------------------------------
-- pg_net posts asynchronously, so a slow or failing FCM call cannot stall (or
-- roll back) the transaction that inserted the notification. That matters:
-- confirming a booking must not fail because Google is having a bad day.
create extension if not exists pg_net with schema extensions;

-- Create a dedicated modern Secret API Key (sb_secret_...) in Supabase
-- Settings → API Keys, then store it without committing it or putting it in a
-- plaintext function definition:
--   select vault.create_secret(
--     '<sb_secret_...>',
--     'push_edge_secret_key',
--     'Authorizes notification trigger calls to send-push'
--   );
create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  secret_key text;
begin
  select decrypted_secret
    into secret_key
    from vault.decrypted_secrets
   where name = 'push_edge_secret_key';

  -- Unconfigured environments simply skip delivery; the in-app notification
  -- row is written either way, so nothing is lost.
  if nullif(secret_key, '') is null then
    return new;
  end if;

  perform extensions.net.http_post(
    url := 'https://wvgrdmzezwdwcyicwgev.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret_key
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'type', new.type,
      'arg', new.arg,
      'booking_id', new.booking_id,
      'notification_id', new.id
    ),
    -- A cold Edge Function may need to mint a Google OAuth token before it can
    -- call FCM. pg_net's two-second default is too short for that first send.
    timeout_milliseconds := 15000
  );
  return new;
end;
$function$;

revoke execute on function public.notify_push_on_notification()
  from public, anon, authenticated;

drop trigger if exists push_on_notification on public.notifications;
create trigger push_on_notification
  after insert on public.notifications
  for each row execute function public.notify_push_on_notification();

---------------------------------------------------------------------------
-- REMAINING WORK — needs credentials, not SQL
---------------------------------------------------------------------------
--  a) Create the Firebase project and add the Android + iOS apps
--     (com.umrah.umrah_app / com.umrah.umrahApp). Drop google-services.json
--     into android/app/ and GoogleService-Info.plist into ios/Runner/.
--  b) Upload an APNs auth key (.p8) from the Apple Developer portal to
--     Firebase → Project settings → Cloud Messaging, and enable the Push
--     Notifications capability on the App ID.
--  c) The send-push function is deployed. Set its Firebase credential:
--     supabase secrets set FCM_SERVICE_ACCOUNT='<service-account JSON>'
--  d) Create the modern Supabase Secret API Key and Vault entry documented in
--     section 3. Until then this trigger is a no-op and push stays off.
--  e) Web push for the dashboard is still open: generate a VAPID keypair, add
--     a service worker, and register the subscription through
--     register_device_token(<endpoint>, 'web', <lang>).

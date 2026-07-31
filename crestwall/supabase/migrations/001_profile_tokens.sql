-- One-time tokens for profile downloads.
--
-- Why this exists: a configuration profile can only be installed from real
-- Safari, not from the app's webview. But Safari has none of the user's auth
-- state — so we cannot protect the download with a normal Supabase JWT.
-- Instead the authenticated app mints a short-lived single-use token, then
-- hands Safari a URL carrying it.

create table if not exists profile_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  pack_id    uuid not null references icon_packs on delete cascade,
  labels     text[],                  -- null = every icon in the pack
  expires_at timestamptz not null,
  used_at    timestamptz,             -- set on first successful download
  created_at timestamptz not null default now()
);

create index if not exists profile_tokens_expiry_idx on profile_tokens (expires_at);

alter table profile_tokens enable row level security;

-- Users may create their own tokens; nobody reads them via PostgREST.
-- The Edge Function redeems them with the service-role key, bypassing RLS.
create policy "own tokens insert" on profile_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

-- Housekeeping: drop expired rows. Schedule via pg_cron if available.
create or replace function prune_profile_tokens() returns void
language sql as $$
  delete from profile_tokens where expires_at < now() - interval '1 day';
$$;

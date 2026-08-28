-- Eclipse Order forum schema for Supabase
-- Run this file in Supabase SQL Editor.
-- User passwords must be managed by Supabase Auth, never stored here.

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.thread_category as enum ('bugs', 'reportes', 'historias', 'facciones', 'normativa');
create type public.thread_status as enum ('abierto', 'cerrado', 'en_revision');
create type public.thread_subforum as enum ('formato', 'no_oficial', 'oficial');
create type public.attachment_type as enum ('image', 'video');

insert into storage.buckets (id, name, public)
values ('forum-attachments', 'forum-attachments', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(trim(username)) >= 3),
  role public.user_role not null default 'user',
  avatar text not null default '',
  avatar_url text,
  bio text,
  banner_url text,
  role_points integer not null default 0 check (role_points >= 0),
  redeemed_role_points integer not null default 0 check (redeemed_role_points >= 0),
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Migration for existing installations: preserve saved banners while renaming the field.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'banner_color'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'banner_url'
  ) then
    alter table public.profiles rename column banner_color to banner_url;
  end if;
end
$$;

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 5),
  category public.thread_category not null,
  subforum public.thread_subforum,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  status public.thread_status not null default 'abierto',
  pinned boolean not null default false,
  admin_only boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.threads
  add column if not exists edited_at timestamptz;

-- Migration for existing installations: add faction subforums after the base table exists.
do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace and typname = 'thread_subforum'
  ) then
    create type public.thread_subforum as enum ('formato', 'no_oficial', 'oficial');
  end if;
end
$$;

alter table public.threads
  add column if not exists subforum public.thread_subforum;

alter table public.threads
  add column if not exists faction_role_points integer not null default 0 check (faction_role_points >= 0),
  add column if not exists faction_role_points_claimed boolean not null default false;

update public.threads
set subforum = 'no_oficial'
where category = 'facciones' and subforum is null;

create table public.thread_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  name text not null,
  type public.attachment_type not null,
  data_url text,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint thread_attachment_source_check check (data_url is not null or storage_path is not null)
);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  is_staff boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz
);

alter table public.replies
  add column if not exists edited_at timestamptz;

create table public.reply_attachments (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.replies(id) on delete cascade,
  name text not null,
  type public.attachment_type not null,
  data_url text,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reply_attachment_source_check check (data_url is not null or storage_path is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.thread_views (
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (thread_id, user_id)
);

-- Public read-only presence reported by the dedicated Project Zomboid server.
create table public.server_status (
  id text primary key default 'main',
  online boolean not null default false,
  player_count integer not null default 0 check (player_count >= 0),
  peak_player_count integer not null default 0 check (peak_player_count >= 0),
  online_since timestamptz,
  checked_at timestamptz not null default timezone('utc', now())
);

alter table public.server_status
  add column if not exists peak_player_count integer not null default 0,
  add column if not exists online_since timestamptz;

create table public.server_players (
  username text primary key,
  last_seen timestamptz not null default timezone('utc', now())
);

create table public.player_playtime (
  username text primary key,
  total_seconds bigint not null default 0 check (total_seconds >= 0),
  last_seen timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.server_activity (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'system',
  title text not null,
  message text not null default '',
  username text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.server_status (id)
values ('main')
on conflict (id) do nothing;

drop index if exists public.replies_thread_created_idx;
drop index if exists public.thread_views_thread_idx;
drop function if exists public.get_thread_view_counts();
drop function if exists public.get_thread_reply_summaries();

create index if not exists threads_category_created_idx on public.threads(category, created_at desc);
create index if not exists threads_pinned_created_idx on public.threads(pinned desc, created_at desc);
create index if not exists threads_author_idx on public.threads(author_id);
create index if not exists profiles_joined_idx on public.profiles(joined_at);
create index if not exists replies_thread_created_desc_idx on public.replies(thread_id, created_at desc);
create index if not exists replies_author_idx on public.replies(author_id);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists thread_attachments_thread_idx on public.thread_attachments(thread_id);
create index if not exists reply_attachments_reply_idx on public.reply_attachments(reply_id);
create index if not exists server_activity_created_idx on public.server_activity(created_at desc);
create index if not exists player_playtime_total_seconds_idx on public.player_playtime(total_seconds desc);

create or replace function public.get_thread_view_counts(requested_thread_ids uuid[])
returns table(thread_id uuid, visitor_count bigint)
language sql
stable
security invoker
as $$
  select thread_id, count(*)
  from public.thread_views
  where thread_id = any(requested_thread_ids)
  group by thread_id;
$$;

create or replace function public.get_thread_reply_summaries(requested_thread_ids uuid[])
returns table(
  thread_id uuid,
  reply_count bigint,
  last_reply_id uuid,
  last_author_id uuid,
  last_created_at timestamptz
)
language sql
stable
security invoker
as $$
  with summaries as (
    select
      thread_id,
      count(*) as reply_count,
      (array_agg(id order by created_at desc))[1] as last_reply_id,
      (array_agg(author_id order by created_at desc))[1] as last_author_id,
      max(created_at) as last_created_at
    from public.replies
    where thread_id = any(requested_thread_ids)
    group by thread_id
  )
  select thread_id, reply_count, last_reply_id, last_author_id, last_created_at
  from summaries;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger threads_set_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'user'), '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'username', 'U'), 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.thread_attachments enable row level security;
alter table public.replies enable row level security;
alter table public.reply_attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.thread_views enable row level security;
alter table public.server_status enable row level security;
alter table public.server_players enable row level security;
alter table public.player_playtime enable row level security;

create policy "Server status is publicly readable"
on public.server_status for select
using (true);

create policy "Server players are publicly readable"
on public.server_players for select
using (true);

create policy "Player playtime is publicly readable"
on public.player_playtime for select
using (true);

create policy "Forum attachments are publicly readable"
on storage.objects for select
using (bucket_id = 'forum-attachments');

create policy "Authenticated users can upload forum attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'forum-attachments');

create policy "Authenticated users can read profile media"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-media');

create policy "Authenticated users can upload profile media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-media');

create policy "Profiles are publicly readable"
on public.profiles for select
using (true);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can update profiles"
on public.profiles for update
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Authenticated users can read threads"
on public.threads for select
using (auth.role() = 'authenticated');

create policy "Authenticated users can create threads"
on public.threads for insert
with check (auth.uid() = author_id);

create policy "Authors and staff can update threads"
on public.threads for update
using (
  auth.uid() = author_id
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

create policy "Authors and staff can delete threads"
on public.threads for delete
using (
  auth.uid() = author_id
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

-- Migration for existing installations: remove the old Project Zomboid account-linking data.
drop function if exists public.redeem_pz_link_code(text, text, text);
drop function if exists public.redeem_pz_link_code(text, text);
drop table if exists public.pz_link_codes cascade;
alter table public.profiles
  drop column if exists pz_username,
  drop column if exists pz_steam_id,
  drop column if exists pz_linked_at;
alter table public.server_status
  drop column if exists last_reminder_at;

create policy "Authenticated users can read replies"
on public.replies for select
using (auth.role() = 'authenticated');

create policy "Authenticated users can create replies"
on public.replies for insert
with check (auth.uid() = author_id);

create policy "Authors can delete replies"
on public.replies for delete
using (auth.uid() = author_id);

create policy "Authenticated users can read thread attachments"
on public.thread_attachments for select
using (auth.role() = 'authenticated');

create policy "Authors can create thread attachments"
on public.thread_attachments for insert
with check (exists (select 1 from public.threads where id = thread_id and author_id = auth.uid()));

create policy "Authenticated users can read reply attachments"
on public.reply_attachments for select
using (auth.role() = 'authenticated');

create policy "Authors can create reply attachments"
on public.reply_attachments for insert
with check (exists (select 1 from public.replies where id = reply_id and author_id = auth.uid()));

create policy "Users can read their notifications"
on public.notifications for select
using (auth.uid() = user_id);

create policy "Users can update their notifications"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Staff can create notifications" on public.notifications;

create policy "Staff can create notifications"
on public.notifications for insert
to authenticated
with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')));

create policy "Authenticated users can read thread views"
on public.thread_views for select
using (auth.role() = 'authenticated');

create policy "Users can register their own thread views"
on public.thread_views for insert
with check (auth.uid() = user_id);

-- Migration for existing installations: allow authors to delete their own threads.
drop policy if exists "Admins can delete threads" on public.threads;
drop policy if exists "Authors and staff can delete threads" on public.threads;

create policy "Authors and staff can delete threads"
on public.threads for delete
using (
  auth.uid() = author_id
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

-- Eclipse Order forum schema for Supabase
-- Run this file in Supabase SQL Editor.
-- User passwords must be managed by Supabase Auth, never stored here.

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.thread_category as enum ('bugs', 'reportes', 'historias', 'facciones', 'normativa');
create type public.thread_status as enum ('abierto', 'cerrado', 'en_revision');
create type public.attachment_type as enum ('image', 'video');

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
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  status public.thread_status not null default 'abierto',
  pinned boolean not null default false,
  admin_only boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  created_at timestamptz not null default timezone('utc', now())
);

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

create index threads_category_created_idx on public.threads(category, created_at desc);
create index threads_author_idx on public.threads(author_id);
create index replies_thread_created_idx on public.replies(thread_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index thread_attachments_thread_idx on public.thread_attachments(thread_id);
create index reply_attachments_reply_idx on public.reply_attachments(reply_id);

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

create policy "Admins can delete threads"
on public.threads for delete
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Authenticated users can read replies"
on public.replies for select
using (auth.role() = 'authenticated');

create policy "Authenticated users can create replies"
on public.replies for insert
with check (auth.uid() = author_id);

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

create policy "Staff can create notifications"
on public.notifications for insert
with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')));

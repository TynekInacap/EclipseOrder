create table if not exists public.thread_subscriptions (
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (thread_id, user_id)
);

alter table public.thread_subscriptions enable row level security;

drop policy if exists "Users can read their thread subscriptions" on public.thread_subscriptions;
drop policy if exists "Thread participants can read subscribers" on public.thread_subscriptions;
drop policy if exists "Users can subscribe to threads" on public.thread_subscriptions;
drop policy if exists "Users can unsubscribe from threads" on public.thread_subscriptions;

create policy "Users can read their thread subscriptions"
on public.thread_subscriptions for select
using (auth.uid() = user_id);

create policy "Thread participants can read subscribers"
on public.thread_subscriptions for select
using (
  exists (select 1 from public.threads where id = thread_id and author_id = auth.uid())
  or exists (select 1 from public.thread_subscriptions own_subscription where own_subscription.thread_id = thread_id and own_subscription.user_id = auth.uid())
);

create policy "Users can subscribe to threads"
on public.thread_subscriptions for insert
with check (auth.uid() = user_id);

create policy "Users can unsubscribe from threads"
on public.thread_subscriptions for delete
using (auth.uid() = user_id);

alter table public.notifications
  add column if not exists thread_id uuid references public.threads(id) on delete cascade;

drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Staff can create notifications" on public.notifications;
drop policy if exists "Users can create allowed thread notifications" on public.notifications;

create policy "Users can create allowed thread notifications"
on public.notifications for insert
to authenticated
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  or (
    thread_id is not null
    and (
      exists (select 1 from public.threads where id = thread_id and author_id = auth.uid())
      or exists (select 1 from public.thread_subscriptions where thread_id = notifications.thread_id and user_id = notifications.user_id)
    )
  )
);
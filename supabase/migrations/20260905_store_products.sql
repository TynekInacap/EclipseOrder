create table if not exists public.store_products (
  id text primary key,
  title text not null,
  price integer not null check (price > 0),
  description text not null,
  image_url text,
  kind text not null default 'personal' check (kind in ('personal', 'faccion')),
  created_at timestamptz not null default timezone('utc', now())
);

insert into storage.buckets (id, name, public)
values ('store-media', 'store-media', true)
on conflict (id) do update set public = true;

alter table public.store_products enable row level security;

drop policy if exists "Authenticated users can read store products" on public.store_products;
drop policy if exists "Admins can create store products" on public.store_products;

create policy "Authenticated users can read store products"
on public.store_products for select
using (auth.role() = 'authenticated');

create policy "Admins can create store products"
on public.store_products for insert
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Store media is publicly readable" on storage.objects;
drop policy if exists "Admins can upload store media" on storage.objects;

create policy "Store media is publicly readable"
on storage.objects for select
using (bucket_id = 'store-media');

create policy "Admins can upload store media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'store-media' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
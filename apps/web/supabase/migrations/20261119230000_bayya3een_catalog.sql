/*
 * Bayya3een | بياعين — Catalog foundation (BRD §14)
 * Categories + products (platform-owned or merchant-owned).
 * Merchant/affiliate/orders/commissions land in later migrations.
 */

create type public.product_owner_type as enum ('bayya3een', 'merchant');
create type public.product_status as enum (
  'draft',
  'under_review',
  'live',
  'rejected',
  'hidden'
);

create table if not exists public.categories (
  id text primary key,
  name_ar varchar(120) not null,
  name_en varchar(120),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text unique,
  name_ar varchar(255) not null,
  name_en varchar(255),
  brand varchar(120),
  description_ar text,
  category_id text not null references public.categories (id),
  owner_type public.product_owner_type not null default 'bayya3een',
  -- null for Bayya3een-owned products; merchant account id later
  merchant_account_id uuid references public.accounts (id),
  status public.product_status not null default 'draft',
  price_egp numeric(12, 2) not null check (price_egp >= 0),
  compare_at_price_egp numeric(12, 2),
  cost_egp numeric(12, 2),
  stock int not null default 0 check (stock >= 0),
  commission_rate numeric(5, 2),
  is_hidden boolean not null default false,
  rejection_reason text,
  rating numeric(3, 2) default 0,
  reviews_count int not null default 0,
  sold_count int not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  constraint products_compare_price_check check (
    compare_at_price_egp is null
    or compare_at_price_egp >= price_egp
  ),
  constraint products_bayya3een_cost_check check (
    owner_type <> 'bayya3een'
    or cost_egp is not null
  )
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_owner_type_idx on public.products (owner_type);
create index if not exists products_merchant_idx on public.products (merchant_account_id);

create table if not exists public.product_media (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  alt_ar varchar(255),
  created_at timestamptz not null default now()
);

create index if not exists product_media_product_idx
  on public.product_media (product_id, sort_order);

-- RLS
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;

-- Public catalog read (live + not hidden)
create policy categories_public_read
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (status = 'live' and is_hidden = false);

create policy product_media_public_read
  on public.product_media for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.status = 'live'
        and p.is_hidden = false
    )
  );

-- Authenticated staff can manage (tighten with roles later)
create policy categories_authenticated_write
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

create policy products_authenticated_write
  on public.products for all
  to authenticated
  using (true)
  with check (true);

create policy product_media_authenticated_write
  on public.product_media for all
  to authenticated
  using (true)
  with check (true);

-- MakerKit revokes public schema usage from anon; restore for catalog reads
grant usage on schema public to anon;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_media to anon, authenticated;
grant all on public.categories to authenticated, service_role;
grant all on public.products to authenticated, service_role;
grant all on public.product_media to authenticated, service_role;

-- Seed categories from prototype
insert into public.categories (id, name_ar, name_en, sort_order) values
  ('mobiles', 'موبايلات', 'Mobiles', 1),
  ('electronics', 'إلكترونيات', 'Electronics', 2),
  ('kitchen', 'مطبخ وبيت', 'Kitchen & Home', 3),
  ('women', 'أزياء حريمي', 'Women', 4),
  ('men', 'أزياء رجالي', 'Men', 5),
  ('beauty', 'جمال وعناية', 'Beauty', 6),
  ('market', 'سوبرماركت', 'Supermarket', 7),
  ('toys', 'ألعاب أطفال', 'Toys', 8)
on conflict (id) do nothing;

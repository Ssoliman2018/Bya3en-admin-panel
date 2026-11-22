/*
 * Bayya3een | بياعين — Merchants foundation (BRD §8 / §14)
 */

create type public.merchant_status as enum (
  'pending',
  'active',
  'suspended',
  'rejected'
);

create table if not exists public.merchants (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts (id),
  store_name varchar(180) not null,
  legal_name varchar(255),
  contact_name varchar(180),
  phone varchar(32),
  email varchar(320),
  city varchar(120),
  governorate varchar(120),
  category_id text references public.categories (id),
  marketplace_fee_pct numeric(5, 2) not null default 10
    check (marketplace_fee_pct >= 0 and marketplace_fee_pct <= 100),
  status public.merchant_status not null default 'pending',
  rejection_reason text,
  national_id_masked varchar(32),
  tax_id_masked varchar(32),
  cr_number varchar(64),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users
);

create index if not exists merchants_status_idx on public.merchants (status);
create index if not exists merchants_account_idx on public.merchants (account_id);

alter table public.merchants enable row level security;

create policy merchants_authenticated_all
  on public.merchants for all
  to authenticated
  using (true)
  with check (true);

grant all on public.merchants to authenticated, service_role;

-- Seed a few merchants matching the prototype vibe
insert into public.merchants (
  store_name, legal_name, contact_name, phone, email, city, governorate,
  category_id, marketplace_fee_pct, status
) values
  ('موبايل زون', 'موبايل زون للتجارة', 'محمد سمير', '01000000001', 'sales@mobilezone.eg', 'مدينة نصر', 'القاهرة', 'mobiles', 6, 'active'),
  ('تك زون', 'تك زون للإلكترونيات', 'شريف عادل', '01100000002', 'ops@techzone.eg', 'المهندسين', 'الجيزة', 'electronics', 8, 'active'),
  ('بيت المطبخ', 'بيت المطبخ للأدوات المنزلية', 'نادية فوزي', '01200000003', 'hello@beitmatbakh.eg', 'العبور', 'القليوبية', 'kitchen', 12, 'active'),
  ('سلمى ستايل', 'سلمى ستايل للملابس', 'سلمى حسن', '01000000004', 'salma.style@mail.eg', 'سموحة', 'الإسكندرية', 'women', 15, 'active'),
  ('أتيليه نور', 'نور للتجارة', 'نور محمد', '01500000005', 'nour@atelier.eg', 'المعادي', 'القاهرة', 'women', 15, 'pending');

/*
 * Bayya3een | بياعين — Affiliates foundation (BRD partners / ADM affiliates)
 */

create type public.affiliate_status as enum (
  'pending',
  'active',
  'suspended',
  'rejected'
);

create type public.affiliate_tier as enum ('starter', 'pro', 'elite');

create type public.withdrawal_status as enum (
  'pending',
  'withdrawn',
  'cancelled'
);

create type public.withdrawal_method as enum ('vf', 'ip', 'bank');

create table if not exists public.affiliates (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  name varchar(180) not null,
  phone_masked varchar(32),
  governorate varchar(120),
  status public.affiliate_status not null default 'pending',
  membership_tier public.affiliate_tier not null default 'starter',
  clicks_30d int not null default 0 check (clicks_30d >= 0),
  orders_count int not null default 0 check (orders_count >= 0),
  earnings_egp numeric(12, 2) not null default 0 check (earnings_egp >= 0),
  pending_egp numeric(12, 2) not null default 0 check (pending_egp >= 0),
  flags text[] not null default '{}',
  suspend_reason text,
  is_live_demo boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users
);

create index if not exists affiliates_status_idx on public.affiliates (status);
create index if not exists affiliates_code_idx on public.affiliates (code);

create table if not exists public.affiliate_withdrawals (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  amount_egp numeric(12, 2) not null check (amount_egp > 0),
  method public.withdrawal_method not null default 'vf',
  account_masked varchar(120),
  status public.withdrawal_status not null default 'pending',
  risk_flag boolean not null default false,
  rejection_reason text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_withdrawals_status_idx
  on public.affiliate_withdrawals (status);
create index if not exists affiliate_withdrawals_affiliate_idx
  on public.affiliate_withdrawals (affiliate_id);

alter table public.affiliates enable row level security;
alter table public.affiliate_withdrawals enable row level security;

create policy affiliates_authenticated_all
  on public.affiliates for all
  to authenticated
  using (true)
  with check (true);

create policy affiliate_withdrawals_authenticated_all
  on public.affiliate_withdrawals for all
  to authenticated
  using (true)
  with check (true);

grant all on public.affiliates to authenticated, service_role;
grant all on public.affiliate_withdrawals to authenticated, service_role;

-- Seed demo affiliates matching prototype
insert into public.affiliates (
  code, name, phone_masked, governorate, status, membership_tier,
  clicks_30d, orders_count, earnings_egp, pending_egp, flags,
  suspend_reason, is_live_demo, joined_at
) values
  (
    'AHMED24', 'أحمد محمود', '010 •••• 5482', 'القاهرة', 'active', 'pro',
    4200, 156, 28640, 1840, '{}', null, true,
    now() - interval '110 days'
  ),
  (
    'MONA_SHOP', 'منى عادل', '011 •••• 3301', 'الجيزة', 'active', 'elite',
    6120, 241, 48210, 3110, '{}', null, false,
    now() - interval '220 days'
  ),
  (
    'KARIM_DEALS', 'كريم السيد', '012 •••• 7720', 'الإسكندرية', 'active', 'pro',
    2890, 97, 15430, 1280, '{}', null, false,
    now() - interval '160 days'
  ),
  (
    'HEBA_STYLE', 'هبة محمود', '010 •••• 1189', 'الدقهلية', 'active', 'starter',
    1140, 38, 4120, 610, '{}', null, false,
    now() - interval '90 days'
  ),
  (
    'OMAR_TECH', 'عمر خالد', '015 •••• 6040', 'القاهرة', 'active', 'starter',
    860, 12, 1830, 0, '{}', null, false,
    now() - interval '75 days'
  ),
  (
    'FAST_CASH77', 'حساب سريع 77', '011 •••• 0077', 'الجيزة', 'active', 'starter',
    9410, 31, 2960, 2240,
    array[
      'ضغطات كتير جداً بتحويل ضعيف (0.3%)',
      '8 طلبات من نفس الجهاز',
      'طلبات على عنوان البيّاع نفسه'
    ],
    null, false,
    now() - interval '22 days'
  ),
  (
    'SARA_MOM', 'سارة ناصر', '012 •••• 4416', 'الشرقية', 'pending', 'starter',
    0, 0, 0, 0, '{}', null, false,
    now() - interval '1 day'
  ),
  (
    'YOUSSEF_K', 'يوسف كمال', '010 •••• 9150', 'أسيوط', 'pending', 'pro',
    0, 0, 0, 0,
    array['رقم الموبايل اتسجّل قبل كده بحساب تاني'],
    null, false,
    now() - interval '3 days'
  ),
  (
    'ALI_HAMDY', 'علي حمدي', '011 •••• 2290', 'الغربية', 'suspended', 'starter',
    3300, 5, 410, 0,
    array['شراء ذاتي متكرر من لينكاته'],
    'مخالفة قواعد البرنامج: شراء ذاتي', false,
    now() - interval '200 days'
  );

insert into public.affiliate_withdrawals (
  code, affiliate_id, amount_egp, method, account_masked,
  status, risk_flag, requested_at, paid_at
)
select
  v.code,
  a.id,
  v.amount_egp,
  v.method::public.withdrawal_method,
  v.account_masked,
  v.status::public.withdrawal_status,
  v.risk_flag,
  now() - v.age,
  case when v.status = 'withdrawn' then now() - v.age + interval '1 day' else null end
from (
  values
    ('WD-30441', 'MONA_SHOP', 3500::numeric, 'ip', 'mona@instapay', 'pending', false, interval '1 day'),
    ('WD-30447', 'KARIM_DEALS', 1200::numeric, 'vf', '012•••••720', 'pending', false, interval '0 day'),
    ('WD-30439', 'FAST_CASH77', 2240::numeric, 'vf', '011•••••077', 'pending', true, interval '2 days'),
    ('WD-30412', 'HEBA_STYLE', 600::numeric, 'bank', 'NBE · EG•• 4417', 'withdrawn', false, interval '6 days'),
    ('WD-30398', 'MONA_SHOP', 5200::numeric, 'ip', 'mona@instapay', 'withdrawn', false, interval '12 days'),
    ('WD-30501', 'AHMED24', 1500::numeric, 'vf', '010•••••482', 'pending', false, interval '5 hours')
) as v(code, aff_code, amount_egp, method, account_masked, status, risk_flag, age)
join public.affiliates a on a.code = v.aff_code
on conflict (code) do nothing;

/*
 * Bayya3een | بياعين — Commission engine (BRD affiliate rates / campaigns)
 */

create table if not exists public.commission_settings (
  id text primary key default 'default',
  default_rate numeric(5, 2) not null default 8
    check (default_rate >= 0 and default_rate <= 100),
  hold_days int not null default 14 check (hold_days >= 0),
  attr_days int not null default 7 check (attr_days >= 0),
  min_withdraw_egp numeric(12, 2) not null default 200
    check (min_withdraw_egp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.category_commission_rates (
  category_id text primary key references public.categories (id) on delete cascade,
  rate_pct numeric(5, 2) not null default 8
    check (rate_pct >= 0 and rate_pct <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_campaigns (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  name_ar varchar(180) not null,
  category_id text not null references public.categories (id),
  extra_rate_pct numeric(5, 2) not null default 1
    check (extra_rate_pct >= 0 and extra_rate_pct <= 100),
  starts_at date not null,
  ends_at date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create table if not exists public.commission_eligibility (
  key text primary key,
  label_ar text not null,
  is_enabled boolean not null default true,
  is_locked boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_change_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  what text not null,
  who varchar(120) not null default 'الإدارة',
  created_at timestamptz not null default now()
);

create index if not exists commission_campaigns_active_idx
  on public.commission_campaigns (is_active);
create index if not exists commission_change_log_created_idx
  on public.commission_change_log (created_at desc);

alter table public.commission_settings enable row level security;
alter table public.category_commission_rates enable row level security;
alter table public.commission_campaigns enable row level security;
alter table public.commission_eligibility enable row level security;
alter table public.commission_change_log enable row level security;

create policy commission_settings_authenticated_all
  on public.commission_settings for all to authenticated
  using (true) with check (true);
create policy category_commission_rates_authenticated_all
  on public.category_commission_rates for all to authenticated
  using (true) with check (true);
create policy commission_campaigns_authenticated_all
  on public.commission_campaigns for all to authenticated
  using (true) with check (true);
create policy commission_eligibility_authenticated_all
  on public.commission_eligibility for all to authenticated
  using (true) with check (true);
create policy commission_change_log_authenticated_all
  on public.commission_change_log for all to authenticated
  using (true) with check (true);

grant all on public.commission_settings to authenticated, service_role;
grant all on public.category_commission_rates to authenticated, service_role;
grant all on public.commission_campaigns to authenticated, service_role;
grant all on public.commission_eligibility to authenticated, service_role;
grant all on public.commission_change_log to authenticated, service_role;

insert into public.commission_settings (
  id, default_rate, hold_days, attr_days, min_withdraw_egp
) values ('default', 8, 14, 7, 200)
on conflict (id) do nothing;

insert into public.category_commission_rates (category_id, rate_pct) values
  ('mobiles', 3),
  ('electronics', 8),
  ('kitchen', 8),
  ('women', 15),
  ('men', 12),
  ('beauty', 15),
  ('market', 5),
  ('toys', 12)
on conflict (category_id) do nothing;

insert into public.commission_eligibility (key, label_ar, is_enabled, is_locked, sort_order) values
  ('self', 'استبعاد الشراء الذاتي (البيّاع بيشتري من لينكه)', true, false, 1),
  ('device', 'استبعاد الطلبات من نفس جهاز البيّاع', true, false, 2),
  ('minval', 'أقل قيمة طلب مؤهل 100 EGP', true, false, 3),
  ('giftcard', 'استبعاد كروت الهدايا والشحن', true, false, 4),
  ('reverse', 'عكس العمولة تلقائياً عند الإلغاء أو الاسترجاع', true, true, 5)
on conflict (key) do nothing;

insert into public.commission_campaigns (
  code, name_ar, category_id, extra_rate_pct, starts_at, ends_at, is_active
) values
  (
    'CMP-31',
    'الجمعة البيضاء · مطبخ',
    'kitchen',
    3,
    current_date - 6,
    current_date + 10,
    true
  ),
  (
    'CMP-29',
    'موسم الشتا · رجالي',
    'men',
    2,
    current_date - 19,
    current_date + 25,
    true
  ),
  (
    'CMP-22',
    'العودة للمدارس',
    'toys',
    4,
    current_date - 80,
    current_date - 50,
    false
  )
on conflict (code) do nothing;

insert into public.commission_change_log (what, who, created_at) values
  ('تهيئة محرك العمولات · نسب الأقسام والقواعد العامة', 'النظام', now() - interval '2 days');

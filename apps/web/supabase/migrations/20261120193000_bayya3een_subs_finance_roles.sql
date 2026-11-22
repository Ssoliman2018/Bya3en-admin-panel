/*
 * Bayya3een | بياعين — Subscriptions + Finance snapshots + Roles
 */

-- ========== SUBSCRIPTIONS ==========
create type public.party_type as enum ('merchant', 'affiliate');
create type public.sub_status as enum ('active', 'cancelled', 'expired');
create type public.payment_kind as enum ('new', 'renewal', 'upgrade');
create type public.sub_payment_status as enum ('paid', 'refunded');
create type public.promo_applies as enum ('all', 'merchant', 'affiliate');

create table if not exists public.subscription_packages (
  id text primary key,
  party_type public.party_type not null,
  name_en varchar(80) not null,
  name_ar varchar(80) not null,
  price_egp numeric(12, 2) not null check (price_egp >= 0),
  days int not null default 90 check (days > 0),
  product_limit int,
  fair_use_limit int,
  tier int,
  version int not null default 1,
  is_active boolean not null default true,
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  party_type public.party_type not null,
  owner_code text not null,
  owner_name varchar(180) not null,
  package_id text not null references public.subscription_packages (id),
  package_name varchar(80) not null,
  package_version int not null default 1,
  price_egp numeric(12, 2) not null,
  days int not null,
  product_limit int,
  features text[] not null default '{}',
  status public.sub_status not null default 'active',
  auto_renew boolean not null default true,
  starts_at date not null,
  ends_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_party_idx on public.subscriptions (party_type, status);
create index if not exists subscriptions_ends_idx on public.subscriptions (ends_at);

create table if not exists public.subscription_payments (
  id uuid primary key default extensions.uuid_generate_v4(),
  invoice_code text not null unique,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  owner_code text not null,
  owner_name varchar(180) not null,
  party_type public.party_type not null,
  package_name varchar(80) not null,
  kind public.payment_kind not null default 'new',
  amount_egp numeric(12, 2) not null,
  method text not null default 'card',
  status public.sub_payment_status not null default 'paid',
  note text,
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_promos (
  code text primary key,
  label_ar text not null,
  pct numeric(5, 2) not null check (pct > 0 and pct <= 90),
  applies public.promo_applies not null default 'all',
  is_active boolean not null default true,
  ends_at date not null,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_policy (
  id text primary key default 'default',
  merchant_expiry text not null default 'grace_then_hide',
  merchant_grace int not null default 7,
  affiliate_links text not null default 'grace_then_pause',
  affiliate_grace int not null default 7,
  downgrade text not null default 'next_cycle',
  reminders int[] not null default '{14,7,1}',
  updated_at timestamptz not null default now()
);

-- ========== FINANCE ==========
create table if not exists public.finance_months (
  id text primary key,
  label_ar varchar(40) not null,
  month_index int not null,
  gmv numeric(14, 2) not null,
  own_sales numeric(14, 2) not null,
  merchant_sales numeric(14, 2) not null,
  marketplace_fee numeric(14, 2) not null,
  cogs numeric(14, 2) not null,
  refunds numeric(14, 2) not null,
  affiliate_expense numeric(14, 2) not null,
  gateway_fees numeric(14, 2) not null,
  opex numeric(14, 2) not null,
  sub_merchant numeric(14, 2) not null,
  sub_affiliate numeric(14, 2) not null,
  payables numeric(14, 2) not null,
  net_revenue numeric(14, 2) not null,
  gross_profit numeric(14, 2) not null,
  net_profit numeric(14, 2) not null,
  orders_count int not null default 0,
  is_mtd boolean not null default false
);

create table if not exists public.merchant_settlements (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  merchant_id uuid references public.merchants (id) on delete set null,
  merchant_name varchar(180) not null,
  period_label text not null,
  gross_egp numeric(12, 2) not null,
  fee_egp numeric(12, 2) not null,
  refund_egp numeric(12, 2) not null default 0,
  net_egp numeric(12, 2) not null,
  status text not null default 'due' check (status in ('due', 'paid')),
  settled_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_recon (
  id uuid primary key default extensions.uuid_generate_v4(),
  source text not null,
  recon_date date not null,
  gateway_egp numeric(12, 2) not null,
  ledger_egp numeric(12, 2) not null,
  diff_egp numeric(12, 2) not null default 0,
  status text not null default 'matched' check (status in ('matched', 'diff')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_ledger (
  id uuid primary key default extensions.uuid_generate_v4(),
  tx_code text not null unique,
  tx_date date not null,
  tx_type text not null,
  direction text not null,
  ref_code text,
  party text,
  amount_egp numeric(12, 2) not null,
  method text,
  created_at timestamptz not null default now()
);

-- ========== ROLES ==========
create table if not exists public.admin_roles (
  key text primary key,
  label_ar text not null,
  sort_order int not null default 0
);

create table if not exists public.admin_role_permissions (
  role_key text not null references public.admin_roles (key) on delete cascade,
  section_key text not null,
  section_label_ar text not null,
  access text not null check (access in ('edit', 'view', 'none')),
  primary key (role_key, section_key)
);

create table if not exists public.admin_team (
  id uuid primary key default extensions.uuid_generate_v4(),
  name varchar(180) not null,
  email varchar(320) not null unique,
  role_key text not null references public.admin_roles (key),
  last_login_label text,
  created_at timestamptz not null default now()
);

-- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'subscription_packages','subscriptions','subscription_payments','subscription_promos','subscription_policy',
    'finance_months','merchant_settlements','finance_recon','finance_ledger',
    'admin_roles','admin_role_permissions','admin_team'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
    execute format('grant all on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- Seed packages
insert into public.subscription_packages (
  id, party_type, name_en, name_ar, price_egp, days, product_limit, fair_use_limit, tier, features
) values
  ('m-starter','merchant','Starter','ستارتر',499,90,25,null,null,array['حتى 25 منتج','تقارير مبيعات أساسية','تسويات أسبوعية','دعم بالبريد']),
  ('m-business','merchant','Business','بيزنس',999,90,100,null,null,array['حتى 100 منتج','تقارير مبيعات متقدمة','ظهور في عروض الأقسام','دعم أولوية']),
  ('m-premium','merchant','Premium','بريميوم',1999,90,null,1000,null,array['منتجات بلا حد (استخدام عادل حتى 1,000)','كل تقارير بيزنس','مدير حساب','ظهور مميز في الحملات']),
  ('a-starter','affiliate','Starter','ستارتر',99,90,null,null,1,array['توليد لينكات','لوحة أرباح أساسية','متابعة العمولات','أدوات مشاركة أساسية']),
  ('a-pro','affiliate','Pro','برو',249,90,null,null,2,array['كل مميزات ستارتر','تحليلات متقدمة','تقارير أداء المنتجات','أدوات ترويج إضافية']),
  ('a-elite','affiliate','Elite','إيليت',499,90,null,null,3,array['كل مميزات برو','تحليلات الحملات المتقدمة','تقارير مفصّلة','أدوات تسويق مميزة'])
on conflict (id) do nothing;

insert into public.subscription_policy (id) values ('default') on conflict do nothing;

insert into public.subscription_promos (code, label_ar, pct, applies, is_active, ends_at, uses) values
  ('WHITEFRI','الجمعة البيضاء للتجار',20,'merchant',true,current_date + 10,14),
  ('BAYA3','أول اشتراك بيّاع',10,'affiliate',true,current_date + 40,212),
  ('RAMADAN26','رمضان 2026',15,'all',false,current_date - 200,388)
on conflict (code) do nothing;

-- Seed subscriptions from merchants + affiliates
insert into public.subscriptions (
  code, party_type, owner_code, owner_name, package_id, package_name, package_version,
  price_egp, days, product_limit, features, status, auto_renew, starts_at, ends_at
)
select
  'SUB-M-' || row_number() over (order by m.store_name),
  'merchant',
  m.id::text,
  m.store_name,
  p.id,
  p.name_en,
  p.version,
  p.price_egp,
  p.days,
  p.product_limit,
  p.features,
  'active',
  true,
  current_date - ((30 + (row_number() over (order by m.store_name))::int * 5)),
  current_date + ((55 - (row_number() over (order by m.store_name))::int * 8))
from public.merchants m
join public.subscription_packages p on p.id = case
  when m.store_name = 'تك زون' then 'm-premium'
  when m.store_name in ('بيت المطبخ', 'موبايل زون') then 'm-business'
  else 'm-starter'
end
where m.status = 'active'
on conflict (code) do nothing;

insert into public.subscriptions (
  code, party_type, owner_code, owner_name, package_id, package_name, package_version,
  price_egp, days, product_limit, features, status, auto_renew, starts_at, ends_at
)
select
  'SUB-A-' || a.code,
  'affiliate',
  a.code,
  a.name,
  coalesce(p.id, 'a-starter'),
  coalesce(p.name_en, 'Starter'),
  1,
  coalesce(p.price_egp, 99),
  90,
  null,
  coalesce(p.features, '{}'),
  (case when a.status = 'suspended' then 'cancelled' else 'active' end)::public.sub_status,
  true,
  a.joined_at::date,
  a.joined_at::date + 90
from public.affiliates a
left join public.subscription_packages p
  on p.id = case a.membership_tier
    when 'elite' then 'a-elite'
    when 'pro' then 'a-pro'
    else 'a-starter'
  end
where a.status in ('active', 'suspended')
on conflict (code) do nothing;

insert into public.subscription_payments (
  invoice_code, subscription_id, owner_code, owner_name, party_type,
  package_name, kind, amount_egp, method, status, paid_at
)
select
  'INV-2026-' || (40210 + row_number() over ()),
  s.id,
  s.owner_code,
  s.owner_name,
  s.party_type,
  s.package_name,
  'new',
  s.price_egp,
  (array['card','vf','ip','fawry'])[1 + (row_number() over () % 4)],
  'paid',
  s.starts_at
from public.subscriptions s
on conflict (invoice_code) do nothing;

insert into public.subscription_payments (
  invoice_code, owner_code, owner_name, party_type, package_name, kind, amount_egp, method, status, note, paid_at
) values (
  'INV-2026-39555', 'NADA_R', 'ندى ر.', 'affiliate', 'Pro', 'new', 249, 'card', 'refunded',
  'استرداد تجريبي: اتدفع مرتين بالغلط', current_date - 20
) on conflict do nothing;

-- Finance months (rounded prototype-style)
insert into public.finance_months (
  id, label_ar, month_index, gmv, own_sales, merchant_sales, marketplace_fee, cogs, refunds,
  affiliate_expense, gateway_fees, opex, sub_merchant, sub_affiliate, payables,
  net_revenue, gross_profit, net_profit, orders_count, is_mtd
) values
  ('2026-06','يونيو',5,3100000,1054000,2046000,214830,801040,105400,46347,43400,380000,24100,38000,1831170,1292530,481490,12083,2627,false),
  ('2026-07','يوليو',6,3450000,1207500,2242500,237705,917700,113850,51911,48300,392000,25800,44500,2007445,1414655,522444,30133,2924,false),
  ('2026-08','أغسطس',7,3700000,1332000,2368000,255744,1012320,118400,56189,51800,401000,27200,51200,2112256,1526544,546155,37066,3136,false),
  ('2026-09','سبتمبر',8,4150000,1535500,2614500,284980,1166980,128650,63371,58100,415000,28900,57900,2329520,1729730,603359,66588,3517,false),
  ('2026-10','أكتوبر',9,4820000,1831600,2988400,328724,1392016,144600,73881,67480,428000,30600,65100,2662076,2020424,638047,68786,4085,false),
  ('2026-11','نوفمبر*',10,2900000,1131000,1769000,196359,859560,84100,43353,40600,252000,18400,39800,1572541,1282459,446506,110553,2458,true)
on conflict (id) do nothing;

insert into public.merchant_settlements (
  code, merchant_id, merchant_name, period_label, gross_egp, fee_egp, refund_egp, net_egp, status, settled_at
)
select
  'ST-' || left(upper(md5(m.store_name)), 4) || '-' || g.w,
  m.id,
  m.store_name,
  'أسبوع ' || g.w,
  g.gross,
  round(g.gross * m.marketplace_fee_pct / 100, 2),
  case when g.w = 2 then round(g.gross * 0.04, 2) else 0 end,
  g.gross - round(g.gross * m.marketplace_fee_pct / 100, 2) - case when g.w = 2 then round(g.gross * 0.04, 2) else 0 end,
  case when g.w = 1 and m.store_name in ('بيت المطبخ', 'موبايل زون') then 'due' else 'paid' end,
  case when g.w = 1 and m.store_name in ('بيت المطبخ', 'موبايل زون') then null else current_date - (g.w * 7) end
from public.merchants m
cross join (
  values (1, 18500::numeric), (2, 14200::numeric), (3, 16800::numeric)
) as g(w, gross)
where m.status = 'active'
on conflict (code) do nothing;

insert into public.finance_recon (source, recon_date, gateway_egp, ledger_egp, diff_egp, status, note) values
  ('Paymob · كروت', current_date - 1, 418230, 418230, 0, 'matched', null),
  ('فودافون كاش (محافظ)', current_date - 1, 126410, 125960, 450, 'diff', 'دفعة مكررة لطلب BY-58641 · محتاجة استرداد'),
  ('إنستاباي', current_date - 1, 58200, 58200, 0, 'matched', null),
  ('فوري', current_date - 1, 33120, 33620, -500, 'diff', 'تحصيل فوري متأخر يوم · هيتطابق بكرة'),
  ('الدفع عند الاستلام (شركات الشحن)', current_date - 2, 702940, 702940, 0, 'matched', null);

insert into public.finance_ledger (tx_code, tx_date, tx_type, direction, ref_code, party, amount_egp, method)
select
  'TX-' || (900120 + row_number() over ()),
  o.created_at::date,
  'customer_payment',
  'in',
  o.code,
  'عميل · ' || o.governorate,
  o.total_egp,
  o.payment_method::text
from public.orders o
order by o.created_at desc
limit 20
on conflict (tx_code) do nothing;

-- Roles
insert into public.admin_roles (key, label_ar, sort_order) values
  ('super', 'Super Admin · مدير عام', 1),
  ('ops', 'Operations Manager · مدير العمليات', 2),
  ('fin', 'Finance Manager · مدير مالي', 3),
  ('support', 'Customer Support · خدمة العملاء', 4),
  ('product', 'Product Manager · مدير المنتجات', 5)
on conflict do nothing;

insert into public.admin_role_permissions (role_key, section_key, section_label_ar, access)
select r.key, s.key, s.label, coalesce(p.access, 'none')
from public.admin_roles r
cross join (
  values
    ('overview','نظرة عامة'),
    ('perf','أداء المشروع'),
    ('products','المنتجات'),
    ('orders','الطلبات'),
    ('customers','العملاء'),
    ('merchants','التجار'),
    ('affiliates','البيّاعين'),
    ('commission','محرك العمولات'),
    ('subs','إدارة الاشتراكات'),
    ('finance','المالية'),
    ('roles','الأدوار والصلاحيات')
) as s(key, label)
left join (
  values
    ('super','overview','edit'),('super','perf','edit'),('super','products','edit'),('super','orders','edit'),
    ('super','customers','edit'),('super','merchants','edit'),('super','affiliates','edit'),('super','commission','edit'),
    ('super','subs','edit'),('super','finance','edit'),('super','roles','edit'),
    ('ops','overview','view'),('ops','products','view'),('ops','orders','edit'),('ops','customers','view'),
    ('ops','merchants','edit'),('ops','affiliates','view'),('ops','subs','view'),
    ('fin','overview','view'),('fin','perf','view'),('fin','orders','view'),('fin','merchants','view'),
    ('fin','affiliates','view'),('fin','commission','view'),('fin','subs','edit'),('fin','finance','edit'),
    ('support','overview','view'),('support','products','view'),('support','orders','edit'),('support','customers','edit'),
    ('support','merchants','view'),('support','affiliates','view'),('support','subs','view'),
    ('product','overview','view'),('product','products','edit'),('product','orders','view'),('product','merchants','view'),
    ('product','commission','edit')
) as p(role_key, section_key, access)
  on p.role_key = r.key and p.section_key = s.key
on conflict do nothing;

insert into public.admin_team (name, email, role_key, last_login_label) values
  ('هالة منصور','hala@bayya3een.app','super','اليوم'),
  ('محمود رشدي','m.roshdy@bayya3een.app','ops','أمس'),
  ('إيمان طلعت','eman@bayya3een.app','fin','اليوم'),
  ('باسم عزت','bassem@bayya3een.app','support','منذ يومين'),
  ('ياسمين فؤاد','yasmine@bayya3een.app','product','اليوم')
on conflict (email) do nothing;

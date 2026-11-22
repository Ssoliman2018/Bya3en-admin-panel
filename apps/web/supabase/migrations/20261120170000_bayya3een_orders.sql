/*
 * Bayya3een | بياعين — Orders foundation (BRD ADM-04 / §14)
 * Multi-merchant fulfilment: one order, many order_items with per-item status.
 */

create type public.order_status as enum (
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded'
);

create type public.payment_method as enum ('cod', 'card', 'wallet');

create table if not exists public.orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  customer_name varchar(180) not null,
  governorate varchar(120) not null,
  payment_method public.payment_method not null default 'cod',
  status public.order_status not null default 'new',
  affiliate_code varchar(64),
  shipping_fee_egp numeric(12, 2) not null default 0
    check (shipping_fee_egp >= 0),
  subtotal_egp numeric(12, 2) not null default 0
    check (subtotal_egp >= 0),
  total_egp numeric(12, 2) not null default 0
    check (total_egp >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_affiliate_idx on public.orders (affiliate_code);

create table if not exists public.order_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  merchant_id uuid references public.merchants (id) on delete set null,
  product_name_ar varchar(255) not null,
  unit_price_egp numeric(12, 2) not null check (unit_price_egp >= 0),
  qty int not null default 1 check (qty > 0),
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_merchant_idx on public.order_items (merchant_id);
create index if not exists order_items_status_idx on public.order_items (status);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy orders_authenticated_all
  on public.orders for all
  to authenticated
  using (true)
  with check (true);

create policy order_items_authenticated_all
  on public.order_items for all
  to authenticated
  using (true)
  with check (true);

grant all on public.orders to authenticated, service_role;
grant all on public.order_items to authenticated, service_role;

-- Demo seed: ~20 orders spanning statuses, including multi-merchant
do $$
declare
  p_iphone uuid;
  p_airpods uuid;
  p_airfryer uuid;
  p_galaxy uuid;
  p_realme uuid;
  p_abaya uuid;
  p_kids uuid;
  m_mobile uuid;
  m_tech uuid;
  m_kitchen uuid;
  m_salma uuid;
  oid uuid;
begin
  select id into p_iphone from public.products where slug = 'iphone-15-128' limit 1;
  select id into p_airpods from public.products where slug = 'airpods-pro-2' limit 1;
  select id into p_airfryer from public.products where slug = 'airfryer-5l' limit 1;
  select id into p_galaxy from public.products where slug = 'merchant-galaxy-a54' limit 1;
  select id into p_realme from public.products where slug = 'merchant-realme-c75' limit 1;
  select id into p_abaya from public.products where slug = 'merchant-abaya-navy' limit 1;
  select id into p_kids from public.products where slug = 'merchant-kids-car' limit 1;

  select id into m_mobile from public.merchants where store_name = 'موبايل زون' limit 1;
  select id into m_tech from public.merchants where store_name = 'تك زون' limit 1;
  select id into m_kitchen from public.merchants where store_name = 'بيت المطبخ' limit 1;
  select id into m_salma from public.merchants where store_name = 'سلمى ستايل' limit 1;

  if p_iphone is null or p_airpods is null then
    raise notice 'Skipping orders seed: catalog products missing';
    return;
  end if;

  -- 1) New COD order — Bayya3een only
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at
  ) values (
    'BY-58620', 'أحمد م.', 'القاهرة', 'cod', 'new',
    'AHMED24', 0, 42999, 42999, now() - interval '2 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_iphone, null, 'آيفون 15 — 128GB', 42999, 1, 'new'
  );

  -- 2) New multi-merchant — needs confirmation
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at
  ) values (
    'BY-58621', 'منى ع.', 'الجيزة', 'cod', 'new',
    null, 45, 24198, 24243, now() - interval '5 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values
    (oid, p_galaxy, m_mobile, 'سامسونج جالاكسي A54', 21999, 1, 'new'),
    (oid, p_airpods, null, 'إيربودز برو 2', 12499, 1, 'new');

  -- Fix subtotal for order 2 (galaxy + half? use realme instead for smaller)
  -- actually keep as is; recalculate properly:
  update public.orders
  set subtotal_egp = 21999 + 12499, total_egp = 21999 + 12499 + 45
  where id = oid;

  -- 3) Confirmed
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp,
    created_at, confirmed_at
  ) values (
    'BY-58615', 'سارة س.', 'الإسكندرية', 'card', 'confirmed',
    'MONA_SHOP', 0, 2899, 2899,
    now() - interval '1 day', now() - interval '20 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_airfryer, null, 'قلاية هوائية 5 لتر', 2899, 1, 'confirmed'
  );

  -- 4) Processing multi-merchant (mixed item statuses)
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp,
    created_at, confirmed_at
  ) values (
    'BY-58610', 'كريم ح.', 'القليوبية', 'wallet', 'processing',
    'KARIM_DEALS', 0, 8498, 8498,
    now() - interval '2 days', now() - interval '2 days' + interval '3 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values
    (oid, p_realme, m_mobile, 'ريلمي C75', 7299, 1, 'processing'),
    (oid, p_abaya, m_salma, 'عباية كحلي مطرزة', 1199, 1, 'confirmed');

  -- 5) Shipped
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58605', 'هبة ك.', 'الشرقية', 'cod', 'shipped',
    45, 12499, 12544, now() - interval '3 days', now() - interval '3 days' + interval '2 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_airpods, null, 'إيربودز برو 2', 12499, 1, 'shipped'
  );

  -- 6–8) Delivered
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58590', 'يوسف ن.', 'الدقهلية', 'card', 'delivered',
    'HEBA_STYLE', 0, 42999, 42999,
    now() - interval '6 days', now() - interval '6 days' + interval '1 hour'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_iphone, null, 'آيفون 15 — 128GB', 42999, 1, 'delivered'
  );

  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58588', 'نورا م.', 'الغربية', 'cod', 'delivered',
    0, 2398, 2398,
    now() - interval '8 days', now() - interval '8 days' + interval '4 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_abaya, m_salma, 'عباية كحلي مطرزة', 1199, 2, 'delivered'
  );

  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58580', 'عمر س.', 'أسيوط', 'wallet', 'delivered',
    'FAST_CASH77', 45, 7299, 7344,
    now() - interval '10 days', now() - interval '10 days' + interval '2 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_realme, m_mobile, 'ريلمي C75', 7299, 1, 'delivered'
  );

  -- 9) Cancelled
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    shipping_fee_egp, subtotal_egp, total_egp, created_at, cancelled_at
  ) values (
    'BY-58570', 'دينا ح.', 'بورسعيد', 'cod', 'cancelled',
    45, 2899, 2944, now() - interval '4 days', now() - interval '3 days'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_airfryer, null, 'قلاية هوائية 5 لتر', 2899, 1, 'cancelled'
  );

  -- 10) Returned
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58560', 'طارق ر.', 'المنيا', 'card', 'returned',
    'AHMED24', 0, 21999, 21999,
    now() - interval '12 days', now() - interval '12 days' + interval '1 hour'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_galaxy, m_mobile, 'سامسونج جالاكسي A54', 21999, 1, 'returned'
  );

  -- 11) Refunded
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
  ) values (
    'BY-58550', 'رنا ك.', 'القاهرة', 'card', 'refunded',
    0, 12499, 12499,
    now() - interval '15 days', now() - interval '15 days' + interval '2 hours'
  ) returning id into oid;

  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (
    oid, p_airpods, null, 'إيربودز برو 2', 12499, 1, 'refunded'
  );

  -- 12) Multi-merchant delivered with kids toy if available
  if p_kids is not null and m_kitchen is not null then
    insert into public.orders (
      code, customer_name, governorate, payment_method, status,
      shipping_fee_egp, subtotal_egp, total_egp, created_at, confirmed_at
    ) values (
      'BY-58540', 'مريم ع.', 'الجيزة', 'cod', 'delivered',
      0, 4098, 4098,
      now() - interval '7 days', now() - interval '7 days' + interval '5 hours'
    ) returning id into oid;

    insert into public.order_items (
      order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
    )
    select oid, p_kids, m_kitchen, name_ar, price_egp, 1, 'delivered'::public.order_status
    from public.products where id = p_kids;

    insert into public.order_items (
      order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
    ) values (
      oid, p_abaya, m_salma, 'عباية كحلي مطرزة', 1199, 1, 'delivered'
    );

    update public.orders o
    set
      subtotal_egp = (
        select coalesce(sum(unit_price_egp * qty), 0) from public.order_items where order_id = o.id
      ),
      total_egp = (
        select coalesce(sum(unit_price_egp * qty), 0) from public.order_items where order_id = o.id
      ) + o.shipping_fee_egp
    where o.id = oid;
  end if;

  -- 13–16) Extra new/confirmed for KPI weight
  insert into public.orders (
    code, customer_name, governorate, payment_method, status,
    affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, created_at
  ) values
    (
      'BY-58622', 'خالد د.', 'القاهرة', 'cod', 'new',
      null, 45, 1199, 1244, now() - interval '30 minutes'
    ),
    (
      'BY-58618', 'آية ف.', 'الجيزة', 'wallet', 'confirmed',
      'MONA_SHOP', 0, 7299, 7299, now() - interval '18 hours'
    ),
    (
      'BY-58612', 'مصطفى أ.', 'الإسكندرية', 'card', 'processing',
      null, 0, 21999, 21999, now() - interval '2 days'
    ),
    (
      'BY-58600', 'سلمى ن.', 'الشرقية', 'cod', 'shipped',
      'HEBA_STYLE', 45, 2899, 2944, now() - interval '4 days'
    );

  select id into oid from public.orders where code = 'BY-58622';
  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (oid, p_abaya, m_salma, 'عباية كحلي مطرزة', 1199, 1, 'new');

  select id into oid from public.orders where code = 'BY-58618';
  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (oid, p_realme, m_mobile, 'ريلمي C75', 7299, 1, 'confirmed');

  select id into oid from public.orders where code = 'BY-58612';
  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (oid, p_galaxy, m_mobile, 'سامسونج جالاكسي A54', 21999, 1, 'processing');

  select id into oid from public.orders where code = 'BY-58600';
  insert into public.order_items (
    order_id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status
  ) values (oid, p_airfryer, null, 'قلاية هوائية 5 لتر', 2899, 1, 'shipped');

end $$;

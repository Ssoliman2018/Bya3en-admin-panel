-- Merchant dashboard (prototype `MERCHANT` pages): products, orders, reports, fees & settlements, subscription.
-- Same demo model as onboarding: no merchant auth yet, so every merchant action is a security-definer RPC keyed
-- by the merchant id. Customer visibility now follows the subscription-expiry policy and the "paused" toggle.

alter table public.products add column if not exists is_paused boolean not null default false;

alter table public.subscriptions
  add column if not exists scheduled_package_id text references public.subscription_packages (id),
  add column if not exists history jsonb not null default '[]'::jsonb;

update public.subscriptions s
set history = coalesce((
  select jsonb_agg(jsonb_build_object(
      'd', p.paid_at,
      'what', coalesce(nullif(split_part(p.note, ' · ', 1), ''),
        case p.kind when 'new' then 'اشتراك جديد' when 'renewal' then 'تجديد' else 'ترقية' end),
      'pkg', p.package_name,
      'amount', p.amount_egp) order by p.paid_at desc, p.created_at desc)
  from public.subscription_payments p
  where p.subscription_id = s.id), '[]'::jsonb)
where s.history = '[]'::jsonb;

-- Onboarding (`merchant_subscribe`) inserts the subscription before its first payment: log that payment.
create or replace function public.subscription_payment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'new' and new.subscription_id is not null then
    update public.subscriptions s
    set history = jsonb_build_array(jsonb_build_object(
        'd', new.paid_at,
        'what', coalesce(nullif(split_part(new.note, ' · ', 1), ''), 'اشتراك جديد'),
        'pkg', new.package_name,
        'amount', new.amount_egp))
    where s.id = new.subscription_id and s.history = '[]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_payments_history on public.subscription_payments;
create trigger subscription_payments_history
  after insert on public.subscription_payments
  for each row execute function public.subscription_payment_history();

-- ---------------------------------------------------------------------------------------------------------------
-- Visibility: active merchant + subscription within the expiry policy (prototype `applyMerchantPolicy`).
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.merchant_hidden_reason(p_merchant uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with m as (select status from public.merchants where id = p_merchant),
  pol as (select merchant_expiry, merchant_grace from public.subscription_policy where id = 'default'),
  s as (
    select status, ends_at from public.subscriptions
    where party_type = 'merchant' and owner_code = p_merchant::text
    order by ends_at desc limit 1
  )
  select case
    when not exists (select 1 from m) then 'التاجر مش موجود'
    when (select status from m) = 'suspended' then 'التاجر موقوف'
    when (select status from m) <> 'active' then 'حساب التاجر لسه بيتراجع'
    when not exists (select 1 from s) then 'مفيش اشتراك'
    when (select status from s) = 'active' and (select ends_at from s) >= current_date then null
    when coalesce((select merchant_expiry from pol), 'grace_then_hide') = 'keep' then null
    when coalesce((select merchant_expiry from pol), 'grace_then_hide') = 'hide_now' then 'الاشتراك منتهي'
    when (select status from s) = 'active'
      and current_date - (select ends_at from s) <= coalesce((select merchant_grace from pol), 7) then null
    else 'الاشتراك منتهي من أكتر من ' || coalesce((select merchant_grace from pol), 7) || ' أيام'
  end;
$$;

create or replace function public.merchant_storefront_visible(p_merchant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.merchant_hidden_reason(p_merchant) is null;
$$;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon
  using (
    status = 'live' and is_hidden = false and is_paused = false
    and (merchant_id is null or public.merchant_storefront_visible(merchant_id))
  );

-- ---------------------------------------------------------------------------------------------------------------
-- Read model: everything one merchant's dashboard needs, in one call.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.merchant_accounts()
returns table (id uuid, store_name text, status text, package_name text, ends_at date)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.store_name::text, m.status::text, s.package_name::text, s.ends_at
  from public.merchants m
  left join lateral (
    select x.package_name, x.ends_at from public.subscriptions x
    where x.party_type = 'merchant' and x.owner_code = m.id::text
    order by x.ends_at desc limit 1
  ) s on true
  where m.status in ('active', 'suspended')
  order by m.created_at;
$$;

create or replace function public.merchant_dashboard(p_merchant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_m public.merchants%rowtype;
  v_reason text;
begin
  select * into v_m from public.merchants m where m.id = p_merchant;
  if not found then
    raise exception 'invalid_merchant';
  end if;
  v_reason := public.merchant_hidden_reason(p_merchant);

  return jsonb_build_object(
    'today', current_date,
    'merchant', jsonb_build_object(
      'id', v_m.id,
      'store', v_m.store_name,
      'legal', v_m.legal_name,
      'contact', v_m.contact_name,
      'kind', v_m.business_kind,
      'cr', v_m.cr_number,
      'city', coalesce(nullif(concat_ws('، ', v_m.area, v_m.governorate), ''), v_m.city),
      'category', v_m.category_id,
      'fee', v_m.marketplace_fee_pct,
      'status', v_m.status,
      'rejection', v_m.rejection_reason
    ),
    'policy', (
      select jsonb_build_object('expiry', p.merchant_expiry, 'grace', p.merchant_grace, 'reminders', p.reminders)
      from public.subscription_policy p where p.id = 'default'
    ),
    'subscription', (
      select jsonb_build_object(
        'id', s.id, 'code', s.code, 'packageId', s.package_id, 'name', s.package_name, 'price', s.price_egp,
        'days', s.days, 'limit', s.product_limit, 'features', to_jsonb(s.features), 'status', s.status,
        'autoRenew', s.auto_renew, 'startsAt', s.starts_at, 'endsAt', s.ends_at,
        'scheduled', s.scheduled_package_id,
        'legacy', coalesce(pk.is_active and pk.price_egp <> s.price_egp, false),
        'history', s.history
      )
      from public.subscriptions s
      left join public.subscription_packages pk on pk.id = s.package_id
      where s.party_type = 'merchant' and s.owner_code = p_merchant::text
      order by s.ends_at desc limit 1
    ),
    'packages', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', pk.id, 'name', pk.name_en, 'ar', pk.name_ar, 'price', pk.price_egp, 'days', pk.days,
          'limit', pk.product_limit, 'fair', pk.fair_use_limit, 'features', to_jsonb(pk.features))
        order by pk.price_egp)
      from public.subscription_packages pk
      where pk.party_type = 'merchant' and pk.is_active
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name_ar) order by c.sort_order, c.id)
      from public.categories c where c.is_active
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name_ar, 'category', p.category_id, 'categoryName', c.name_ar,
          'price', p.price_egp, 'old', p.compare_at_price_egp, 'stock', p.stock, 'rate', p.commission_rate,
          'status', p.status, 'paused', p.is_paused, 'code', p.submission_code, 'submittedAt', p.submitted_at,
          'note', p.rejection_reason,
          'photo', (select pm.url from public.product_media pm where pm.product_id = p.id
                    order by pm.sort_order limit 1),
          'hiddenReason', case
            when p.status not in ('live', 'hidden') then null
            when v_reason is not null then v_reason
            when p.status = 'hidden' or p.is_hidden then 'مخفي من بياعين'
            when p.is_paused then 'التاجر وقفه مؤقتاً'
          end)
        order by p.created_at desc)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.merchant_id = p_merchant
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', oi.id, 'order', o.code, 'date', o.created_at, 'productId', oi.product_id,
          'name', oi.product_name_ar, 'qty', oi.qty, 'price', oi.unit_price_egp, 'status', oi.status,
          'customer', btrim(split_part(o.customer_name, ' ', 1) || ' '
            || coalesce(nullif(left(split_part(o.customer_name, ' ', 2), 1), '') || '.', '')),
          'gov', o.governorate,
          'others', (select count(distinct coalesce(x.merchant_id::text, 'bayya3een'))
                     from public.order_items x
                     where x.order_id = o.id and x.merchant_id is distinct from p_merchant))
        order by o.created_at desc, oi.created_at)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.merchant_id = p_merchant
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
          'code', st.code, 'period', st.period_label, 'gross', st.gross_egp, 'fee', st.fee_egp,
          'refund', st.refund_egp, 'net', st.net_egp, 'status', st.status, 'settledAt', st.settled_at)
        order by st.created_at desc, st.code)
      from public.merchant_settlements st where st.merchant_id = p_merchant
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
          'invoice', sp.invoice_code, 'pkg', sp.package_name, 'kind', sp.kind, 'amount', sp.amount_egp,
          'method', sp.method, 'status', sp.status, 'date', sp.paid_at)
        order by sp.paid_at desc, sp.created_at desc)
      from public.subscription_payments sp
      where sp.party_type = 'merchant' and sp.owner_code = p_merchant::text
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Products: price / stock / availability, and new submissions with a chosen category.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.merchant_update_product(
  p_merchant uuid,
  p_product uuid,
  p_price numeric default null,
  p_stock integer default null,
  p_paused boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.merchant_status;
begin
  select m.status into v_status from public.merchants m where m.id = p_merchant;
  if v_status is distinct from 'active' then
    raise exception 'invalid_merchant';
  end if;
  if p_price is not null and public.merchant_hidden_reason(p_merchant) like 'الاشتراك%' then
    raise exception 'no_subscription';
  end if;
  if p_price is not null and p_price <= 0 then raise exception 'invalid_price'; end if;
  if p_stock is not null and p_stock < 0 then raise exception 'invalid_stock'; end if;

  update public.products p
  set price_egp = coalesce(round(p_price), p.price_egp),
      compare_at_price_egp = case
        when p_price is not null and p.compare_at_price_egp <= round(p_price) then null
        else p.compare_at_price_egp end,
      stock = coalesce(p_stock, p.stock),
      is_paused = coalesce(p_paused, p.is_paused),
      updated_at = now()
  where p.id = p_product and p.merchant_id = p_merchant and p.status in ('live', 'hidden');
  if not found then
    raise exception 'invalid_product';
  end if;
end;
$$;

drop function if exists public.merchant_submit_product(uuid, text, numeric, numeric, integer, text, text[], uuid);

create or replace function public.merchant_submit_product(
  p_merchant uuid,
  p_name text,
  p_price numeric,
  p_old_price numeric,
  p_stock integer,
  p_description text,
  p_photos text[],
  p_product uuid default null,
  p_category text default null
)
returns table (id uuid, submission_code text, status text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant public.merchants%rowtype;
  v_limit int;
  v_used int;
  v_id uuid;
  v_code text;
  v_rate numeric;
  v_cat text;
  v_name text := btrim(coalesce(p_name, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_photo text;
  v_i int := 0;
begin
  select * into v_merchant from public.merchants m where m.id = p_merchant;
  if not found or v_merchant.status not in ('pending', 'active') then
    raise exception 'invalid_merchant';
  end if;

  select s.product_limit into v_limit
  from public.subscriptions s
  where s.party_type = 'merchant'
    and s.owner_code = p_merchant::text
    and s.status = 'active'
    and s.ends_at >= current_date
  order by s.ends_at desc
  limit 1;
  if not found then
    raise exception 'no_subscription';
  end if;

  v_cat := coalesce(nullif(btrim(coalesce(p_category, '')), ''), v_merchant.category_id);
  if not exists (select 1 from public.categories c where c.id = v_cat and c.is_active) then
    raise exception 'invalid_category';
  end if;

  if char_length(v_name) < 15 then raise exception 'invalid_product_name'; end if;
  if p_price is null or p_price <= 0 then raise exception 'invalid_price'; end if;
  if p_old_price is not null and p_old_price < p_price then raise exception 'invalid_old_price'; end if;
  if p_stock is null or p_stock <= 0 then raise exception 'invalid_stock'; end if;
  if char_length(v_desc) < 40 then raise exception 'invalid_description'; end if;
  if coalesce(array_length(p_photos, 1), 0) < 3 or array_length(p_photos, 1) > 6 then
    raise exception 'missing_photos';
  end if;
  foreach v_photo in array p_photos loop
    if v_photo !~ '^https://' then raise exception 'invalid_photo'; end if;
  end loop;

  if v_limit is not null then
    select count(*) into v_used
    from public.products p
    where p.merchant_id = p_merchant
      and p.status <> 'rejected'
      and p.id is distinct from p_product;
    if v_used >= v_limit then raise exception 'limit_reached'; end if;
  end if;

  if p_product is not null then
    update public.products p
    set name_ar = v_name,
        description_ar = v_desc,
        category_id = v_cat,
        price_egp = p_price,
        compare_at_price_egp = p_old_price,
        stock = p_stock,
        status = 'under_review',
        rejection_reason = null,
        submitted_at = now(),
        reviewed_at = null,
        updated_at = now()
    where p.id = p_product
      and p.merchant_id = p_merchant
      and p.status = 'rejected'
    returning p.id, p.submission_code into v_id, v_code;
    if v_id is null then raise exception 'invalid_product'; end if;
    delete from public.product_media pm where pm.product_id = v_id;
  else
    v_code := 'SUB-' || nextval('public.product_submission_seq');
    select coalesce(
      (select r.rate_pct from public.category_commission_rates r where r.category_id = v_cat),
      (select cs.default_rate from public.commission_settings cs where cs.id = 'default'),
      8
    ) into v_rate;

    insert into public.products (
      slug, name_ar, brand, description_ar, category_id, owner_type, merchant_id, status,
      price_egp, compare_at_price_egp, stock, commission_rate, submission_code, submitted_at
    ) values (
      'merchant-' || lower(v_code), v_name, v_merchant.store_name, v_desc, v_cat,
      'merchant', p_merchant, 'under_review', p_price, p_old_price, p_stock, v_rate, v_code, now()
    )
    returning products.id into v_id;
  end if;

  foreach v_photo in array p_photos loop
    insert into public.product_media (product_id, url, sort_order, alt_ar)
    values (v_id, v_photo, v_i, v_name);
    v_i := v_i + 1;
  end loop;

  return query
  select p.id, p.submission_code, p.status::text, p.submitted_at
  from public.products p where p.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Orders: a merchant moves only its own items forward (new → confirmed → processing → shipped).
-- Delivery is confirmed by the courier, cancellations/returns by operations.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.merchant_set_item_status(p_merchant uuid, p_item uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_flow text[] := array['new', 'confirmed', 'processing', 'shipped'];
  v_min int;
begin
  if not exists (select 1 from public.merchants m where m.id = p_merchant and m.status = 'active') then
    raise exception 'invalid_merchant';
  end if;
  select * into v_item from public.order_items oi where oi.id = p_item and oi.merchant_id = p_merchant;
  if not found then
    raise exception 'invalid_item';
  end if;
  if coalesce(array_position(v_flow, v_item.status::text), 0) = 0
     or array_position(v_flow, p_status) is distinct from array_position(v_flow, v_item.status::text) + 1 then
    raise exception 'invalid_transition';
  end if;

  update public.order_items oi set status = p_status::public.order_status, updated_at = now() where oi.id = p_item;

  select * into v_order from public.orders o where o.id = v_item.order_id;
  if array_position(v_flow, v_order.status::text) is not null then
    select min(array_position(v_flow, oi.status::text)) into v_min
    from public.order_items oi
    where oi.order_id = v_order.id and array_position(v_flow, oi.status::text) is not null;
    if v_min is not null and v_flow[v_min] <> v_order.status::text then
      update public.orders o
      set status = v_flow[v_min]::public.order_status,
          confirmed_at = case when v_min >= 2 then coalesce(o.confirmed_at, now()) else o.confirmed_at end,
          updated_at = now()
      where o.id = v_order.id;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Subscription: checkout (new / renew / upgrade) and lifecycle actions. Payments are simulated.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.merchant_checkout(
  p_merchant uuid,
  p_package text,
  p_mode text,
  p_method text,
  p_promo text default null
)
returns table (invoice_code text, package_name text, amount_egp numeric, ends_at date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.merchants%rowtype;
  v_s public.subscriptions%rowtype;
  v_pkg public.subscription_packages%rowtype;
  v_promo public.subscription_promos%rowtype;
  v_left int;
  v_amount numeric;
  v_inv text;
  v_what text;
  v_kind public.payment_kind;
  v_from date;
  v_sub_id uuid;
  v_sub_code text;
  v_end date;
begin
  select * into v_m from public.merchants m where m.id = p_merchant;
  if not found or v_m.status not in ('pending', 'active') then
    raise exception 'invalid_merchant';
  end if;
  if p_mode not in ('new', 'renew', 'upgrade') then
    raise exception 'invalid_mode';
  end if;
  if p_method not in ('card', 'vf', 'ip', 'fawry') then
    raise exception 'invalid_method';
  end if;

  select * into v_s from public.subscriptions s
  where s.party_type = 'merchant' and s.owner_code = p_merchant::text
  order by s.ends_at desc limit 1;
  v_left := case when v_s.id is null then null else v_s.ends_at - current_date end;

  if p_mode = 'renew' then
    if v_s.id is null then raise exception 'no_subscription'; end if;
    select * into v_pkg from public.subscription_packages sp
    where sp.id = coalesce(v_s.scheduled_package_id, v_s.package_id);
  else
    select * into v_pkg from public.subscription_packages sp
    where sp.id = p_package and sp.party_type = 'merchant' and sp.is_active;
    if not found then raise exception 'invalid_package'; end if;
  end if;

  if nullif(btrim(coalesce(p_promo, '')), '') is not null and p_mode <> 'upgrade' then
    select * into v_promo from public.subscription_promos sp
    where sp.code = upper(btrim(p_promo)) and sp.is_active and sp.ends_at >= current_date
      and sp.applies in ('all', 'merchant');
    if not found then raise exception 'invalid_promo'; end if;
    update public.subscription_promos sp set uses = sp.uses + 1 where sp.code = v_promo.code;
  end if;

  select 'INV-' || to_char(current_date, 'YYYY') || '-'
         || (coalesce(max(substring(p.invoice_code from '-([0-9]+)$')::int), 40200) + 1)
    into v_inv from public.subscription_payments p;

  if p_mode = 'new' then
    if v_s.id is not null and v_s.status = 'active' and v_left >= 0 then
      raise exception 'already_subscribed';
    end if;
    v_amount := v_pkg.price_egp;
    v_what := case when v_s.id is null then 'اشتراك جديد' else 'اشتراك جديد بعد الانتهاء' end;
    v_kind := 'new';
    if v_s.id is not null and v_s.status = 'active' then
      update public.subscriptions s set status = 'expired', updated_at = now() where s.id = v_s.id;
    end if;
    select 'SUB-M-' || (coalesce(max(substring(s.code from '^SUB-M-([0-9]+)$')::int), 0) + 1)
      into v_sub_code from public.subscriptions s;
    if v_promo.code is not null then
      v_amount := round(v_amount * (100 - v_promo.pct) / 100);
      v_what := v_what || ' (كود ' || v_promo.code || ' -' || trim(to_char(v_promo.pct, 'FM990')) || '%)';
    end if;
    v_end := current_date + v_pkg.days;
    insert into public.subscriptions (
      code, party_type, owner_code, owner_name, package_id, package_name, package_version, price_egp, days,
      product_limit, features, status, auto_renew, starts_at, ends_at, history
    ) values (
      v_sub_code, 'merchant', p_merchant::text, v_m.store_name, v_pkg.id, v_pkg.name_en, v_pkg.version,
      v_pkg.price_egp, v_pkg.days, v_pkg.product_limit, v_pkg.features, 'active', true, current_date, v_end,
      jsonb_build_array(jsonb_build_object('d', current_date, 'what', v_what, 'pkg', v_pkg.name_en,
        'amount', v_amount))
    )
    returning subscriptions.id into v_sub_id;

  elsif p_mode = 'renew' then
    if not v_pkg.is_active then
      v_pkg.price_egp := v_s.price_egp;
      v_pkg.name_en := v_s.package_name;
      v_pkg.days := v_s.days;
      v_pkg.product_limit := v_s.product_limit;
      v_pkg.features := v_s.features;
      v_pkg.version := v_s.package_version;
    end if;
    v_amount := v_pkg.price_egp;
    v_what := case
      when v_s.scheduled_package_id is not null then 'تجديد مع تغيير الباقة لـ ' || v_pkg.name_en
      when v_pkg.price_egp <> v_s.price_egp then 'تجديد على الشروط الحالية للباقة'
      else 'تجديد' end;
    if v_promo.code is not null then
      v_amount := round(v_amount * (100 - v_promo.pct) / 100);
      v_what := v_what || ' (كود ' || v_promo.code || ' -' || trim(to_char(v_promo.pct, 'FM990')) || '%)';
    end if;
    v_kind := 'renewal';
    v_from := case when v_s.status <> 'active' or v_left < 0 then current_date else v_s.ends_at end;
    v_end := v_from + v_pkg.days;
    update public.subscriptions s
    set package_id = v_pkg.id, package_name = v_pkg.name_en, package_version = v_pkg.version,
        price_egp = v_pkg.price_egp, days = v_pkg.days, product_limit = v_pkg.product_limit,
        features = v_pkg.features, status = 'active',
        starts_at = case when v_from = current_date and (v_s.status <> 'active' or v_left < 0)
                         then current_date else s.starts_at end,
        ends_at = v_end, scheduled_package_id = null, updated_at = now(),
        history = jsonb_build_array(jsonb_build_object('d', current_date, 'what', v_what, 'pkg', v_pkg.name_en,
          'amount', v_amount)) || s.history
    where s.id = v_s.id;
    v_sub_id := v_s.id;

  else
    if v_s.id is null or v_s.status <> 'active' or v_left < 0 then raise exception 'no_subscription'; end if;
    if v_pkg.price_egp <= v_s.price_egp then raise exception 'invalid_package'; end if;
    v_amount := greatest(0, round((v_pkg.price_egp - v_s.price_egp) * v_left / v_s.days));
    v_what := 'ترقية من ' || v_s.package_name || ' لـ ' || v_pkg.name_en || ' (فرق الأيام الباقية)';
    v_kind := 'upgrade';
    v_end := v_s.ends_at;
    update public.subscriptions s
    set package_id = v_pkg.id, package_name = v_pkg.name_en, package_version = v_pkg.version,
        price_egp = v_pkg.price_egp, days = v_pkg.days, product_limit = v_pkg.product_limit,
        features = v_pkg.features, scheduled_package_id = null, updated_at = now(),
        history = jsonb_build_array(jsonb_build_object('d', current_date, 'what', v_what, 'pkg', v_pkg.name_en,
          'amount', v_amount)) || s.history
    where s.id = v_s.id;
    v_sub_id := v_s.id;
  end if;

  insert into public.subscription_payments (
    invoice_code, subscription_id, owner_code, owner_name, party_type, package_name, kind, amount_egp, method,
    status, note, paid_at
  ) values (
    v_inv, v_sub_id, p_merchant::text, v_m.store_name, 'merchant', v_pkg.name_en, v_kind, v_amount, p_method,
    'paid', v_what || ' · دفع تجريبي من لوحة التاجر', current_date
  );

  return query select v_inv, v_pkg.name_en::text, v_amount, v_end;
end;
$$;

create or replace function public.merchant_subscription_action(
  p_merchant uuid,
  p_action text,
  p_package text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.subscriptions%rowtype;
  v_pkg public.subscription_packages%rowtype;
  v_grace int;
  v_used int;
  v_end date;
  v_what text;
begin
  select * into v_s from public.subscriptions s
  where s.party_type = 'merchant' and s.owner_code = p_merchant::text
  order by s.ends_at desc limit 1;
  if not found then raise exception 'no_subscription'; end if;

  if p_action in ('auto_on', 'auto_off') then
    update public.subscriptions s set auto_renew = (p_action = 'auto_on'), updated_at = now() where s.id = v_s.id;
    return;
  end if;

  if p_action = 'schedule' then
    select * into v_pkg from public.subscription_packages sp
    where sp.id = p_package and sp.party_type = 'merchant' and sp.is_active;
    if not found or v_pkg.price_egp >= v_s.price_egp then raise exception 'invalid_package'; end if;
    select count(*) into v_used from public.products p where p.merchant_id = p_merchant and p.status <> 'rejected';
    if v_pkg.product_limit is not null and v_used > v_pkg.product_limit then raise exception 'over_limit'; end if;
    v_what := 'تخفيض مجدول لـ ' || v_pkg.name_en || ' عند التجديد '
      || extract(day from v_s.ends_at) || '/' || extract(month from v_s.ends_at);
    update public.subscriptions s
    set scheduled_package_id = v_pkg.id, updated_at = now(),
        history = jsonb_build_array(jsonb_build_object('d', current_date, 'what', v_what, 'pkg', s.package_name,
          'amount', 0)) || s.history
    where s.id = v_s.id;
    return;
  end if;

  if p_action = 'cancel_schedule' then
    update public.subscriptions s
    set scheduled_package_id = null, updated_at = now(),
        history = jsonb_build_array(jsonb_build_object('d', current_date, 'what', 'اتلغى التخفيض المجدول',
          'pkg', s.package_name, 'amount', 0)) || s.history
    where s.id = v_s.id;
    return;
  end if;

  -- "اختبار الانتهاء": review-only date shifts, same as the prototype.
  select coalesce(p.merchant_grace, 7) into v_grace from public.subscription_policy p where p.id = 'default';
  v_grace := coalesce(v_grace, 7);
  if p_action = 'test_soon' then
    v_end := current_date + 5; v_what := 'اختبار: باقي 5 أيام (محاكاة)';
  elsif p_action = 'test_grace' then
    v_end := current_date - 2; v_what := 'اختبار: انتهى من يومين (فترة سماح)';
  elsif p_action = 'test_expired' then
    v_end := current_date - (v_grace + 1); v_what := 'اختبار: الاشتراك انتهى (محاكاة)';
  else
    raise exception 'invalid_action';
  end if;
  update public.subscriptions s
  set ends_at = v_end, starts_at = least(s.starts_at, v_end - s.days), status = 'active', updated_at = now(),
      history = jsonb_build_array(jsonb_build_object('d', current_date, 'what', v_what, 'pkg', s.package_name,
        'amount', 0)) || s.history
  where s.id = v_s.id;
end;
$$;

revoke all on function public.merchant_hidden_reason(uuid) from public;
revoke all on function public.merchant_storefront_visible(uuid) from public;
grant execute on function public.merchant_hidden_reason(uuid) to anon, authenticated;
grant execute on function public.merchant_storefront_visible(uuid) to anon, authenticated;
grant execute on function public.merchant_accounts() to anon, authenticated;
grant execute on function public.merchant_dashboard(uuid) to anon, authenticated;
grant execute on function public.merchant_update_product(uuid, uuid, numeric, integer, boolean) to anon, authenticated;
grant execute on function public.merchant_submit_product(uuid, text, numeric, numeric, integer, text, text[], uuid, text)
  to anon, authenticated;
grant execute on function public.merchant_set_item_status(uuid, uuid, text) to anon, authenticated;
grant execute on function public.merchant_checkout(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.merchant_subscription_action(uuid, text, text) to anon, authenticated;

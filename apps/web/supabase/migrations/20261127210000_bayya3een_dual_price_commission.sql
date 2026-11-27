/*
 * Dual merchant pricing: customer price + seller price → affiliate commission %.
 * Commission must be between 2.5% and 15%. Admin no longer sets commission_rate for merchants.
 */

alter table public.products
  add column if not exists seller_price_egp numeric(12, 2)
    check (seller_price_egp is null or seller_price_egp >= 0);

comment on column public.products.seller_price_egp is
  'Merchant-set price for the affiliate/seller; customer pays price_egp; difference is commission.';

-- Backfill seller price from existing commission_rate when possible.
update public.products
set seller_price_egp = round(price_egp * (100 - commission_rate) / 100, 2)
where seller_price_egp is null
  and commission_rate is not null
  and commission_rate > 0
  and commission_rate < 100
  and price_egp > 0;

create or replace function public.compute_seller_commission_pct(p_customer numeric, p_seller numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v_pct numeric;
begin
  if p_customer is null or p_customer <= 0 then
    raise exception 'invalid_price';
  end if;
  if p_seller is null or p_seller <= 0 then
    raise exception 'invalid_seller_price';
  end if;
  if p_seller >= p_customer then
    raise exception 'invalid_seller_price';
  end if;
  v_pct := round((p_customer - p_seller) * 100 / p_customer, 2);
  if v_pct < 2.5 or v_pct > 15 then
    raise exception 'invalid_commission';
  end if;
  return v_pct;
end;
$$;

revoke all on function public.compute_seller_commission_pct(numeric, numeric) from public;
grant execute on function public.compute_seller_commission_pct(numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- merchant_submit_product: require seller price; derive commission_rate
-- ---------------------------------------------------------------------------------------------------------------

drop function if exists public.merchant_submit_product(uuid, text, numeric, numeric, integer, text, text[], uuid, text);

create or replace function public.merchant_submit_product(
  p_merchant uuid,
  p_name text,
  p_price numeric,
  p_seller_price numeric,
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
  p_merchant := public.require_merchant_id();
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
  if p_old_price is not null and p_old_price < p_price then raise exception 'invalid_old_price'; end if;
  if p_stock is null or p_stock <= 0 then raise exception 'invalid_stock'; end if;
  if char_length(v_desc) < 40 then raise exception 'invalid_description'; end if;
  if coalesce(array_length(p_photos, 1), 0) < 3 or array_length(p_photos, 1) > 6 then
    raise exception 'missing_photos';
  end if;
  foreach v_photo in array p_photos loop
    if v_photo !~ '^https://' then raise exception 'invalid_photo'; end if;
  end loop;

  v_rate := public.compute_seller_commission_pct(p_price, p_seller_price);

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
        seller_price_egp = p_seller_price,
        compare_at_price_egp = p_old_price,
        stock = p_stock,
        commission_rate = v_rate,
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

    insert into public.products (
      slug, name_ar, brand, description_ar, category_id, owner_type, merchant_id, status,
      price_egp, seller_price_egp, compare_at_price_egp, stock, commission_rate, submission_code, submitted_at
    ) values (
      'merchant-' || lower(v_code), v_name, v_merchant.store_name, v_desc, v_cat,
      'merchant', p_merchant, 'under_review', p_price, p_seller_price, p_old_price, p_stock, v_rate, v_code, now()
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

revoke all on function public.merchant_submit_product(uuid, text, numeric, numeric, numeric, integer, text, text[], uuid, text)
  from public, anon;
grant execute on function public.merchant_submit_product(uuid, text, numeric, numeric, numeric, integer, text, text[], uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- merchant_update_product: price changes require both customer + seller prices
-- ---------------------------------------------------------------------------------------------------------------

drop function if exists public.merchant_update_product(uuid, uuid, numeric, integer, boolean);

create or replace function public.merchant_update_product(
  p_merchant uuid,
  p_product uuid,
  p_price numeric default null,
  p_seller_price numeric default null,
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
  v_rate numeric;
  v_price numeric;
  v_seller numeric;
begin
  p_merchant := public.require_merchant_id();
  select m.status into v_status from public.merchants m where m.id = p_merchant;
  if v_status is distinct from 'active' then
    raise exception 'invalid_merchant';
  end if;
  if (p_price is not null or p_seller_price is not null)
     and public.merchant_hidden_reason(p_merchant) like 'الاشتراك%' then
    raise exception 'no_subscription';
  end if;

  if p_price is not null or p_seller_price is not null then
    select p.price_egp, p.seller_price_egp into v_price, v_seller
    from public.products p
    where p.id = p_product and p.merchant_id = p_merchant and p.status in ('live', 'hidden');
    if not found then raise exception 'invalid_product'; end if;
    v_price := coalesce(p_price, v_price);
    v_seller := coalesce(p_seller_price, v_seller);
    v_rate := public.compute_seller_commission_pct(v_price, v_seller);
  end if;

  if p_stock is not null and p_stock < 0 then raise exception 'invalid_stock'; end if;

  update public.products p
  set price_egp = coalesce(round(p_price), p.price_egp),
      seller_price_egp = coalesce(round(p_seller_price), p.seller_price_egp),
      commission_rate = coalesce(v_rate, p.commission_rate),
      compare_at_price_egp = case
        when p_price is not null and p.compare_at_price_egp is not null
             and p.compare_at_price_egp <= round(p_price) then null
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

revoke all on function public.merchant_update_product(uuid, uuid, numeric, numeric, integer, boolean)
  from public, anon;
grant execute on function public.merchant_update_product(uuid, uuid, numeric, numeric, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Dashboard payload: expose sellerPrice
-- ---------------------------------------------------------------------------------------------------------------

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
  p_merchant := public.require_merchant_id();
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
          'price', p.price_egp, 'sellerPrice', p.seller_price_egp, 'old', p.compare_at_price_egp,
          'stock', p.stock, 'rate', p.commission_rate,
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

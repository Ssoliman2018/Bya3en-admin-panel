/*
 * Phase 1: Merchant Auth + RLS
 * - Link auth.users → merchants.auth_user_id
 * - Resolve merchant identity from auth.uid() (ignore client p_merchant)
 * - Revoke anon execute on write RPCs
 * - Replace open authenticated_* policies with platform-admin + own-row merchant policies
 */

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Schema + helpers
-- ---------------------------------------------------------------------------------------------------------------

alter table public.merchants
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists merchants_auth_user_idx on public.merchants (auth_user_id);

-- Platform staff = MakerKit personal account that is NOT linked as a merchant.
-- Merchants also get an accounts row via on_auth_user_created, so the merchant link is the discriminator.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from public.accounts a where a.id = auth.uid())
    and not exists (select 1 from public.merchants m where m.auth_user_id = auth.uid());
$$;

create or replace function public.current_merchant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id from public.merchants m where m.auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.require_merchant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_id := public.current_merchant_id();
  if v_id is null then
    raise exception 'not_a_merchant' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.current_merchant_id() from public;
revoke all on function public.require_merchant_id() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_merchant_id() to authenticated;
grant execute on function public.require_merchant_id() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) register_merchant: requires an authenticated session; links auth_user_id
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.register_merchant(
  p_contact_name text,
  p_phone text,
  p_email text,
  p_store_name text,
  p_kind text,
  p_national_id text,
  p_tax_id text,
  p_cr_number text,
  p_category text,
  p_governorate text,
  p_area text,
  p_address text,
  p_payout_method text,
  p_payout_account text,
  p_documents text[],
  p_package text
)
returns table (id uuid, status public.merchant_status, marketplace_fee_pct numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_contact text := btrim(coalesce(p_contact_name, ''));
  v_store text := btrim(coalesce(p_store_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nid text := regexp_replace(coalesce(p_national_id, ''), '\D', '', 'g');
  v_tax text := regexp_replace(coalesce(p_tax_id, ''), '\D', '', 'g');
  v_cr text := regexp_replace(coalesce(p_cr_number, ''), '\D', '', 'g');
  v_acct text := btrim(coalesce(p_payout_account, ''));
  v_docs text[] := coalesce(p_documents, '{}');
  v_id uuid;
  v_fee numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from merchants m where m.auth_user_id = v_uid) then
    raise exception 'already_registered' using errcode = '23505';
  end if;
  if char_length(v_contact) < 5 or char_length(v_contact) > 120 or v_contact !~ '\s' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' or char_length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if char_length(v_store) < 3 or char_length(v_store) > 120 then
    raise exception 'invalid_store' using errcode = '22023';
  end if;
  if p_kind not in ('ind', 'co') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if v_nid !~ '^[0-9]{14}$' then
    raise exception 'invalid_national_id' using errcode = '22023';
  end if;
  if v_tax !~ '^[0-9]{9}$' then
    raise exception 'invalid_tax_id' using errcode = '22023';
  end if;
  if p_kind = 'co' and v_cr !~ '^[0-9]{4,}$' then
    raise exception 'invalid_cr' using errcode = '22023';
  end if;
  if not exists (select 1 from categories c where c.id = p_category) then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if p_payout_method not in ('ip', 'bank') or char_length(v_acct) < 5 or char_length(v_acct) > 64 then
    raise exception 'invalid_payout' using errcode = '22023';
  end if;
  if not (v_docs @> array['nid', 'tax'] and (p_kind = 'ind' or v_docs @> array['cr'])
          and v_docs <@ array['nid', 'tax', 'cr']) then
    raise exception 'missing_documents' using errcode = '22023';
  end if;
  if p_package is not null and not exists (
    select 1 from subscription_packages sp where sp.id = p_package and sp.party_type = 'merchant' and sp.is_active
  ) then
    raise exception 'invalid_package' using errcode = '22023';
  end if;
  if exists (select 1 from merchants m where m.phone_hash = md5(v_phone)) then
    raise exception 'phone_taken' using errcode = '23505';
  end if;

  v_fee := merchant_category_fee(p_category);

  insert into merchants (
    store_name, legal_name, contact_name, phone, email, city, governorate, category_id, marketplace_fee_pct,
    status, national_id_masked, tax_id_masked, cr_number, business_kind, area, pickup_address, payout_method,
    payout_account_masked, documents, requested_package_id, phone_hash, notes, auth_user_id, account_id
  ) values (
    v_store,
    case when p_kind = 'co' then v_store || ' للتجارة' else v_contact || ' (' || v_store || ')' end,
    v_contact,
    substr(v_phone, 1, 3) || ' •••• ' || substr(v_phone, 8, 4),
    v_email,
    nullif(btrim(coalesce(p_area, '')), ''),
    nullif(btrim(coalesce(p_governorate, '')), ''),
    p_category,
    v_fee,
    'pending',
    '•••••••••• ' || right(v_nid, 4),
    'TX ••• ' || right(v_tax, 3),
    case when p_kind = 'co' then 'CR ' || v_cr else null end,
    p_kind,
    nullif(btrim(coalesce(p_area, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    p_payout_method,
    case when p_payout_method = 'ip' then v_acct else '•••• ' || right(regexp_replace(v_acct, '\s', '', 'g'), 4) end,
    v_docs,
    p_package,
    md5(v_phone),
    'تسجيل ذاتي من لوحة التاجر',
    v_uid,
    v_uid
  )
  returning merchants.id into v_id;

  return query select v_id, 'pending'::public.merchant_status, v_fee;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Lock merchant RPCs: overwrite p_merchant from auth.uid()
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
  where m.auth_user_id = auth.uid()
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
  p_merchant := public.require_merchant_id();
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

create or replace function public.merchant_review_status(p_merchant uuid)
returns table (
  merchant_status text,
  merchant_rejection text,
  product_id uuid,
  submission_code text,
  name_ar text,
  category_id text,
  category_name text,
  price_egp numeric,
  product_status text,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  live_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  p_merchant := public.require_merchant_id();

  return query
  select
    m.status::text,
    m.rejection_reason,
    p.id,
    p.submission_code,
    p.name_ar::text,
    p.category_id,
    c.name_ar::text,
    p.price_egp,
    p.status::text,
    p.rejection_reason,
    p.submitted_at,
    p.reviewed_at,
    (select count(*)::int from public.products x
      where x.merchant_id = m.id and x.status = 'live' and x.is_hidden = false)
  from public.merchants m
  left join lateral (
    select * from public.products x
    where x.merchant_id = m.id and x.submission_code is not null
    order by x.submitted_at desc nulls last
    limit 1
  ) p on true
  left join public.categories c on c.id = p.category_id
  where m.id = p_merchant;
end;
$$;

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
  p_merchant := public.require_merchant_id();
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

create or replace function public.merchant_subscribe(
  p_merchant uuid,
  p_package text,
  p_method text,
  p_promo text
)
returns table (
  invoice_code text,
  subscription_code text,
  package_name text,
  amount_egp numeric,
  product_limit int,
  starts_at date,
  ends_at date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant merchants;
  v_pkg subscription_packages;
  v_promo subscription_promos;
  v_amount numeric;
  v_sub_id uuid;
  v_sub_code text;
  v_inv text;
  v_what text := 'اشتراك جديد';
begin
  p_merchant := public.require_merchant_id();
  select * into v_merchant from merchants m where m.id = p_merchant;
  if not found or v_merchant.status <> 'pending' then
    raise exception 'invalid_merchant' using errcode = '22023';
  end if;
  if exists (select 1 from subscriptions s where s.party_type = 'merchant' and s.owner_code = p_merchant::text) then
    raise exception 'already_subscribed' using errcode = '23505';
  end if;
  select * into v_pkg from subscription_packages sp
    where sp.id = p_package and sp.party_type = 'merchant' and sp.is_active;
  if not found then
    raise exception 'invalid_package' using errcode = '22023';
  end if;
  if p_method not in ('card', 'vf', 'ip', 'fawry') then
    raise exception 'invalid_method' using errcode = '22023';
  end if;

  v_amount := v_pkg.price_egp;
  if nullif(btrim(coalesce(p_promo, '')), '') is not null then
    select * into v_promo from subscription_promos sp
      where sp.code = upper(btrim(p_promo)) and sp.is_active and sp.ends_at >= current_date
        and sp.applies in ('all', 'merchant');
    if not found then
      raise exception 'invalid_promo' using errcode = '22023';
    end if;
    v_amount := round(v_amount * (100 - v_promo.pct) / 100);
    v_what := v_what || ' (كود ' || v_promo.code || ' -' || trim(to_char(v_promo.pct, 'FM990')) || '%)';
    update subscription_promos sp set uses = sp.uses + 1 where sp.code = v_promo.code;
  end if;

  select 'SUB-M-' || (coalesce(max(substring(s.code from '^SUB-M-([0-9]+)$')::int), 0) + 1)
    into v_sub_code from subscriptions s;
  select 'INV-' || to_char(current_date, 'YYYY') || '-'
         || (coalesce(max(substring(p.invoice_code from '-([0-9]+)$')::int), 40200) + 1)
    into v_inv from subscription_payments p;

  insert into subscriptions (
    code, party_type, owner_code, owner_name, package_id, package_name, package_version, price_egp, days,
    product_limit, features, status, auto_renew, starts_at, ends_at
  ) values (
    v_sub_code, 'merchant', p_merchant::text, v_merchant.store_name, v_pkg.id, v_pkg.name_en, v_pkg.version,
    v_pkg.price_egp, v_pkg.days, v_pkg.product_limit, v_pkg.features, 'active', true, current_date,
    current_date + v_pkg.days
  )
  returning subscriptions.id into v_sub_id;

  insert into subscription_payments (
    invoice_code, subscription_id, owner_code, owner_name, party_type, package_name, kind, amount_egp, method,
    status, note, paid_at
  ) values (
    v_inv, v_sub_id, p_merchant::text, v_merchant.store_name, 'merchant', v_pkg.name_en, 'new', v_amount, p_method,
    'paid', v_what || ' · دفع تجريبي من لوحة التاجر', current_date
  );

  update merchants m set requested_package_id = v_pkg.id, updated_at = now() where m.id = p_merchant;

  return query select v_inv, v_sub_code, v_pkg.name_en::text, v_amount, v_pkg.product_limit, current_date,
    current_date + v_pkg.days;
end;
$$;

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
  p_merchant := public.require_merchant_id();
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
  p_merchant := public.require_merchant_id();
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

-- Grants: revoke anon on merchant write / private read RPCs; keep catalog helpers public
revoke all on function public.register_merchant(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], text
) from public, anon;
revoke all on function public.merchant_promo(text) from public, anon;
revoke all on function public.merchant_subscribe(uuid, text, text, text) from public, anon;
revoke all on function public.merchant_accounts() from public, anon;
revoke all on function public.merchant_dashboard(uuid) from public, anon;
revoke all on function public.merchant_update_product(uuid, uuid, numeric, integer, boolean) from public, anon;
revoke all on function public.merchant_submit_product(uuid, text, numeric, numeric, integer, text, text[], uuid, text)
  from public, anon;
revoke all on function public.merchant_review_status(uuid) from public, anon;
revoke all on function public.merchant_set_item_status(uuid, uuid, text) from public, anon;
revoke all on function public.merchant_checkout(uuid, text, text, text, text) from public, anon;
revoke all on function public.merchant_subscription_action(uuid, text, text) from public, anon;

grant execute on function public.register_merchant(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], text
) to authenticated;
grant execute on function public.merchant_promo(text) to authenticated;
grant execute on function public.merchant_subscribe(uuid, text, text, text) to authenticated;
grant execute on function public.merchant_accounts() to authenticated;
grant execute on function public.merchant_dashboard(uuid) to authenticated;
grant execute on function public.merchant_update_product(uuid, uuid, numeric, integer, boolean) to authenticated;
grant execute on function public.merchant_submit_product(uuid, text, numeric, numeric, integer, text, text[], uuid, text)
  to authenticated;
grant execute on function public.merchant_review_status(uuid) to authenticated;
grant execute on function public.merchant_set_item_status(uuid, uuid, text) to authenticated;
grant execute on function public.merchant_checkout(uuid, text, text, text, text) to authenticated;
grant execute on function public.merchant_subscription_action(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) RLS: platform admin keeps full access; merchants see only their rows
-- ---------------------------------------------------------------------------------------------------------------

-- merchants
drop policy if exists merchants_authenticated_all on public.merchants;
create policy merchants_admin_all on public.merchants
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy merchants_own_select on public.merchants
  for select to authenticated
  using (auth_user_id = auth.uid());
create policy merchants_own_update on public.merchants
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- products
drop policy if exists products_authenticated_write on public.products;
create policy products_admin_all on public.products
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy products_merchant_select on public.products
  for select to authenticated
  using (merchant_id = public.current_merchant_id());
create policy products_merchant_update on public.products
  for update to authenticated
  using (merchant_id = public.current_merchant_id())
  with check (merchant_id = public.current_merchant_id());

-- product_media
drop policy if exists product_media_authenticated_write on public.product_media;
create policy product_media_admin_all on public.product_media
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy product_media_merchant_select on public.product_media
  for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.merchant_id = public.current_merchant_id()
    )
  );

-- orders / order_items (merchants use RPCs; direct table access is admin-only + own items)
drop policy if exists orders_authenticated_all on public.orders;
create policy orders_admin_all on public.orders
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists order_items_authenticated_all on public.order_items;
create policy order_items_admin_all on public.order_items
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy order_items_merchant_select on public.order_items
  for select to authenticated
  using (merchant_id = public.current_merchant_id());

-- subscriptions + payments
drop policy if exists subscriptions_authenticated_all on public.subscriptions;
create policy subscriptions_admin_all on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy subscriptions_merchant_select on public.subscriptions
  for select to authenticated
  using (party_type = 'merchant' and owner_code = public.current_merchant_id()::text);

drop policy if exists subscription_payments_authenticated_all on public.subscription_payments;
create policy subscription_payments_admin_all on public.subscription_payments
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy subscription_payments_merchant_select on public.subscription_payments
  for select to authenticated
  using (party_type = 'merchant' and owner_code = public.current_merchant_id()::text);

-- settlements
drop policy if exists merchant_settlements_authenticated_all on public.merchant_settlements;
create policy merchant_settlements_admin_all on public.merchant_settlements
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy merchant_settlements_merchant_select on public.merchant_settlements
  for select to authenticated
  using (merchant_id = public.current_merchant_id());

-- Remaining finance / ops / affiliate / commission tables: admin only (no longer open to all authenticated)
drop policy if exists subscription_packages_authenticated_all on public.subscription_packages;
create policy subscription_packages_admin_all on public.subscription_packages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
-- anon already has public read of active packages; authenticated merchants need the same for onboarding
drop policy if exists subscription_packages_authenticated_read on public.subscription_packages;
create policy subscription_packages_authenticated_read on public.subscription_packages
  for select to authenticated
  using (is_active or public.is_platform_admin());

drop policy if exists subscription_promos_authenticated_all on public.subscription_promos;
create policy subscription_promos_admin_all on public.subscription_promos
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists subscription_policy_authenticated_all on public.subscription_policy;
create policy subscription_policy_admin_all on public.subscription_policy
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists finance_months_authenticated_all on public.finance_months;
create policy finance_months_admin_all on public.finance_months
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists finance_recon_authenticated_all on public.finance_recon;
create policy finance_recon_admin_all on public.finance_recon
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists finance_ledger_authenticated_all on public.finance_ledger;
create policy finance_ledger_admin_all on public.finance_ledger
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists admin_roles_authenticated_all on public.admin_roles;
create policy admin_roles_admin_all on public.admin_roles
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists admin_role_permissions_authenticated_all on public.admin_role_permissions;
create policy admin_role_permissions_admin_all on public.admin_role_permissions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists admin_team_authenticated_all on public.admin_team;
create policy admin_team_admin_all on public.admin_team
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists affiliates_authenticated_all on public.affiliates;
create policy affiliates_admin_all on public.affiliates
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists affiliate_withdrawals_authenticated_all on public.affiliate_withdrawals;
create policy affiliate_withdrawals_admin_all on public.affiliate_withdrawals
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists commission_settings_authenticated_all on public.commission_settings;
create policy commission_settings_admin_all on public.commission_settings
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists category_commission_rates_authenticated_all on public.category_commission_rates;
create policy category_commission_rates_admin_all on public.category_commission_rates
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists commission_campaigns_authenticated_all on public.commission_campaigns;
create policy commission_campaigns_admin_all on public.commission_campaigns
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists commission_eligibility_authenticated_all on public.commission_eligibility;
create policy commission_eligibility_admin_all on public.commission_eligibility
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists commission_change_log_authenticated_all on public.commission_change_log;
create policy commission_change_log_admin_all on public.commission_change_log
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- categories stay writable for admins only (public read already exists)
drop policy if exists categories_authenticated_write on public.categories;
create policy categories_admin_all on public.categories
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists home_banners_authenticated_write on public.home_banners;
create policy home_banners_admin_all on public.home_banners
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists home_featured_authenticated_write on public.home_featured;
create policy home_featured_admin_all on public.home_featured
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

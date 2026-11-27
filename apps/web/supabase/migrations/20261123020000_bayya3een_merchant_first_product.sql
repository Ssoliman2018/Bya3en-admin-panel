/*
 * Bayya3een | بياعين — Merchant onboarding steps 6–8 (prototype js/merchant/onboarding.js)
 * A merchant submits a product for review (status under_review → admin "مراجعة منتجات التجار"),
 * then follows the review until both the account and the product are approved.
 * Writes go through security-definer RPCs only; anon still cannot read merchants or unpublished products.
 */

alter table public.products
  add column if not exists submission_code text unique,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

create sequence if not exists public.product_submission_seq start 2224;

-- Stamp the review time whenever the admin approves or rejects
create or replace function public.products_stamp_review()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.status in ('live', 'rejected') then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_stamp_review on public.products;
create trigger products_stamp_review
  before update of status on public.products
  for each row execute function public.products_stamp_review();

-- Merchant products are only public once the merchant account itself is verified
create or replace function public.merchant_is_active(p_merchant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.merchants where id = p_merchant and status = 'active');
$$;

grant execute on function public.merchant_is_active(uuid) to anon, authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (
    status = 'live'
    and is_hidden = false
    and (merchant_id is null or public.merchant_is_active(merchant_id))
  );

create or replace function public.merchant_submit_product(
  p_merchant uuid,
  p_name text,
  p_price numeric,
  p_old_price numeric,
  p_stock int,
  p_description text,
  p_photos text[],
  p_product uuid default null
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
      (select r.rate_pct from public.category_commission_rates r where r.category_id = v_merchant.category_id),
      (select cs.default_rate from public.commission_settings cs where cs.id = 'default'),
      8
    ) into v_rate;

    insert into public.products (
      slug, name_ar, brand, description_ar, category_id, owner_type, merchant_id, status,
      price_egp, compare_at_price_egp, stock, commission_rate, submission_code, submitted_at
    ) values (
      'merchant-' || lower(v_code), v_name, v_merchant.store_name, v_desc, v_merchant.category_id,
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

-- Review screen: merchant verification + the merchant's latest submission
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
  if not exists (select 1 from public.merchants m where m.id = p_merchant) then
    raise exception 'invalid_merchant';
  end if;

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

revoke all on function public.merchant_submit_product(uuid, text, numeric, numeric, int, text, text[], uuid) from public;
revoke all on function public.merchant_review_status(uuid) from public;
grant execute on function public.merchant_submit_product(uuid, text, numeric, numeric, int, text, text[], uuid)
  to anon, authenticated;
grant execute on function public.merchant_review_status(uuid) to anon, authenticated;

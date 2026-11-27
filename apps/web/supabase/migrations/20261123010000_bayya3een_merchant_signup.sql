-- Merchant ("تاجر") self-onboarding from the vendor panel (prototype js/merchant/onboarding.js).
-- The vendor panel has no auth yet, so anon never touches merchants / subscriptions directly:
--   register_merchant()   → inserts a *pending* merchant for admin review (التجار → طلبات جديدة)
--   merchant_promo()      → validates a promo code without exposing the promos table
--   merchant_subscribe()  → simulated first payment: one subscription + invoice per pending merchant
-- Only masked IDs / payout accounts and a phone hash (duplicate detection) are stored.

alter table public.merchants
  add column if not exists business_kind varchar(8) check (business_kind in ('ind', 'co')),
  add column if not exists area varchar(120),
  add column if not exists pickup_address text,
  add column if not exists payout_method varchar(8) check (payout_method in ('ip', 'bank')),
  add column if not exists payout_account_masked varchar(64),
  add column if not exists documents text[] not null default '{}',
  add column if not exists requested_package_id text references public.subscription_packages (id),
  add column if not exists phone_hash text;

create unique index if not exists merchants_phone_hash_key on public.merchants (phone_hash) where phone_hash is not null;

-- Public pricing: the onboarding package step reads active merchant packages with the anon key.
create policy subscription_packages_public_read
  on public.subscription_packages for select
  to anon
  using (is_active);

grant select on public.subscription_packages to anon;

create or replace function public.merchant_category_fee(p_category text)
returns numeric
language sql
immutable
as $$
  select case p_category
    when 'mobiles' then 6 when 'electronics' then 8 when 'kitchen' then 12 when 'women' then 15
    when 'men' then 14 when 'beauty' then 13 when 'market' then 7 when 'toys' then 12 else 10
  end::numeric;
$$;

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
    payout_account_masked, documents, requested_package_id, phone_hash, notes
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
    'تسجيل ذاتي من لوحة التاجر'
  )
  returning merchants.id into v_id;

  return query select v_id, 'pending'::public.merchant_status, v_fee;
end;
$$;

create or replace function public.merchant_promo(p_code text)
returns table (code text, label_ar text, pct numeric, ok boolean, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_promo subscription_promos;
begin
  select * into v_promo from subscription_promos sp where sp.code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return query select null::text, null::text, null::numeric, false, 'الكود ده مش موجود'::text;
  elsif not v_promo.is_active or v_promo.ends_at < current_date then
    return query select v_promo.code, null::text, null::numeric, false, 'الكود ده منتهي'::text;
  elsif v_promo.applies not in ('all', 'merchant') then
    return query select v_promo.code, null::text, null::numeric, false, 'الكود ده مش لنوع الاشتراك ده'::text;
  else
    return query select v_promo.code, v_promo.label_ar, v_promo.pct, true, null::text;
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

revoke all on function public.register_merchant(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], text
) from public;
revoke all on function public.merchant_promo(text) from public;
revoke all on function public.merchant_subscribe(uuid, text, text, text) from public;

grant execute on function public.register_merchant(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], text
) to anon, authenticated;
grant execute on function public.merchant_promo(text) to anon, authenticated;
grant execute on function public.merchant_subscribe(uuid, text, text, text) to anon, authenticated;

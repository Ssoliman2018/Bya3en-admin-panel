-- Seller ("بيّاع") sign-up from the customer app's onboarding.
-- The app has no auth yet, so anon cannot touch public.affiliates directly; it calls
-- register_affiliate() which only ever inserts a *pending* applicant for admin review
-- (shown under البيّاعين → طلبات جديدة in the admin panel).
-- Only a masked phone + a hash for duplicate detection are stored, never the raw number.
alter table public.affiliates
  add column if not exists payout_method varchar(16),
  add column if not exists phone_hash text;

create unique index if not exists affiliates_phone_hash_key on public.affiliates (phone_hash) where phone_hash is not null;

create or replace function public.register_affiliate(
  p_name text,
  p_phone text,
  p_governorate text,
  p_payout_method text
)
returns table (code text, status public.affiliate_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_code text;
begin
  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_payout_method is not null and p_payout_method not in ('vf', 'ip', 'bank') then
    raise exception 'invalid_payout_method' using errcode = '22023';
  end if;
  if exists (select 1 from affiliates a where a.phone_hash = md5(v_phone)) then
    raise exception 'phone_taken' using errcode = '23505';
  end if;

  loop
    v_code := 'BY' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from affiliates a where a.code = v_code);
  end loop;

  insert into affiliates (code, name, phone_masked, phone_hash, governorate, payout_method, status, membership_tier)
  values (
    v_code,
    v_name,
    substr(v_phone, 1, 3) || ' •••• ' || substr(v_phone, 8, 4),
    md5(v_phone),
    nullif(btrim(coalesce(p_governorate, '')), ''),
    p_payout_method,
    'pending',
    'starter'
  );

  return query select v_code, 'pending'::public.affiliate_status;
end;
$$;

revoke all on function public.register_affiliate(text, text, text, text) from public;
grant execute on function public.register_affiliate(text, text, text, text) to anon, authenticated;

-- Public storefront info for the customer app ("بواسطة …", the store card on product details).
-- merchants itself stays admin-only; this view exposes only non-sensitive columns of active merchants
-- and runs with the owner's rights so anon can read it without a merchants RLS policy.
create or replace view public.merchant_storefronts
with (security_invoker = false) as
select id, store_name, city, governorate, category_id
from public.merchants
where status = 'active';

comment on view public.merchant_storefronts is 'Customer-facing merchant fields (no contact, legal or fee data).';

revoke all on public.merchant_storefronts from public;
grant select on public.merchant_storefronts to anon, authenticated;

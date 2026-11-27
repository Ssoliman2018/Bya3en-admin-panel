-- Home "الأكثر رواجاً": products opt in with a rank; search_growth_pct is the
-- "البحث عنه زاد X%" figure shown under the name.
alter table public.products
  add column if not exists trending_rank integer,
  add column if not exists search_growth_pct integer;

create index if not exists products_trending_rank_idx
  on public.products (trending_rank)
  where trending_rank is not null;

insert into public.products (
  slug, name_ar, name_en, brand, category_id, owner_type, status,
  price_egp, compare_at_price_egp, cost_egp, stock, commission_rate,
  rating, reviews_count, sold_count, tags
)
values
  ('xiaomi-redmi-note-14-pro-256', 'شاومي ريدمي نوت 14 برو، 256 جيجا', 'Xiaomi Redmi Note 14 Pro 256GB', 'Xiaomi', 'mobiles', 'bayya3een', 'live',
    14499, 15999, 11600, 45, 3, 4.6, 932, 2100, '{موبايل}'),
  ('xiaomi-smart-band-9', 'سمارت باند شاومي 9، شاشة AMOLED', 'Xiaomi Smart Band 9', 'Xiaomi', 'electronics', 'bayya3een', 'live',
    1899, 2199, 1520, 90, 8, 4.5, 1430, 2900, '{ساعات}'),
  ('abu-auf-turkish-coffee-250', 'بن تركي محوّج أبو عوف 250 جم', 'Abu Auf Turkish Coffee 250g', 'Abu Auf', 'market', 'bayya3een', 'live',
    210, null, 160, 400, 5, 4.8, 2400, 9800, '{سوبرماركت,الأكثر مبيعاً}')
on conflict (slug) do nothing;

insert into public.product_media (product_id, url, sort_order, alt_ar)
select p.id, 'http://127.0.0.1:54321/storage/v1/object/public/product_images/' || p.slug || '.png', 0, p.name_ar
from public.products p
where p.slug in ('xiaomi-redmi-note-14-pro-256', 'xiaomi-smart-band-9', 'abu-auf-turkish-coffee-250')
  and not exists (select 1 from public.product_media m where m.product_id = p.id);

update public.products p
set trending_rank = t.rank, search_growth_pct = t.growth
from (
  values
    ('xiaomi-redmi-note-14-pro-256', 1, 220),
    ('tornado-airfryer-5-5l', 2, 180),
    ('xiaomi-smart-band-9', 3, 140),
    ('abu-auf-turkish-coffee-250', 4, 95)
) as t (slug, rank, growth)
where p.slug = t.slug;

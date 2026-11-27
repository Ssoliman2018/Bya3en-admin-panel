-- Product card fields (home "الأكثر مبيعاً" grid and listings):
--   fast_delivery  → "يوصل بكرة" (else delivery in 3 days)
--   free_shipping  → "· مجاناً"
--   badge_ar       → dark corner label shown when the product has no discount
alter table public.products
  add column if not exists fast_delivery boolean not null default false,
  add column if not exists free_shipping boolean not null default false,
  add column if not exists badge_ar varchar(40);

insert into public.products (
  slug, name_ar, name_en, brand, category_id, owner_type, status,
  price_egp, compare_at_price_egp, cost_egp, stock, commission_rate,
  rating, reviews_count, sold_count, tags
)
values
  ('anker-powercore-20000', 'باور بانك أنكر 20000 مللي أمبير شحن سريع', 'Anker PowerCore 20000', 'Anker', 'electronics', 'bayya3een', 'live',
    1450, null, 1160, 85, 10, 4.8, 990, 2300, '{إكسسوارات}'),
  ('activ-running-sneaker', 'كوتشي رياضي أكتيف خفيف للجري', 'Activ Running Sneaker', 'Activ', 'men', 'bayya3een', 'live',
    1299, 1599, 1040, 60, 10, 4.4, 520, 1100, '{أحذية}'),
  ('eva-vitamin-c-serum-30', 'سيروم إيفا فيتامين C للتفتيح 30 مل', 'Eva Vitamin C Serum 30ml', 'Eva', 'beauty', 'bayya3een', 'live',
    185, 220, 148, 200, 15, 4.3, 870, 3800, '{عناية}'),
  ('crystal-sunflower-oil-2-2l', 'زيت عباد الشمس كريستال 2.2 لتر', 'Crystal Sunflower Oil 2.2L', 'Crystal', 'market', 'bayya3een', 'live',
    189, null, 150, 500, 4, 4.7, 1200, 7400, '{سوبرماركت}')
on conflict (slug) do nothing;

insert into public.product_media (product_id, url, sort_order, alt_ar)
select p.id, 'http://127.0.0.1:54321/storage/v1/object/public/product_images/' || p.slug || '.png', 0, p.name_ar
from public.products p
where p.slug in ('anker-powercore-20000', 'activ-running-sneaker', 'eva-vitamin-c-serum-30', 'crystal-sunflower-oil-2-2l')
  and not exists (select 1 from public.product_media m where m.product_id = p.id);

update public.products p
set fast_delivery = f.fast, free_shipping = f.free, badge_ar = f.badge
from (
  values
    ('samsung-galaxy-a56-5g-256', true, true, 'الأكثر مبيعاً'),
    ('xiaomi-redmi-note-14-pro-256', true, true, null),
    ('anker-soundcore-p20i', true, true, 'عرض'),
    ('jbl-tune-520bt', false, true, null),
    ('xiaomi-smart-band-9', true, false, null),
    ('anker-powercore-20000', true, false, null),
    ('zahran-granite-cookware-10', false, true, 'صناعة مصرية'),
    ('tornado-airfryer-5-5l', true, true, 'عرض'),
    ('salma-crepe-abaya', true, false, null),
    ('cottonil-egyptian-cotton-tee', true, false, 'صناعة مصرية'),
    ('activ-running-sneaker', false, true, null),
    ('eva-vitamin-c-serum-30', true, false, 'صناعة مصرية'),
    ('abu-auf-turkish-coffee-250', true, false, 'الأكثر مبيعاً'),
    ('crystal-sunflower-oil-2-2l', true, false, null),
    ('speed-king-rc-car-4x4', false, false, null)
) as f (slug, fast, free, badge)
where p.slug = f.slug;

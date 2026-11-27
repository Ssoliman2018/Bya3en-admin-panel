-- Home "عروض النهارده" (flash deals): products opt in with a rank; null = not a flash deal.
alter table public.products
  add column if not exists flash_deal_rank integer;

create index if not exists products_flash_deal_rank_idx
  on public.products (flash_deal_rank)
  where flash_deal_rank is not null;

-- Public storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product_images',
  'product_images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set public = excluded.public;

drop policy if exists product_images_storage_public_read on storage.objects;
create policy product_images_storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product_images');

drop policy if exists product_images_storage_auth_write on storage.objects;
create policy product_images_storage_auth_write
  on storage.objects for all
  to authenticated
  using (bucket_id = 'product_images')
  with check (bucket_id = 'product_images');

-- Prototype catalog items used on the home screen.
-- Images: upload supabase/seed-assets/products/<slug>.png to the product_images bucket.
insert into public.products (
  slug, name_ar, name_en, brand, category_id, owner_type, status,
  price_egp, compare_at_price_egp, cost_egp, stock, commission_rate,
  rating, reviews_count, sold_count, tags, flash_deal_rank
)
values
  ('anker-soundcore-p20i', 'سماعة أنكر ساوند كور P20i لاسلكية بلوتوث', 'Anker Soundcore P20i', 'Anker', 'electronics', 'bayya3een', 'live',
    1099, 1399, 880, 120, 10, 4.6, 2210, 5400, '{سماعات,عرض}', 1),
  ('tornado-airfryer-5-5l', 'قلاية هوائية تورنيدو 5.5 لتر ديجيتال', 'Tornado Air Fryer 5.5L', 'Tornado', 'kitchen', 'bayya3een', 'live',
    3999, 4699, 3200, 60, 7, 4.6, 1120, 2600, '{مطبخ,عرض}', 2),
  ('salma-crepe-abaya', 'عباية كريب كاجوال بأكمام واسعة', 'Crepe Casual Abaya', 'Salma Style', 'women', 'bayya3een', 'live',
    650, 850, 520, 80, 15, 4.5, 318, 1400, '{أزياء}', 3),
  ('samsung-galaxy-a56-5g-256', 'سامسونج جالاكسي A56 5G، رام 8 جيجا، 256 جيجا', 'Samsung Galaxy A56 5G 256GB', 'Samsung', 'mobiles', 'bayya3een', 'live',
    21999, 23999, 17600, 40, 3, 4.7, 1284, 3200, '{موبايل,الأكثر مبيعاً}', 4),
  ('cottonil-egyptian-cotton-tee', 'تيشيرت كوتونيل قطن مصري 100%', 'Cottonil Egyptian Cotton Tee', 'Cottonil', 'men', 'bayya3een', 'live',
    349, 399, 280, 300, 12, 4.6, 1530, 6200, '{أزياء,صناعة مصرية}', 5),
  ('speed-king-rc-car-4x4', 'عربية ريموت كنترول 4×4 شحن USB', 'Speed King RC Car 4x4', 'Speed King', 'toys', 'bayya3een', 'live',
    899, 1099, 720, 50, 12, 4.4, 280, 760, '{ألعاب}', 6),
  ('zahran-granite-cookware-10', 'طقم حلل جرانيت زهران 10 قطع', 'Zahran Granite Cookware 10pc', 'Zahran', 'kitchen', 'bayya3een', 'live',
    4850, 5600, 3880, 35, 10, 4.8, 740, 1300, '{مطبخ,صناعة مصرية}', null)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  price_egp = excluded.price_egp,
  compare_at_price_egp = excluded.compare_at_price_egp,
  commission_rate = excluded.commission_rate,
  status = excluded.status,
  flash_deal_rank = excluded.flash_deal_rank;

insert into public.product_media (product_id, url, sort_order, alt_ar)
select p.id,
       'http://127.0.0.1:54321/storage/v1/object/public/product_images/' || p.slug || '.png',
       0,
       p.name_ar
from public.products p
where p.slug in (
  'anker-soundcore-p20i', 'tornado-airfryer-5-5l', 'salma-crepe-abaya', 'samsung-galaxy-a56-5g-256',
  'cottonil-egyptian-cotton-tee', 'speed-king-rc-car-4x4', 'zahran-granite-cookware-10'
)
and not exists (select 1 from public.product_media m where m.product_id = p.id);

/*
 * Bayya3een | بياعين — Seed product images for mobile/admin catalog
 * Uses stable Unsplash CDN URLs (demo only).
 */

insert into public.product_media (product_id, url, sort_order, alt_ar)
select p.id, v.url, v.sort_order, v.alt_ar
from public.products p
join (
  values
    ('iphone-15-128',
     'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80',
     0, 'آيفون 15'),
    ('iphone-15-128',
     'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
     1, 'آيفون — زاوية أخرى'),
    ('airpods-pro-2',
     'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80',
     0, 'إيربودز'),
    ('airfryer-5l',
     'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
     0, 'قلاية هوائية'),
    ('wireless-mouse-pro',
     'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
     0, 'ماوس لاسلكي'),
    ('merchant-galaxy-a54',
     'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80',
     0, 'سامسونج جالاكسي'),
    ('merchant-realme-c75',
     'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80',
     0, 'ريلمي'),
    ('merchant-abaya-navy',
     'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
     0, 'عباية')
) as v(slug, url, sort_order, alt_ar)
  on p.slug = v.slug
where not exists (
  select 1 from public.product_media m
  where m.product_id = p.id and m.url = v.url
);

-- Fallback: any live product still without media gets a category stock photo
insert into public.product_media (product_id, url, sort_order, alt_ar)
select
  p.id,
  case p.category_id
    when 'mobiles' then 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
    when 'electronics' then 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
    when 'kitchen' then 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80'
    when 'women' then 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80'
    when 'men' then 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=800&q=80'
    when 'beauty' then 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80'
    when 'market' then 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'
    when 'toys' then 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=800&q=80'
    else 'https://images.unsplash.com/photo-1472851294609-38361726a5e3?auto=format&fit=crop&w=800&q=80'
  end,
  0,
  p.name_ar
from public.products p
where p.status = 'live'
  and not exists (
    select 1 from public.product_media m where m.product_id = p.id
  );

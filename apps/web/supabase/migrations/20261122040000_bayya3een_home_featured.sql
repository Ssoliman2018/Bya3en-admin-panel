/*
 * Bayya3een | بياعين — Home "مختارات بياعين" (featured bento)
 * sort_order 0 is the tall card; 1 and 2 stack beside it.
 */

create table if not exists public.home_featured (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products (id) on delete cascade,
  label_ar varchar(60) not null,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_featured_active_sort_idx
  on public.home_featured (is_active, sort_order);

alter table public.home_featured enable row level security;

drop policy if exists home_featured_public_read on public.home_featured;
create policy home_featured_public_read
  on public.home_featured for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists home_featured_authenticated_write on public.home_featured;
create policy home_featured_authenticated_write
  on public.home_featured for all
  to authenticated
  using (true)
  with check (true);

grant select on public.home_featured to anon, authenticated;
grant all on public.home_featured to authenticated, service_role;

insert into public.products (
  slug, name_ar, name_en, brand, category_id, owner_type, status,
  price_egp, compare_at_price_egp, cost_egp, stock, commission_rate,
  rating, reviews_count, sold_count, tags
)
values
  ('jbl-tune-520bt', 'سماعة رأس JBL Tune 520BT لاسلكية', 'JBL Tune 520BT', 'JBL', 'electronics', 'bayya3een', 'live',
    2499, 2899, 2000, 70, 8, 4.7, 880, 1600, '{سماعات}')
on conflict (slug) do nothing;

insert into public.product_media (product_id, url, sort_order, alt_ar)
select p.id, 'http://127.0.0.1:54321/storage/v1/object/public/product_images/jbl-tune-520bt.png', 0, p.name_ar
from public.products p
where p.slug = 'jbl-tune-520bt'
  and not exists (select 1 from public.product_media m where m.product_id = p.id);

-- Images: upload supabase/seed-assets/products/*-scene.png to the product_images bucket.
insert into public.home_featured (product_id, label_ar, image_url, sort_order)
select p.id, f.label_ar, f.image_url, f.sort_order
from (
  values
    ('zahran-granite-cookware-10', 'صناعة مصرية',
      'http://127.0.0.1:54321/storage/v1/object/public/product_images/zahran-granite-cookware-10-scene.png', 0),
    ('jbl-tune-520bt', 'اختيار المحررين', null, 1),
    ('salma-crepe-abaya', 'وصل جديد',
      'http://127.0.0.1:54321/storage/v1/object/public/product_images/salma-crepe-abaya-scene.png', 2)
) as f (slug, label_ar, image_url, sort_order)
join public.products p on p.slug = f.slug
where not exists (select 1 from public.home_featured);

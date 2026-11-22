/*
 * Bayya3een | بياعين — Home ad banners (mobile slider)
 * Managed from admin /home/banners
 */

create table if not exists public.home_banners (
  id uuid primary key default extensions.uuid_generate_v4(),
  brand_ar varchar(120) not null,
  title_ar varchar(160) not null,
  subtitle_ar varchar(255),
  price_label_ar varchar(80),
  cta_ar varchar(80) not null default 'اشتري دلوقتي',
  image_url text not null,
  bg_color varchar(16) not null default '#5B2B9E',
  link_type varchar(20) not null default 'none'
    check (link_type in ('none', 'product', 'category', 'url')),
  link_value text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_banners_active_sort_idx
  on public.home_banners (is_active, sort_order);

alter table public.home_banners enable row level security;

create policy home_banners_public_read
  on public.home_banners for select
  to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy home_banners_authenticated_write
  on public.home_banners for all
  to authenticated
  using (true)
  with check (true);

grant select on public.home_banners to anon, authenticated;
grant all on public.home_banners to authenticated, service_role;

-- Public storage bucket for banner images (local demo + admin uploads later)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home_banners',
  'home_banners',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set public = excluded.public;

drop policy if exists home_banners_storage_public_read on storage.objects;
create policy home_banners_storage_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'home_banners');

drop policy if exists home_banners_storage_auth_write on storage.objects;
create policy home_banners_storage_auth_write
  on storage.objects for all
  to authenticated
  using (bucket_id = 'home_banners')
  with check (bucket_id = 'home_banners');

-- Seed uses local Supabase Storage URLs (upload seed files after reset,
-- or paste any public image URL from admin /home/banners).
insert into public.home_banners (
  brand_ar, title_ar, subtitle_ar, price_label_ar, cta_ar,
  image_url, bg_color, link_type, link_value, sort_order
)
select * from (
  values
    (
      'إعلان · SAMSUNG',
      'Galaxy A56 5G',
      'كاميرا 50MP · شاشة 120Hz',
      'من 19,499 EGP',
      'اشتري دلوقتي',
      'http://127.0.0.1:54321/storage/v1/object/public/home_banners/samsung.png',
      '#5B2B9E',
      'category',
      'mobiles',
      0
    ),
    (
      'الجمعة البيضاء · لحد 30 نوفمبر',
      'خصومات لحد 50%',
      'على المطبخ: قلايات وحلل وخلاطات',
      null,
      'تسوّق العروض',
      'http://127.0.0.1:54321/storage/v1/object/public/home_banners/kitchen.png',
      '#7A3A00',
      'category',
      'kitchen',
      1
    ),
    (
      'أسبوع الصوت · Anker · JBL',
      'سماعات أصلية',
      'بضمان وتوصيل مجاني',
      'من 1,099 EGP',
      'اكتشف السماعات',
      'http://127.0.0.1:54321/storage/v1/object/public/home_banners/audio.png',
      '#0A4B6E',
      'category',
      'electronics',
      2
    )
) as v(
  brand_ar, title_ar, subtitle_ar, price_label_ar, cta_ar,
  image_url, bg_color, link_type, link_value, sort_order
)
where not exists (select 1 from public.home_banners limit 1);

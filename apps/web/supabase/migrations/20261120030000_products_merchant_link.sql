/*
 * Link merchant-owned products to merchants + richer demo catalog
 */

alter table public.products
  add column if not exists merchant_id uuid references public.merchants (id);

create index if not exists products_merchant_id_idx
  on public.products (merchant_id);

-- Attach existing merchant demo products to real merchants when possible
update public.products p
set merchant_id = m.id
from public.merchants m
where p.owner_type = 'merchant'
  and p.merchant_id is null
  and (
    (p.slug = 'merchant-galaxy-a55' and m.store_name = 'موبايل زون')
    or (p.slug = 'merchant-perfume-oud' and m.store_name = 'أتيليه نور')
    or (p.slug = 'merchant-kids-car' and m.store_name = 'بيت المطبخ')
  );

insert into public.products (
  slug, name_ar, brand, description_ar, category_id,
  owner_type, merchant_id, status, price_egp, compare_at_price_egp, cost_egp,
  stock, commission_rate, is_hidden, tags
)
select
  v.slug,
  v.name_ar,
  v.brand,
  v.description_ar,
  v.category_id,
  'merchant'::public.product_owner_type,
  m.id,
  v.status::public.product_status,
  v.price_egp,
  v.compare_at_price_egp,
  null,
  v.stock,
  v.commission_rate,
  false,
  v.tags
from (
  values
    (
      'merchant-galaxy-a54',
      'سامسونج جالاكسي A54',
      'Samsung',
      'موبايل تاجر · ظاهر للعملاء',
      'mobiles',
      'live',
      21999::numeric,
      23999::numeric,
      18,
      3::numeric,
      array['موبايل', 'تاجر']::text[]
    ),
    (
      'merchant-realme-c75',
      'ريلمي C75',
      'realme',
      'موبايل تاجر · ظاهر للعملاء',
      'mobiles',
      'live',
      7299::numeric,
      null::numeric,
      80,
      4::numeric,
      array['موبايل', 'تاجر']::text[]
    ),
    (
      'merchant-airpods-copy',
      'إيربودز برو (تاجر)',
      'SoundMax',
      'سماعات تاجر بانتظار المراجعة',
      'electronics',
      'under_review',
      1899::numeric,
      2299::numeric,
      25,
      6::numeric,
      array['سماعات']::text[]
    ),
    (
      'merchant-abaya-navy',
      'عباية كحلي مطرزة',
      'سلمى ستايل',
      'منتج تاجر ظاهر',
      'women',
      'live',
      1199::numeric,
      1499::numeric,
      40,
      10::numeric,
      array['أزياء']::text[]
    )
) as v(
  slug,
  name_ar,
  brand,
  description_ar,
  category_id,
  status,
  price_egp,
  compare_at_price_egp,
  stock,
  commission_rate,
  tags
)
join public.merchants m on (
  (v.slug in ('merchant-galaxy-a54', 'merchant-realme-c75') and m.store_name = 'موبايل زون')
  or (v.slug = 'merchant-airpods-copy' and m.store_name = 'تك زون')
  or (v.slug = 'merchant-abaya-navy' and m.store_name = 'سلمى ستايل')
)
on conflict (slug) do nothing;

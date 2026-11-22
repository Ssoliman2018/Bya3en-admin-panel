/*
 * Bayya3een | بياعين — Demo catalog products for local admin
 */

insert into public.products (
  slug, name_ar, name_en, brand, description_ar, category_id,
  owner_type, status, price_egp, compare_at_price_egp, cost_egp,
  stock, commission_rate, is_hidden, tags
) values
  (
    'iphone-15-128',
    'آيفون 15 — 128GB',
    'iPhone 15 128GB',
    'Apple',
    'موبايل آيفون 15 رسمي · ضمان سنة · شحن مجاني داخل القاهرة.',
    'mobiles',
    'bayya3een',
    'live',
    42999,
    45999,
    38500,
    24,
    4.5,
    false,
    array['موبايل', 'آيفون']
  ),
  (
    'airpods-pro-2',
    'إيربودز برو 2',
    'AirPods Pro 2',
    'Apple',
    'سماعات لاسلكية مع عزل ضوضاء فعّال.',
    'electronics',
    'bayya3een',
    'live',
    12499,
    13999,
    10200,
    40,
    6,
    false,
    array['سماعات']
  ),
  (
    'airfryer-5l',
    'قلاية هوائية 5 لتر',
    'Air Fryer 5L',
    'Bayya3een Home',
    'قلاية هوائية بقدرة عالية · سهلة التنظيف.',
    'kitchen',
    'bayya3een',
    'live',
    2899,
    3499,
    1950,
    18,
    8,
    false,
    array['مطبخ']
  ),
  (
    'abaya-black-m',
    'عباية سوداء كلاسيك',
    'Classic Black Abaya',
    'Bayya3een Wear',
    'عباية خامة مريحة · مقاسات متعددة.',
    'women',
    'bayya3een',
    'draft',
    899,
    null,
    420,
    12,
    10,
    false,
    array['أزياء']
  ),
  (
    'merchant-galaxy-a55',
    'سامسونج جالاكسي A55',
    'Samsung Galaxy A55',
    'Samsung',
    'منتج تاجر · مستني مراجعة الإدارة قبل الظهور للعملاء.',
    'mobiles',
    'merchant',
    'under_review',
    18999,
    19999,
    null,
    8,
    5,
    false,
    array['موبايل', 'تاجر']
  ),
  (
    'merchant-perfume-oud',
    'عطر عود ملكي 100مل',
    'Royal Oud 100ml',
    'Nour Beauty',
    'عطر تاجر · صور ومنتج بانتظار الموافقة.',
    'beauty',
    'merchant',
    'under_review',
    749,
    899,
    null,
    30,
    12,
    false,
    array['عطور']
  ),
  (
    'merchant-kids-car',
    'عربية أطفال ريموت',
    'Kids RC Car',
    'ToyLand',
    'منتج تاجر مرفوض سابقًا بسبب صور غير واضحة.',
    'toys',
    'merchant',
    'rejected',
    1299,
    null,
    null,
    5,
    9,
    false,
    array['ألعاب']
  ),
  (
    'wireless-mouse-pro',
    'ماوس لاسلكي برو',
    'Wireless Mouse Pro',
    'Bayya3een Tech',
    'مخزون خلصان — للإظهار في فلتر المخفية/خلصانة.',
    'electronics',
    'bayya3een',
    'live',
    449,
    599,
    210,
    0,
    7,
    false,
    array['إكسسوارات']
  )
on conflict (slug) do nothing;

update public.products
set rejection_reason = 'الصور مش واضحة · ضيف صور على خلفية بيضا'
where slug = 'merchant-kids-car'
  and rejection_reason is null;

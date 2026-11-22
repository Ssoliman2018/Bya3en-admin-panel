import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type CommissionSettings = {
  default_rate: number;
  hold_days: number;
  attr_days: number;
  min_withdraw_egp: number;
};

export type CategoryRate = {
  category_id: string;
  name_ar: string;
  rate_pct: number;
};

export type CommissionProduct = {
  id: string;
  name_ar: string;
  brand: string | null;
  owner_type: string;
  price_egp: number;
  commission_rate: number | null;
  category_id: string;
  category_name: string | null;
  category_rate: number;
};

export type MerchantFeeRow = {
  id: string;
  store_name: string;
  marketplace_fee_pct: number;
  status: string;
};

export type CampaignRow = {
  id: string;
  code: string;
  name_ar: string;
  category_id: string;
  category_name: string | null;
  extra_rate_pct: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type EligibilityRow = {
  key: string;
  label_ar: string;
  is_enabled: boolean;
  is_locked: boolean;
};

export type ChangeLogRow = {
  id: string;
  what: string;
  who: string;
  created_at: string;
};

export type ReversalRow = {
  date: string;
  order_code: string;
  affiliate_code: string;
  amount: number;
  reason: string;
};

export async function loadCommissionBundle() {
  const client = getSupabaseServerClient();

  const [
    settingsRes,
    catRatesRes,
    categoriesRes,
    productsRes,
    merchantsRes,
    campaignsRes,
    eligRes,
    logRes,
    ordersRes,
  ] = await Promise.all([
    client.from('commission_settings' as never).select('*').eq('id', 'default').maybeSingle(),
    client.from('category_commission_rates' as never).select('category_id, rate_pct'),
    client.from('categories').select('id, name_ar').order('sort_order'),
    client
      .from('products')
      .select(
        'id, name_ar, brand, owner_type, price_egp, commission_rate, category_id, categories(name_ar)',
      )
      .order('created_at', { ascending: false })
      .limit(40),
    client
      .from('merchants')
      .select('id, store_name, marketplace_fee_pct, status')
      .neq('status', 'pending')
      .order('store_name'),
    client
      .from('commission_campaigns' as never)
      .select(
        'id, code, name_ar, category_id, extra_rate_pct, starts_at, ends_at, is_active',
      )
      .order('starts_at', { ascending: false }),
    client
      .from('commission_eligibility' as never)
      .select('key, label_ar, is_enabled, is_locked')
      .order('sort_order'),
    client
      .from('commission_change_log' as never)
      .select('id, what, who, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    client
      .from('orders' as never)
      .select('code, affiliate_code, total_egp, status, created_at')
      .not('affiliate_code', 'is', null)
      .in('status', ['cancelled', 'returned', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (catRatesRes.error) throw catRatesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (productsRes.error) throw productsRes.error;
  if (merchantsRes.error) throw merchantsRes.error;
  if (campaignsRes.error) throw campaignsRes.error;
  if (eligRes.error) throw eligRes.error;
  if (logRes.error) throw logRes.error;

  const settingsRow = settingsRes.data as unknown as Record<string, unknown> | null;
  const settings: CommissionSettings = {
    default_rate: Number(settingsRow?.default_rate ?? 8),
    hold_days: Number(settingsRow?.hold_days ?? 14),
    attr_days: Number(settingsRow?.attr_days ?? 7),
    min_withdraw_egp: Number(settingsRow?.min_withdraw_egp ?? 200),
  };

  const catRateMap = new Map(
    ((catRatesRes.data as unknown as Array<{ category_id: string; rate_pct: number }>) ?? []).map(
      (r) => [r.category_id, Number(r.rate_pct)],
    ),
  );

  const categories =
    (categoriesRes.data as unknown as Array<{ id: string; name_ar: string }>) ??
    [];

  const categoryRates: CategoryRate[] = categories.map((c) => ({
    category_id: c.id,
    name_ar: c.name_ar,
    rate_pct: catRateMap.get(c.id) ?? settings.default_rate,
  }));

  const products: CommissionProduct[] = (
    (productsRes.data as unknown as Record<string, unknown>[]) ?? []
  ).map((p) => {
    const cats = p.categories;
    const category_name = Array.isArray(cats)
      ? ((cats[0] as { name_ar?: string } | undefined)?.name_ar ?? null)
      : ((cats as { name_ar?: string } | null)?.name_ar ?? null);

    return {
      id: String(p.id),
      name_ar: String(p.name_ar),
      brand: (p.brand as string | null) ?? null,
      owner_type: String(p.owner_type),
      price_egp: Number(p.price_egp),
      commission_rate:
        p.commission_rate == null ? null : Number(p.commission_rate),
      category_id: String(p.category_id),
      category_name,
      category_rate:
        catRateMap.get(String(p.category_id)) ?? settings.default_rate,
    };
  });

  const merchants: MerchantFeeRow[] = (
    (merchantsRes.data as unknown as MerchantFeeRow[]) ?? []
  ).map((m) => ({
    ...m,
    marketplace_fee_pct: Number(m.marketplace_fee_pct),
  }));

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name_ar]));

  const campaigns: CampaignRow[] = (
    (campaignsRes.data as unknown as Record<string, unknown>[]) ?? []
  ).map((c) => {
    const category_id = String(c.category_id);
    return {
      id: String(c.id),
      code: String(c.code),
      name_ar: String(c.name_ar),
      category_id,
      category_name: categoryNameMap.get(category_id) ?? null,
      extra_rate_pct: Number(c.extra_rate_pct),
      starts_at: String(c.starts_at),
      ends_at: String(c.ends_at),
      is_active: Boolean(c.is_active),
    };
  });

  const eligibility =
    (eligRes.data as unknown as EligibilityRow[]) ?? [];
  const changeLog =
    (logRes.data as unknown as ChangeLogRow[]) ?? [];

  const statusAr: Record<string, string> = {
    cancelled: 'ملغي',
    returned: 'مرتجع',
    refunded: 'اترد المبلغ',
  };

  const reversals: ReversalRow[] = ordersRes.error
    ? []
    : ((ordersRes.data as unknown as Array<{
        code: string;
        affiliate_code: string;
        total_egp: number;
        status: string;
        created_at: string;
      }>) ?? []).map((o) => ({
        date: o.created_at,
        order_code: o.code,
        affiliate_code: o.affiliate_code,
        amount: Math.round(Number(o.total_egp) * 0.07),
        reason: statusAr[o.status] ?? o.status,
      }));

  return {
    settings,
    categoryRates,
    categories,
    products,
    merchants,
    campaigns,
    eligibility,
    changeLog,
    reversals,
    activeCampaigns: campaigns.filter((c) => c.is_active).length,
  };
}

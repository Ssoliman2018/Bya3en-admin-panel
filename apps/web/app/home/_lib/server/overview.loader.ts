import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function loadOverviewStats() {
  const client = getSupabaseServerClient();

  const [productsRes, merchantsRes, ordersRes, affiliatesRes, wdRes] =
    await Promise.all([
      client
        .from('products')
        .select('id, owner_type, status, is_hidden, price_egp, cost_egp, stock'),
      client.from('merchants').select('id, status'),
      client.from('orders' as never).select('id, status'),
      client.from('affiliates' as never).select('id, status'),
      client.from('affiliate_withdrawals' as never).select('id, status'),
    ]);

  if (productsRes.error) {
    throw productsRes.error;
  }

  if (merchantsRes.error) {
    throw merchantsRes.error;
  }

  const orders =
    ordersRes.error
      ? []
      : ((ordersRes.data as unknown as Array<{ id: string; status: string }>) ??
        []);
  const affiliates =
    affiliatesRes.error
      ? []
      : ((affiliatesRes.data as unknown as Array<{
          id: string;
          status: string;
        }>) ?? []);
  const withdrawals =
    wdRes.error
      ? []
      : ((wdRes.data as unknown as Array<{ id: string; status: string }>) ?? []);

  const products = productsRes.data ?? [];
  const merchants = merchantsRes.data ?? [];

  const liveProducts = products.filter(
    (p) => p.status === 'live' && !p.is_hidden,
  );
  const bayya3eenLive = liveProducts.filter((p) => p.owner_type === 'bayya3een');
  const catalogValue = liveProducts.reduce(
    (sum, p) => sum + Number(p.price_egp) * Number(p.stock || 0),
    0,
  );
  const bayya3eenCost = bayya3eenLive.reduce(
    (sum, p) => sum + Number(p.cost_egp || 0) * Number(p.stock || 0),
    0,
  );

  return {
    liveProducts: liveProducts.length,
    bayya3eenProducts: products.filter((p) => p.owner_type === 'bayya3een')
      .length,
    merchantProducts: products.filter((p) => p.owner_type === 'merchant')
      .length,
    productsUnderReview: products.filter((p) => p.status === 'under_review')
      .length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    activeMerchants: merchants.filter((m) => m.status === 'active').length,
    pendingMerchants: merchants.filter((m) => m.status === 'pending').length,
    catalogValue,
    bayya3eenCost,
    newOrders: orders.filter((o) => o.status === 'new').length,
    openOrders: orders.filter((o) =>
      ['new', 'confirmed', 'processing', 'shipped'].includes(o.status),
    ).length,
    pendingAffiliates: affiliates.filter((a) => a.status === 'pending').length,
    pendingWithdrawals: withdrawals.filter((w) => w.status === 'pending')
      .length,
  };
}

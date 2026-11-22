import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type CustomerRow = {
  id: string;
  name: string;
  governorate: string;
  ordersCount: number;
  spentEgp: number;
  returnsCount: number;
  lastOrderAt: string;
  lastOrderCode: string | null;
  phoneMasked: string;
};

export type CustomersSummary = {
  total: number;
  active90: number;
  newThisMonth: number;
  avgOrderValue: number;
  returnRatePct: number;
};

type OrderAgg = {
  id: string;
  code: string;
  customer_name: string;
  governorate: string;
  status: string;
  total_egp: number;
  created_at: string;
};

function maskPhone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 10000;
  }
  const tail = String(hash).padStart(4, '0');
  return `01• •••• ${tail}`;
}

export async function loadCustomers() {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('orders')
    .select(
      'id, code, customer_name, governorate, status, total_egp, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const orders = (data ?? []) as OrderAgg[];
  const map = new Map<string, CustomerRow>();

  for (const order of orders) {
    const key = `${order.customer_name}|${order.governorate}`;
    const existing = map.get(key);
    const isReturn = ['returned', 'refunded'].includes(order.status);

    if (!existing) {
      map.set(key, {
        id: key,
        name: order.customer_name,
        governorate: order.governorate,
        ordersCount: 1,
        spentEgp: Number(order.total_egp),
        returnsCount: isReturn ? 1 : 0,
        lastOrderAt: order.created_at,
        lastOrderCode: order.code,
        phoneMasked: maskPhone(key),
      });
      continue;
    }

    existing.ordersCount += 1;
    existing.spentEgp += Number(order.total_egp);
    if (isReturn) existing.returnsCount += 1;

    if (new Date(order.created_at) > new Date(existing.lastOrderAt)) {
      existing.lastOrderAt = order.created_at;
      existing.lastOrderCode = order.code;
    }
  }

  const customers = [...map.values()].sort((a, b) => b.spentEgp - a.spentEgp);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const totalOrders = orders.length;
  const returnedOrders = orders.filter((o) =>
    ['returned', 'refunded'].includes(o.status),
  ).length;
  const gmv = orders.reduce((sum, o) => sum + Number(o.total_egp), 0);

  const summary: CustomersSummary = {
    total: customers.length,
    active90: customers.filter((c) => new Date(c.lastOrderAt) >= ninetyDaysAgo)
      .length,
    newThisMonth: customers.filter(
      (c) =>
        new Date(c.lastOrderAt) >= monthStart &&
        // first-seen approximation: only one order and it landed this month
        c.ordersCount === 1,
    ).length,
    avgOrderValue: totalOrders ? gmv / totalOrders : 0,
    returnRatePct: totalOrders
      ? Math.round((returnedOrders / totalOrders) * 1000) / 10
      : 0,
  };

  return { customers, summary };
}

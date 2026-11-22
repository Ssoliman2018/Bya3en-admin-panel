import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  ORDER_STATUSES,
  type OrderFilter,
  type OrderStatus,
} from '../orders.constants';

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  merchant_id: string | null;
  product_name_ar: string;
  unit_price_egp: number;
  qty: number;
  status: OrderStatus;
  merchants: { id: string; store_name: string } | null;
};

export type OrderRow = {
  id: string;
  code: string;
  customer_name: string;
  governorate: string;
  payment_method: string;
  status: OrderStatus;
  affiliate_code: string | null;
  shipping_fee_egp: number;
  subtotal_egp: number;
  total_egp: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  order_items: OrderItemRow[];
};

function normalizeItem(row: Record<string, unknown>): OrderItemRow {
  const merchants = row.merchants;

  return {
    id: String(row.id),
    product_id: (row.product_id as string | null) ?? null,
    merchant_id: (row.merchant_id as string | null) ?? null,
    product_name_ar: String(row.product_name_ar),
    unit_price_egp: Number(row.unit_price_egp),
    qty: Number(row.qty),
    status: row.status as OrderStatus,
    merchants: Array.isArray(merchants)
      ? ((merchants[0] as OrderItemRow['merchants']) ?? null)
      : ((merchants as OrderItemRow['merchants']) ?? null),
  };
}

function normalizeOrder(row: Record<string, unknown>): OrderRow {
  const items = Array.isArray(row.order_items) ? row.order_items : [];

  return {
    id: String(row.id),
    code: String(row.code),
    customer_name: String(row.customer_name),
    governorate: String(row.governorate),
    payment_method: String(row.payment_method),
    status: row.status as OrderStatus,
    affiliate_code: (row.affiliate_code as string | null) ?? null,
    shipping_fee_egp: Number(row.shipping_fee_egp),
    subtotal_egp: Number(row.subtotal_egp),
    total_egp: Number(row.total_egp),
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    cancelled_at: (row.cancelled_at as string | null) ?? null,
    order_items: items.map((item) =>
      normalizeItem(item as Record<string, unknown>),
    ),
  };
}

const ORDER_SELECT = `
  id, code, customer_name, governorate, payment_method, status,
  affiliate_code, shipping_fee_egp, subtotal_egp, total_egp, notes,
  created_at, confirmed_at, cancelled_at,
  order_items (
    id, product_id, merchant_id, product_name_ar, unit_price_egp, qty, status,
    merchants ( id, store_name )
  )
`;

export async function loadOrders(filter: OrderFilter = 'all') {
  const client = getSupabaseServerClient();

  let query = client
    .from('orders' as never)
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data as unknown as Record<string, unknown>[]) ?? []).map(
    normalizeOrder,
  );
}

export async function loadOrder(orderId: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('orders' as never)
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeOrder(data as unknown as Record<string, unknown>);
}

export async function loadOrderCounts() {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('orders' as never)
    .select('status');

  if (error) {
    throw error;
  }

  const rows = (data as unknown as Array<{ status: OrderStatus }>) ?? [];
  const counts: Record<OrderFilter, number> = {
    all: rows.length,
    new: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
    refunded: 0,
  };

  for (const row of rows) {
    if (ORDER_STATUSES.includes(row.status)) {
      counts[row.status] += 1;
    }
  }

  return counts;
}

export type { OrderFilter };

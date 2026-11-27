import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type ProductFilter =
  | 'all'
  | 'bayya3een'
  | 'merchant'
  | 'review'
  | 'hidden';

export type CatalogProduct = {
  id: string;
  name_ar: string;
  brand: string | null;
  description_ar: string | null;
  price_egp: number;
  seller_price_egp: number | null;
  compare_at_price_egp: number | null;
  cost_egp: number | null;
  stock: number;
  status: string;
  owner_type: string;
  is_hidden: boolean;
  commission_rate: number | null;
  rejection_reason: string | null;
  category_id: string;
  created_at: string;
  categories: { name_ar: string } | null;
  merchants: { id: string; store_name: string; status: string } | null;
};

function normalizeProduct(row: Record<string, unknown>): CatalogProduct {
  const categories = row.categories;
  const merchants = row.merchants;

  return {
    ...(row as Omit<CatalogProduct, 'categories' | 'merchants'>),
    categories: Array.isArray(categories)
      ? ((categories[0] as CatalogProduct['categories']) ?? null)
      : ((categories as CatalogProduct['categories']) ?? null),
    merchants: Array.isArray(merchants)
      ? ((merchants[0] as CatalogProduct['merchants']) ?? null)
      : ((merchants as CatalogProduct['merchants']) ?? null),
  };
}

const PRODUCT_SELECT =
  'id, name_ar, brand, description_ar, price_egp, seller_price_egp, compare_at_price_egp, cost_egp, stock, status, owner_type, is_hidden, commission_rate, rejection_reason, category_id, created_at, categories(name_ar), merchants(id, store_name, status)';

export async function loadProducts(
  filter: ProductFilter = 'all',
  options: { q?: string; categoryId?: string } = {},
) {
  const client = getSupabaseServerClient();

  let query = client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });

  if (filter === 'bayya3een') {
    query = query.eq('owner_type', 'bayya3een');
  } else if (filter === 'merchant') {
    query = query.eq('owner_type', 'merchant').neq('status', 'under_review');
  } else if (filter === 'review') {
    query = query.eq('status', 'under_review');
  } else if (filter === 'hidden') {
    query = query.or('is_hidden.eq.true,status.eq.hidden,stock.eq.0');
  }

  if (options.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  if (options.q?.trim()) {
    const q = options.q.trim();
    query = query.or(
      `name_ar.ilike.%${q}%,brand.ilike.%${q}%,description_ar.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    normalizeProduct(row as Record<string, unknown>),
  );
}

export async function loadProductCounts() {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('products')
    .select('owner_type, status, is_hidden, stock');

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  return {
    all: rows.length,
    bayya3een: rows.filter((r) => r.owner_type === 'bayya3een').length,
    merchant: rows.filter(
      (r) => r.owner_type === 'merchant' && r.status !== 'under_review',
    ).length,
    review: rows.filter((r) => r.status === 'under_review').length,
    hidden: rows.filter(
      (r) => r.is_hidden || r.status === 'hidden' || r.stock === 0,
    ).length,
  };
}

export async function loadCategories() {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('categories')
    .select('id, name_ar')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function loadProduct(productId: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('products')
    .select(
      'id, slug, name_ar, name_en, brand, description_ar, category_id, owner_type, merchant_account_id, merchant_id, status, price_egp, seller_price_egp, compare_at_price_egp, cost_egp, stock, commission_rate, is_hidden, rejection_reason, tags, created_at, updated_at, categories(name_ar), merchants(id, store_name, status)',
    )
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeProduct(data as Record<string, unknown>);
}

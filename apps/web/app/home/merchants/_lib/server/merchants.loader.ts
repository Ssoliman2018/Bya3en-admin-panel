import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

type MerchantStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export async function loadMerchants(status?: string) {
  const client = getSupabaseServerClient();

  let query = client
    .from('merchants')
    .select(
      'id, store_name, legal_name, contact_name, phone, email, city, governorate, marketplace_fee_pct, status, category_id, created_at, categories(name_ar)',
    )
    .order('created_at', { ascending: false });

  if (
    status &&
    status !== 'all' &&
    ['pending', 'active', 'suspended', 'rejected'].includes(status)
  ) {
    query = query.eq('status', status as MerchantStatus);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    ...row,
    categories: Array.isArray(row.categories)
      ? (row.categories[0] ?? null)
      : row.categories,
  }));
}

export async function loadMerchantCounts() {
  const client = getSupabaseServerClient();
  const { data, error } = await client.from('merchants').select('status');

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  return {
    all: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    active: rows.filter((r) => r.status === 'active').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  };
}

export async function loadMerchant(merchantId: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('merchants')
    .select(
      'id, store_name, legal_name, contact_name, phone, email, city, governorate, marketplace_fee_pct, status, category_id, rejection_reason, national_id_masked, tax_id_masked, cr_number, notes, created_at, reviewed_at, categories(name_ar)',
    )
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    categories: Array.isArray(data.categories)
      ? (data.categories[0] ?? null)
      : data.categories,
  };
}

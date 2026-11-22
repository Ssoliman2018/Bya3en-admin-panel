import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { AffiliateFilter, AffiliateStatus } from '../affiliates.constants';

export type AffiliateRow = {
  id: string;
  code: string;
  name: string;
  phone_masked: string | null;
  governorate: string | null;
  status: AffiliateStatus;
  membership_tier: string;
  clicks_30d: number;
  orders_count: number;
  earnings_egp: number;
  pending_egp: number;
  flags: string[];
  suspend_reason: string | null;
  is_live_demo: boolean;
  joined_at: string;
};

export type WithdrawalRow = {
  id: string;
  code: string;
  affiliate_id: string;
  amount_egp: number;
  method: string;
  account_masked: string | null;
  status: string;
  risk_flag: boolean;
  rejection_reason: string | null;
  requested_at: string;
  paid_at: string | null;
  affiliates: { code: string; name: string } | null;
};

function normalizeAffiliate(row: Record<string, unknown>): AffiliateRow {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    phone_masked: (row.phone_masked as string | null) ?? null,
    governorate: (row.governorate as string | null) ?? null,
    status: row.status as AffiliateStatus,
    membership_tier: String(row.membership_tier),
    clicks_30d: Number(row.clicks_30d),
    orders_count: Number(row.orders_count),
    earnings_egp: Number(row.earnings_egp),
    pending_egp: Number(row.pending_egp),
    flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
    suspend_reason: (row.suspend_reason as string | null) ?? null,
    is_live_demo: Boolean(row.is_live_demo),
    joined_at: String(row.joined_at),
  };
}

function normalizeWithdrawal(row: Record<string, unknown>): WithdrawalRow {
  const affiliates = row.affiliates;

  return {
    id: String(row.id),
    code: String(row.code),
    affiliate_id: String(row.affiliate_id),
    amount_egp: Number(row.amount_egp),
    method: String(row.method),
    account_masked: (row.account_masked as string | null) ?? null,
    status: String(row.status),
    risk_flag: Boolean(row.risk_flag),
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    requested_at: String(row.requested_at),
    paid_at: (row.paid_at as string | null) ?? null,
    affiliates: Array.isArray(affiliates)
      ? ((affiliates[0] as WithdrawalRow['affiliates']) ?? null)
      : ((affiliates as WithdrawalRow['affiliates']) ?? null),
  };
}

export async function loadAffiliates(filter: AffiliateFilter = 'all') {
  const client = getSupabaseServerClient();

  let query = client
    .from('affiliates' as never)
    .select(
      'id, code, name, phone_masked, governorate, status, membership_tier, clicks_30d, orders_count, earnings_egp, pending_egp, flags, suspend_reason, is_live_demo, joined_at',
    )
    .order('joined_at', { ascending: false });

  if (filter === 'pending' || filter === 'suspended') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let rows = ((data as unknown as Record<string, unknown>[]) ?? []).map(
    normalizeAffiliate,
  );

  if (filter === 'flagged') {
    rows = rows.filter((a) => a.flags.length > 0);
  }

  return rows;
}

export async function loadAffiliateCounts() {
  const client = getSupabaseServerClient();

  const [affRes, wdRes] = await Promise.all([
    client
      .from('affiliates' as never)
      .select('status, flags'),
    client
      .from('affiliate_withdrawals' as never)
      .select('status'),
  ]);

  if (affRes.error) throw affRes.error;
  if (wdRes.error) throw wdRes.error;

  const affiliates =
    (affRes.data as unknown as Array<{ status: string; flags: string[] }>) ??
    [];
  const withdrawals =
    (wdRes.data as unknown as Array<{ status: string }>) ?? [];

  return {
    all: affiliates.length,
    pending: affiliates.filter((a) => a.status === 'pending').length,
    flagged: affiliates.filter((a) => (a.flags?.length ?? 0) > 0).length,
    suspended: affiliates.filter((a) => a.status === 'suspended').length,
    wd: withdrawals.filter((w) => w.status === 'pending').length,
    active: affiliates.filter((a) => a.status === 'active').length,
  };
}

export async function loadWithdrawals() {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('affiliate_withdrawals' as never)
    .select(
      'id, code, affiliate_id, amount_egp, method, account_masked, status, risk_flag, rejection_reason, requested_at, paid_at, affiliates ( code, name )',
    )
    .order('requested_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as unknown as Record<string, unknown>[]) ?? []).map(
    normalizeWithdrawal,
  );
}

export type { AffiliateFilter };

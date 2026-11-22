import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function loadFinanceBundle() {
  const client = getSupabaseServerClient();

  const [monthsRes, settleRes, reconRes, ledgerRes, wdRes] = await Promise.all([
    client.from('finance_months' as never).select('*').order('month_index'),
    client
      .from('merchant_settlements' as never)
      .select('*')
      .order('created_at', { ascending: false }),
    client.from('finance_recon' as never).select('*').order('recon_date', { ascending: false }),
    client
      .from('finance_ledger' as never)
      .select('*')
      .order('tx_date', { ascending: false })
      .limit(60),
    client
      .from('affiliate_withdrawals' as never)
      .select('id, status, amount_egp')
      .eq('status', 'pending'),
  ]);

  if (monthsRes.error) throw monthsRes.error;
  if (settleRes.error) throw settleRes.error;
  if (reconRes.error) throw reconRes.error;
  if (ledgerRes.error) throw ledgerRes.error;

  const months = (
    (monthsRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((m) => ({
    ...m,
    gmv: Number(m.gmv),
    own_sales: Number(m.own_sales),
    merchant_sales: Number(m.merchant_sales),
    marketplace_fee: Number(m.marketplace_fee),
    cogs: Number(m.cogs),
    refunds: Number(m.refunds),
    affiliate_expense: Number(m.affiliate_expense),
    gateway_fees: Number(m.gateway_fees),
    opex: Number(m.opex),
    sub_merchant: Number(m.sub_merchant),
    sub_affiliate: Number(m.sub_affiliate),
    payables: Number(m.payables),
    net_revenue: Number(m.net_revenue),
    gross_profit: Number(m.gross_profit),
    net_profit: Number(m.net_profit),
    orders_count: Number(m.orders_count),
  }));

  const settlements = (
    (settleRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((s) => ({
    ...s,
    gross_egp: Number(s.gross_egp),
    fee_egp: Number(s.fee_egp),
    refund_egp: Number(s.refund_egp),
    net_egp: Number(s.net_egp),
  }));

  const recon = (
    (reconRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((r) => ({
    ...r,
    gateway_egp: Number(r.gateway_egp),
    ledger_egp: Number(r.ledger_egp),
    diff_egp: Number(r.diff_egp),
  }));

  const ledger = (
    (ledgerRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((l) => ({ ...l, amount_egp: Number(l.amount_egp) }));

  const pendingWd =
    (wdRes.data as unknown as Array<{ amount_egp: number }>) ?? [];

  const latest = months[months.length - 1];
  const sum = (key: keyof (typeof months)[number]) =>
    months.reduce((a, m) => a + Number(m[key] ?? 0), 0);

  return {
    months,
    settlements,
    recon,
    ledger,
    latest,
    totals: {
      gmv: sum('gmv'),
      fee: sum('marketplace_fee'),
      own: sum('own_sales'),
      subs: sum('sub_merchant') + sum('sub_affiliate'),
      aff: sum('affiliate_expense'),
      payables: sum('payables'),
      refunds: sum('refunds'),
      opex: sum('opex'),
      net: sum('net_profit'),
      netRev: sum('net_revenue'),
    },
    counts: {
      dueSettlements: settlements.filter((s) => s.status === 'due').length,
      reconDiff: recon.filter((r) => r.status === 'diff').length,
      pendingWd: pendingWd.length,
      pendingWdAmount: pendingWd.reduce((a, w) => a + Number(w.amount_egp), 0),
    },
  };
}

import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

function daysLeft(endsAt: string) {
  const end = new Date(endsAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function subState(status: string, endsAt: string) {
  if (status === 'cancelled') return 'cancelled';
  const left = daysLeft(endsAt);
  if (left < 0) return 'expired';
  if (left <= 14) return 'expiring';
  return 'active';
}

export async function loadSubscriptionsBundle() {
  const client = getSupabaseServerClient();

  const [pkgRes, subRes, payRes, promoRes, policyRes] = await Promise.all([
    client.from('subscription_packages' as never).select('*').order('party_type').order('price_egp'),
    client.from('subscriptions' as never).select('*').order('ends_at'),
    client
      .from('subscription_payments' as never)
      .select('*')
      .order('paid_at', { ascending: false }),
    client.from('subscription_promos' as never).select('*').order('code'),
    client.from('subscription_policy' as never).select('*').eq('id', 'default').maybeSingle(),
  ]);

  if (pkgRes.error) throw pkgRes.error;
  if (subRes.error) throw subRes.error;
  if (payRes.error) throw payRes.error;
  if (promoRes.error) throw promoRes.error;
  if (policyRes.error) throw policyRes.error;

  const packages = (pkgRes.data as unknown as Array<Record<string, unknown>>) ?? [];
  const subscriptions = (
    (subRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((s) => ({
    ...s,
    price_egp: Number(s.price_egp),
    days_left: daysLeft(String(s.ends_at)),
    computed_status: subState(String(s.status), String(s.ends_at)),
  }));

  const payments = (
    (payRes.data as unknown as Array<Record<string, unknown>>) ?? []
  ).map((p) => ({ ...p, amount_egp: Number(p.amount_egp) }));

  const promos = (promoRes.data as unknown as Array<Record<string, unknown>>) ?? [];
  const policy = (policyRes.data as unknown as Record<string, unknown>) ?? {
    merchant_expiry: 'grace_then_hide',
    merchant_grace: 7,
    affiliate_links: 'grace_then_pause',
    affiliate_grace: 7,
    downgrade: 'next_cycle',
    reminders: [14, 7, 1],
  };

  return {
    packages,
    subscriptions,
    payments,
    promos,
    policy,
    counts: {
      packages: packages.length,
      subscriptions: subscriptions.length,
      expiring: subscriptions.filter((s) => s.computed_status === 'expiring').length,
      payments: payments.length,
      promos: promos.filter((p) => p.is_active).length,
    },
  };
}

'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

function revalidate() {
  revalidatePath(pathsConfig.app.subscriptions);
}

export const togglePackageAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('subscription_packages' as never)
      .update({ is_active: data.isActive, updated_at: new Date().toISOString() } as never)
      .eq('id', data.packageId);
    if (error) throw new Error(error.message);
    revalidate();
    return { success: true };
  },
  { schema: z.object({ packageId: z.string(), isActive: z.boolean() }) },
);

export const togglePromoAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('subscription_promos' as never)
      .update({ is_active: data.isActive } as never)
      .eq('code', data.code);
    if (error) throw new Error(error.message);
    revalidate();
    return { success: true };
  },
  { schema: z.object({ code: z.string(), isActive: z.boolean() }) },
);

export const refundSubscriptionPaymentAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('subscription_payments' as never)
      .update({
        status: 'refunded',
        note: data.reason || 'استرداد تجريبي',
      } as never)
      .eq('id', data.paymentId);
    if (error) throw new Error(error.message);
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      paymentId: z.string().uuid(),
      reason: z.string().optional(),
    }),
  },
);

export const saveSubscriptionPolicyAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('subscription_policy' as never)
      .upsert({
        id: 'default',
        merchant_expiry: data.merchantExpiry,
        merchant_grace: data.merchantGrace,
        affiliate_links: data.affiliateLinks,
        affiliate_grace: data.affiliateGrace,
        downgrade: data.downgrade,
        reminders: data.reminders,
        updated_at: new Date().toISOString(),
      } as never);
    if (error) throw new Error(error.message);
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      merchantExpiry: z.string(),
      merchantGrace: z.coerce.number().int().min(0).max(60),
      affiliateLinks: z.string(),
      affiliateGrace: z.coerce.number().int().min(0).max(60),
      downgrade: z.string(),
      reminders: z.array(z.number()),
    }),
  },
);

export const extendSubscriptionAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: sub, error: loadError } = await client
      .from('subscriptions' as never)
      .select('ends_at, status')
      .eq('id', data.subscriptionId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    const current = (sub as { ends_at?: string; status?: string } | null)?.ends_at;
    const base = current ? new Date(current) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setDate(base.getDate() + 30);
    const { error } = await client
      .from('subscriptions' as never)
      .update({
        ends_at: base.toISOString().slice(0, 10),
        status: 'active',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', data.subscriptionId);
    if (error) throw new Error(error.message);
    revalidate();
    return { success: true };
  },
  { schema: z.object({ subscriptionId: z.string().uuid() }) },
);

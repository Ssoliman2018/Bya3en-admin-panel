'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

async function logChange(
  client: ReturnType<typeof getSupabaseServerClient>,
  what: string,
) {
  await client.from('commission_change_log' as never).insert({
    what,
    who: 'الإدارة',
  } as never);
}

function revalidate() {
  revalidatePath(pathsConfig.app.commissions);
  revalidatePath(pathsConfig.app.home);
}

export const saveCommissionRulesAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('commission_settings' as never)
      .upsert({
        id: 'default',
        default_rate: data.defaultRate,
        hold_days: data.holdDays,
        attr_days: data.attrDays,
        min_withdraw_egp: data.minWithdrawEgp,
        updated_at: new Date().toISOString(),
      } as never);

    if (error) throw new Error(error.message);

    await logChange(client, 'تحديث القواعد العامة');
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      defaultRate: z.coerce.number().min(0).max(100),
      holdDays: z.coerce.number().int().min(0).max(90),
      attrDays: z.coerce.number().int().min(0).max(60),
      minWithdrawEgp: z.coerce.number().min(0),
    }),
  },
);

export const updateCategoryRateAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('category_commission_rates' as never)
      .upsert({
        category_id: data.categoryId,
        rate_pct: data.ratePct,
        updated_at: new Date().toISOString(),
      } as never);

    if (error) throw new Error(error.message);

    await logChange(
      client,
      `نسبة القسم ${data.categoryId} بقت ${data.ratePct}%`,
    );
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      categoryId: z.string().min(1),
      ratePct: z.coerce.number().min(0).max(100),
    }),
  },
);

export const updateCommissionProductRateAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: product, error: loadError } = await client
      .from('products')
      .select('name_ar, commission_rate')
      .eq('id', data.productId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);

    const { error } = await client
      .from('products')
      .update({
        commission_rate: data.ratePct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.productId);

    if (error) throw new Error(error.message);

    const name = product?.name_ar?.split('،')[0] ?? 'منتج';
    const old = product?.commission_rate ?? '—';
    await logChange(
      client,
      `عمولة "${name}" من ${old}% لـ ${data.ratePct}%`,
    );
    revalidatePath(pathsConfig.app.products);
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      productId: z.string().uuid(),
      ratePct: z.coerce.number().min(0).max(100),
    }),
  },
);

export const updateCommissionMerchantFeeAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: merchant } = await client
      .from('merchants')
      .select('store_name')
      .eq('id', data.merchantId)
      .maybeSingle();

    const { error } = await client
      .from('merchants')
      .update({
        marketplace_fee_pct: data.feePct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.merchantId);

    if (error) throw new Error(error.message);

    await logChange(
      client,
      `رسوم ${merchant?.store_name ?? 'تاجر'} بقت ${data.feePct}%`,
    );
    revalidatePath(pathsConfig.app.merchants);
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      merchantId: z.string().uuid(),
      feePct: z.coerce.number().min(0).max(100),
    }),
  },
);

export const toggleCampaignAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('commission_campaigns' as never)
      .update({
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', data.campaignId);

    if (error) throw new Error(error.message);

    await logChange(
      client,
      data.isActive ? 'تفعيل حملة عمولة' : 'إيقاف حملة عمولة',
    );
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      campaignId: z.string().uuid(),
      isActive: z.boolean(),
    }),
  },
);

export const createCampaignAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const code = `CMP-${Math.floor(100 + Math.random() * 900)}`;

    const start = new Date();
    start.setDate(start.getDate() + data.startsInDays);
    const end = new Date(start);
    end.setDate(end.getDate() + data.durationDays);

    const { error } = await client.from('commission_campaigns' as never).insert({
      code,
      name_ar: data.nameAr,
      category_id: data.categoryId,
      extra_rate_pct: data.extraRatePct,
      starts_at: start.toISOString().slice(0, 10),
      ends_at: end.toISOString().slice(0, 10),
      is_active: true,
    } as never);

    if (error) throw new Error(error.message);

    await logChange(client, `إنشاء حملة "${data.nameAr}"`);
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      nameAr: z.string().min(3).max(180),
      categoryId: z.string().min(1),
      extraRatePct: z.coerce.number().min(0).max(50),
      startsInDays: z.coerce.number().int().min(0).max(60),
      durationDays: z.coerce.number().int().min(1).max(90),
    }),
  },
);

export const toggleEligibilityAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: row } = await client
      .from('commission_eligibility' as never)
      .select('is_locked, label_ar')
      .eq('key', data.key)
      .maybeSingle();

    const locked = (row as { is_locked?: boolean } | null)?.is_locked;
    if (locked) {
      throw new Error('القاعدة دي ثابتة ومش قابلة للتعديل');
    }

    const { error } = await client
      .from('commission_eligibility' as never)
      .update({
        is_enabled: data.isEnabled,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('key', data.key);

    if (error) throw new Error(error.message);

    await logChange(
      client,
      `${data.isEnabled ? 'تفعيل' : 'إيقاف'} · ${(row as { label_ar?: string } | null)?.label_ar ?? data.key}`,
    );
    revalidate();
    return { success: true };
  },
  {
    schema: z.object({
      key: z.string().min(1),
      isEnabled: z.boolean(),
    }),
  },
);

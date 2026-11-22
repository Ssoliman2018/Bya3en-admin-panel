'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

const UpdateMerchantStatusSchema = z.object({
  merchantId: z.string().uuid(),
  status: z.enum(['pending', 'active', 'suspended', 'rejected']),
  rejectionReason: z.string().optional(),
});

export const updateMerchantStatusAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('merchants')
      .update({
        status: data.status,
        rejection_reason:
          data.status === 'rejected' ? data.rejectionReason || null : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.merchantId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.merchants);
    revalidatePath(pathsConfig.app.home);
    revalidatePath(`/home/merchants/${data.merchantId}`);

    return { success: true };
  },
  {
    schema: UpdateMerchantStatusSchema,
  },
);

const UpdateMerchantFeeSchema = z.object({
  merchantId: z.string().uuid(),
  marketplaceFeePct: z.coerce.number().min(0).max(100),
  notes: z.string().trim().optional(),
});

export const updateMerchantFeeAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('merchants')
      .update({
        marketplace_fee_pct: data.marketplaceFeePct,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.merchantId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.merchants);
    revalidatePath(`/home/merchants/${data.merchantId}`);

    return { success: true };
  },
  {
    schema: UpdateMerchantFeeSchema,
  },
);

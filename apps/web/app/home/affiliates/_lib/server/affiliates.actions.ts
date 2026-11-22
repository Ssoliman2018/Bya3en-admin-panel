'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

import { AFFILIATE_STATUSES } from '../affiliates.constants';

const UpdateAffiliateStatusSchema = z.object({
  affiliateId: z.string().uuid(),
  status: z.enum(AFFILIATE_STATUSES),
  suspendReason: z.string().optional(),
});

export const updateAffiliateStatusAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    };

    if (data.status === 'suspended') {
      patch.suspend_reason =
        data.suspendReason || 'موقوف بقرار الإدارة لمراجعة مؤشرات احتيال';
    } else if (data.status === 'active') {
      patch.suspend_reason = null;
    }

    const { error } = await client
      .from('affiliates' as never)
      .update(patch as never)
      .eq('id', data.affiliateId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.affiliates);
    revalidatePath(pathsConfig.app.home);

    return { success: true };
  },
  {
    schema: UpdateAffiliateStatusSchema,
  },
);

const UpdateWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid(),
  status: z.enum(['withdrawn', 'cancelled']),
  rejectionReason: z.string().optional(),
});

export const updateWithdrawalStatusAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.status === 'withdrawn') {
      patch.paid_at = new Date().toISOString();
      patch.rejection_reason = null;
    }

    if (data.status === 'cancelled') {
      patch.rejection_reason =
        data.rejectionReason ||
        'بيانات الحساب مش مطابقة لاسم البيّاع. المبلغ رجع لرصيدك.';
    }

    const { error } = await client
      .from('affiliate_withdrawals' as never)
      .update(patch as never)
      .eq('id', data.withdrawalId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.affiliates);
    revalidatePath(pathsConfig.app.home);

    return { success: true };
  },
  {
    schema: UpdateWithdrawalSchema,
  },
);

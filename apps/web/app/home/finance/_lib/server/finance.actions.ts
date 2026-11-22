'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

export const paySettlementAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('merchant_settlements' as never)
      .update({
        status: 'paid',
        settled_at: new Date().toISOString().slice(0, 10),
      } as never)
      .eq('id', data.settlementId);
    if (error) throw new Error(error.message);
    revalidatePath(pathsConfig.app.finance);
    return { success: true };
  },
  { schema: z.object({ settlementId: z.string().uuid() }) },
);

export const matchReconAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: row } = await client
      .from('finance_recon' as never)
      .select('gateway_egp')
      .eq('id', data.reconId)
      .maybeSingle();

    const gateway = Number(
      (row as { gateway_egp?: number } | null)?.gateway_egp ?? 0,
    );

    const { error } = await client
      .from('finance_recon' as never)
      .update({
        status: 'matched',
        ledger_egp: gateway,
        diff_egp: 0,
        note: null,
      } as never)
      .eq('id', data.reconId);

    if (error) throw new Error(error.message);
    revalidatePath(pathsConfig.app.finance);
    return { success: true };
  },
  { schema: z.object({ reconId: z.string().uuid() }) },
);

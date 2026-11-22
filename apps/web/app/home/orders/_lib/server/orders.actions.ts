'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

import { ORDER_STATUSES, type OrderStatus } from '../orders.constants';

const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

function applyItemStatuses(
  currentItemStatus: OrderStatus,
  nextOrderStatus: OrderStatus,
): OrderStatus {
  if (['cancelled', 'returned', 'refunded'].includes(nextOrderStatus)) {
    return nextOrderStatus;
  }

  if (nextOrderStatus === 'confirmed' && currentItemStatus === 'new') {
    return 'confirmed';
  }

  return currentItemStatus;
}

export const updateOrderStatusAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const next = data.status as OrderStatus;

    const { data: items, error: itemsError } = await client
      .from('order_items' as never)
      .select('id, status')
      .eq('order_id', data.orderId);

    if (itemsError) {
      throw itemsError;
    }

    const rows =
      (items as unknown as Array<{ id: string; status: OrderStatus }>) ?? [];

    for (const item of rows) {
      const itemStatus = applyItemStatuses(item.status, next);
      if (itemStatus === item.status) continue;

      const { error } = await client
        .from('order_items' as never)
        .update({ status: itemStatus, updated_at: new Date().toISOString() } as never)
        .eq('id', item.id);

      if (error) {
        throw error;
      }
    }

    const patch: Record<string, unknown> = {
      status: next,
      updated_at: new Date().toISOString(),
    };

    if (next === 'confirmed') {
      patch.confirmed_at = new Date().toISOString();
    }

    if (next === 'cancelled') {
      patch.cancelled_at = new Date().toISOString();
    }

    const { error } = await client
      .from('orders' as never)
      .update(patch as never)
      .eq('id', data.orderId);

    if (error) {
      throw error;
    }

    revalidatePath(pathsConfig.app.orders);
    revalidatePath(pathsConfig.app.home);

    return { success: true };
  },
  {
    schema: UpdateOrderStatusSchema,
  },
);

'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

import {
  CreateBayya3eenProductSchema,
  UpdateBayya3eenProductSchema,
} from '../schema/create-product.schema';

function slugifyArabic(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .slice(0, 80);
}

async function resolveAuthUserId(
  client: ReturnType<typeof getSupabaseServerClient>,
) {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user?.id) {
    return null;
  }

  return data.user.id;
}

export const createBayya3eenProductAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const authUserId = await resolveAuthUserId(client);

    const slugBase = slugifyArabic(data.nameAr) || `product-${Date.now()}`;
    const slug = `${slugBase}-${Math.floor(Math.random() * 900 + 100)}`;

    const { data: inserted, error } = await client
      .from('products')
      .insert({
        name_ar: data.nameAr,
        brand: data.brand || null,
        category_id: data.categoryId,
        owner_type: 'bayya3een',
        status: data.status,
        price_egp: data.priceEgp,
        compare_at_price_egp: data.compareAtPriceEgp ?? null,
        cost_egp: data.costEgp,
        stock: data.stock,
        commission_rate: data.commissionRate ?? null,
        description_ar: data.descriptionAr || null,
        slug,
        created_by: authUserId,
        updated_by: authUserId,
        is_hidden: false,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.products);
    revalidatePath(pathsConfig.app.home);

    return { success: true as const, productId: inserted.id };
  },
  {
    schema: CreateBayya3eenProductSchema,
  },
);

const UpdateProductStatusSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(['draft', 'under_review', 'live', 'rejected', 'hidden']),
  isHidden: z.boolean().optional(),
  rejectionReason: z.string().optional(),
});

export const updateProductStatusAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const authUserId = await resolveAuthUserId(client);

    const { error } = await client
      .from('products')
      .update({
        status: data.status,
        is_hidden: data.isHidden ?? data.status === 'hidden',
        rejection_reason:
          data.status === 'rejected' ? data.rejectionReason || null : null,
        updated_by: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.productId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.products);
    revalidatePath(pathsConfig.app.home);
    revalidatePath(`/home/products/${data.productId}`);

    return { success: true };
  },
  {
    schema: UpdateProductStatusSchema,
  },
);

export const updateBayya3eenProductAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const authUserId = await resolveAuthUserId(client);

    const { data: existing, error: loadError } = await client
      .from('products')
      .select('id, owner_type')
      .eq('id', data.productId)
      .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (!existing) {
      throw new Error('المنتج غير موجود');
    }

    if (existing.owner_type !== 'bayya3een') {
      throw new Error('تعديل السعر والتكلفة متاح لمنتجات بياعين فقط');
    }

    const { error } = await client
      .from('products')
      .update({
        name_ar: data.nameAr,
        brand: data.brand || null,
        category_id: data.categoryId,
        price_egp: data.priceEgp,
        compare_at_price_egp: data.compareAtPriceEgp ?? null,
        cost_egp: data.costEgp,
        stock: data.stock,
        commission_rate: data.commissionRate ?? null,
        description_ar: data.descriptionAr || null,
        status: data.status,
        is_hidden: data.status === 'hidden',
        updated_by: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.productId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.products);
    revalidatePath(pathsConfig.app.home);
    revalidatePath(`/home/products/${data.productId}`);

    return { success: true };
  },
  {
    schema: UpdateBayya3eenProductSchema,
  },
);

const UpdateCommissionSchema = z.object({
  productId: z.string().uuid(),
  commissionRate: z.coerce.number().min(0).max(40),
});

/** Seller commission is derived from merchant customer/seller prices — admin cannot override. */
export const updateProductCommissionAction = enhanceAction(
  async () => {
    throw new Error(
      'عمولة البيّاع بتتحدد من فرق سعر العميل وسعر البيّاع اللي حاطه التاجر · مش قابلة للتعديل من الأدمن',
    );
  },
  {
    schema: UpdateCommissionSchema,
  },
);

const DeleteProductSchema = z.object({
  productId: z.string().uuid(),
});

export const deleteProductAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('products')
      .delete()
      .eq('id', data.productId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.products);
    revalidatePath(pathsConfig.app.home);

    return { success: true as const };
  },
  {
    schema: DeleteProductSchema,
  },
);

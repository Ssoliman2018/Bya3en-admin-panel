'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  BannerFormSchema,
  DeleteBannerSchema,
  ToggleBannerSchema,
} from '../schema/banner.schema';

function revalidateBanners() {
  revalidatePath(pathsConfig.app.banners);
  revalidatePath(pathsConfig.app.home);
}

export const upsertBannerAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const row = {
      brand_ar: data.brandAr,
      title_ar: data.titleAr,
      subtitle_ar: data.subtitleAr || null,
      price_label_ar: data.priceLabelAr || null,
      cta_ar: data.ctaAr,
      image_url: data.imageUrl,
      bg_color: data.bgColor,
      link_type: data.linkType,
      link_value: data.linkType === 'none' ? null : data.linkValue || null,
      sort_order: data.sortOrder,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await client
        .from('home_banners' as never)
        .update(row as never)
        .eq('id', data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client
        .from('home_banners' as never)
        .insert(row as never);
      if (error) throw new Error(error.message);
    }

    revalidateBanners();
    return { success: true as const };
  },
  { schema: BannerFormSchema },
);

export const toggleBannerAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('home_banners' as never)
      .update({
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    revalidateBanners();
    return { success: true as const };
  },
  { schema: ToggleBannerSchema },
);

export const deleteBannerAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('home_banners' as never)
      .delete()
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    revalidateBanners();
    return { success: true as const };
  },
  { schema: DeleteBannerSchema },
);

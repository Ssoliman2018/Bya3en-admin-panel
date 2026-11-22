import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type HomeBannerRow = {
  id: string;
  brand_ar: string;
  title_ar: string;
  subtitle_ar: string | null;
  price_label_ar: string | null;
  cta_ar: string;
  image_url: string;
  bg_color: string;
  link_type: 'none' | 'product' | 'category' | 'url';
  link_value: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadHomeBanners() {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('home_banners' as never)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as HomeBannerRow[];
}

export async function loadBannerCounts(banners: HomeBannerRow[]) {
  return {
    total: banners.length,
    active: banners.filter((b) => b.is_active).length,
    inactive: banners.filter((b) => !b.is_active).length,
  };
}

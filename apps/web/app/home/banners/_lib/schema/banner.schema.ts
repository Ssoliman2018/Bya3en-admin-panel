import { z } from 'zod';

export const BannerFormSchema = z.object({
  id: z.string().uuid().optional(),
  brandAr: z.string().min(2).max(120),
  titleAr: z.string().min(2).max(160),
  subtitleAr: z.string().max(255).optional().nullable(),
  priceLabelAr: z.string().max(80).optional().nullable(),
  ctaAr: z.string().min(2).max(80).default('اشتري دلوقتي'),
  imageUrl: z.string().url(),
  bgColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#5B2B9E'),
  linkType: z.enum(['none', 'product', 'category', 'url']).default('none'),
  linkValue: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const ToggleBannerSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export const DeleteBannerSchema = z.object({
  id: z.string().uuid(),
});

export type BannerFormValues = z.infer<typeof BannerFormSchema>;

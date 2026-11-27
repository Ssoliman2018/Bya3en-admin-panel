import { z } from 'zod';

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === '' || value == null) {
    return undefined;
  }

  return value;
}, z.coerce.number().positive().optional());

export const CreateBayya3eenProductSchema = z.object({
  nameAr: z.string().trim().min(3, 'اسم المنتج قصير جدًا'),
  brand: z.string().trim().optional(),
  categoryId: z.string().min(1, 'اختاري قسم'),
  priceEgp: z.coerce.number().positive('السعر لازم يكون أكبر من صفر'),
  compareAtPriceEgp: optionalPositiveNumber,
  costEgp: z.coerce.number().positive('تكلفة بياعين مطلوبة'),
  stock: z.coerce.number().int().min(0),
  commissionRate: z.preprocess((value) => {
    if (value === '' || value == null) {
      return undefined;
    }

    return value;
  }, z.coerce.number().min(2.5).max(15).optional()),
  descriptionAr: z.string().trim().optional(),
  status: z.enum(['draft', 'live']).default('live'),
});

export type CreateBayya3eenProductInput = z.infer<
  typeof CreateBayya3eenProductSchema
>;

export const UpdateBayya3eenProductSchema =
  CreateBayya3eenProductSchema.omit({ status: true }).extend({
    productId: z.string().uuid(),
    status: z.enum(['draft', 'live', 'hidden']),
  });

export type UpdateBayya3eenProductInput = z.infer<
  typeof UpdateBayya3eenProductSchema
>;

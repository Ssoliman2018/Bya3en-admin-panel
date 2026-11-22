'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { NativeSelect, NativeSelectOption } from '@kit/ui/native-select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { createBayya3eenProductAction } from '../_lib/server/products.actions';

type Category = {
  id: string;
  name_ar: string;
};

export function CreateProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          try {
            const compareAtRaw = String(
              formData.get('compareAtPriceEgp') ?? '',
            ).trim();
            const commissionRaw = String(
              formData.get('commissionRate') ?? '',
            ).trim();

            await createBayya3eenProductAction({
              nameAr: String(formData.get('nameAr') ?? ''),
              brand: String(formData.get('brand') ?? '') || undefined,
              categoryId: String(formData.get('categoryId') ?? ''),
              priceEgp: Number(formData.get('priceEgp')),
              compareAtPriceEgp: compareAtRaw
                ? Number(compareAtRaw)
                : undefined,
              costEgp: Number(formData.get('costEgp')),
              stock: Number(formData.get('stock') ?? 0),
              commissionRate: commissionRaw
                ? Number(commissionRaw)
                : undefined,
              descriptionAr:
                String(formData.get('descriptionAr') ?? '') || undefined,
              status: (formData.get('status') as 'draft' | 'live') ?? 'live',
            });

            toast.success('اتحفظ المنتج');
            router.push(pathsConfig.app.products);
            router.refresh();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'فشل حفظ المنتج';
            toast.error(message);
          }
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="nameAr">اسم المنتج (عربي)</Label>
        <Input id="nameAr" name="nameAr" required minLength={3} dir="rtl" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="brand">الماركة</Label>
        <Input id="brand" name="brand" dir="rtl" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="categoryId">القسم</Label>
        <NativeSelect
          id="categoryId"
          name="categoryId"
          required
          className="w-full"
          defaultValue={categories[0]?.id}
        >
          {categories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name_ar}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="priceEgp">سعر البيع (EGP)</Label>
          <Input
            id="priceEgp"
            name="priceEgp"
            type="number"
            min={1}
            step="0.01"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="compareAtPriceEgp">السعر قبل الخصم (اختياري)</Label>
          <Input
            id="compareAtPriceEgp"
            name="compareAtPriceEgp"
            type="number"
            min={1}
            step="0.01"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="costEgp">تكلفة بياعين (EGP)</Label>
          <Input
            id="costEgp"
            name="costEgp"
            type="number"
            min={1}
            step="0.01"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stock">المخزون</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={10}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="commissionRate">نسبة العمولة % (اختياري)</Label>
          <Input
            id="commissionRate"
            name="commissionRate"
            type="number"
            min={0}
            max={100}
            step="0.1"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">الحالة</Label>
          <NativeSelect
            id="status"
            name="status"
            className="w-full"
            defaultValue="live"
          >
            <NativeSelectOption value="live">منشور (live)</NativeSelectOption>
            <NativeSelectOption value="draft">مسودة</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="descriptionAr">الوصف</Label>
        <Textarea id="descriptionAr" name="descriptionAr" rows={4} dir="rtl" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'جاري الحفظ...' : 'حفظ منتج بياعين'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push(pathsConfig.app.products)}
        >
          إلغاء
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { NativeSelect, NativeSelectOption } from '@kit/ui/native-select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  updateBayya3eenProductAction,
  updateProductStatusAction,
} from '../_lib/server/products.actions';

import type { CatalogProduct } from '../_lib/server/products.loader';

type Category = { id: string; name_ar: string };

type Product = CatalogProduct;

const statusTone: Record<string, string> = {
  live: 'green',
  draft: 'violet',
  under_review: 'amber',
  rejected: 'red',
  hidden: 'blue',
};

const statusLabel: Record<string, string> = {
  live: 'منشور',
  draft: 'مسودة',
  under_review: 'قيد المراجعة',
  rejected: 'مرفوض',
  hidden: 'مخفي',
};

export function ProductDetailPanel({
  product,
  categories,
}: {
  product: Product;
  categories: Category[];
}) {
  const [pending, startTransition] = useTransition();
  const isBayya3een = product.owner_type === 'bayya3een';
  const margin =
    isBayya3een && product.cost_egp != null && Number(product.price_egp) > 0
      ? Math.round(
          ((Number(product.price_egp) - Number(product.cost_egp)) /
            Number(product.price_egp)) *
            100,
        )
      : null;

  function setStatus(
    status: 'live' | 'under_review' | 'rejected' | 'hidden' | 'draft',
    isHidden?: boolean,
  ) {
    startTransition(async () => {
      try {
        await updateProductStatusAction({
          productId: product.id,
          status,
          isHidden,
          rejectionReason:
            status === 'rejected'
              ? 'مرفوض من لوحة الإدارة بعد المراجعة'
              : undefined,
        });
        toast.success('اتحدثت حالة المنتج');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث الحالة',
        );
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div className="by-card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={isBayya3een ? 'by-own by' : 'by-own mr'}
          >
            {isBayya3een ? 'بياعين' : 'تاجر'}
          </span>
          <span className={`by-st ${statusTone[product.status] ?? 'violet'}`}>
            {statusLabel[product.status] ?? product.status}
          </span>
          {margin != null ? (
            <span className="text-muted-foreground text-xs font-semibold">
              هامش ≈ <span data-numeric>{margin}%</span>
            </span>
          ) : null}
        </div>

        {product.rejection_reason ? (
          <div className="rounded-xl border border-[#F3A9A3] bg-[#FDE7E5] px-3 py-2 text-sm font-medium text-[#B3261E]">
            سبب الرفض: {product.rejection_reason}
          </div>
        ) : null}

        {isBayya3een ? (
          <form
            className="flex flex-col gap-4"
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

                  await updateBayya3eenProductAction({
                    productId: product.id,
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
                    status: formData.get('status') as
                      | 'draft'
                      | 'live'
                      | 'under_review'
                      | 'rejected'
                      | 'hidden',
                  });
                  toast.success('اتحفظ المنتج');
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'فشل الحفظ',
                  );
                }
              });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="nameAr">اسم المنتج</Label>
              <Input
                id="nameAr"
                name="nameAr"
                required
                minLength={3}
                dir="rtl"
                defaultValue={product.name_ar}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="brand">الماركة</Label>
                <Input
                  id="brand"
                  name="brand"
                  dir="rtl"
                  defaultValue={product.brand ?? ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryId">القسم</Label>
                <NativeSelect
                  id="categoryId"
                  name="categoryId"
                  required
                  className="w-full"
                  defaultValue={product.category_id}
                >
                  {categories.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name_ar}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="priceEgp">سعر البيع</Label>
                <Input
                  id="priceEgp"
                  name="priceEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  defaultValue={Number(product.price_egp)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="compareAtPriceEgp">السعر قبل الخصم</Label>
                <Input
                  id="compareAtPriceEgp"
                  name="compareAtPriceEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  defaultValue={
                    product.compare_at_price_egp != null
                      ? Number(product.compare_at_price_egp)
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="costEgp">التكلفة</Label>
                <Input
                  id="costEgp"
                  name="costEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  defaultValue={
                    product.cost_egp != null
                      ? Number(product.cost_egp)
                      : undefined
                  }
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
                  required
                  defaultValue={product.stock}
                />
              </div>
              <div className="grid gap-2">
                <Label>عمولة البيّاع</Label>
                <div className="by-note flex h-10 items-center text-sm">
                  {product.commission_rate != null
                    ? `${Number(product.commission_rate)}%`
                    : '—'}
                  <span className="text-muted-foreground ms-2 text-xs">
                    للعرض فقط · منتجات التاجر من فرق السعرين
                  </span>
                </div>
                <input
                  type="hidden"
                  name="commissionRate"
                  value={
                    product.commission_rate != null
                      ? Number(product.commission_rate)
                      : 8
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">الحالة</Label>
              <NativeSelect
                id="status"
                name="status"
                className="w-full"
                defaultValue={product.status}
              >
                <NativeSelectOption value="live">منشور</NativeSelectOption>
                <NativeSelectOption value="draft">مسودة</NativeSelectOption>
                <NativeSelectOption value="hidden">مخفي</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descriptionAr">الوصف</Label>
              <Textarea
                id="descriptionAr"
                name="descriptionAr"
                rows={4}
                dir="rtl"
                defaultValue={product.description_ar ?? ''}
              />
            </div>

            <Button type="submit" disabled={pending}>
              {pending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </form>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                القسم
              </dt>
              <dd className="mt-1 font-semibold">
                {product.categories?.name_ar ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                الماركة
              </dt>
              <dd className="mt-1 font-semibold">{product.brand ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                السعر
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {Number(product.price_egp).toLocaleString()} EGP
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                المخزون
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {product.stock}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs font-semibold">
                الوصف
              </dt>
              <dd className="mt-1 leading-7 font-medium">
                {product.description_ar ?? '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="by-card space-y-3">
        <h2 className="text-[15px] font-bold">إجراءات سريعة</h2>
        <p className="text-muted-foreground text-sm leading-6">
          {isBayya3een
            ? 'منتجات بياعين بتتحكم في السعر والتكلفة من النموذج على الشمال.'
            : 'منتجات التجار: راجعي المحتوى وبعدين انشري أو ارفضي.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {product.status !== 'live' ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => setStatus('live', false)}
            >
              نشر
            </Button>
          ) : null}
          {product.status === 'under_review' ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setStatus('rejected')}
            >
              رفض
            </Button>
          ) : null}
          {product.status === 'live' && !product.is_hidden ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setStatus('hidden', true)}
            >
              إخفاء
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

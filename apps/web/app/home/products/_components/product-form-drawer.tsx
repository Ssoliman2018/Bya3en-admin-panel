'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@kit/ui/drawer';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { NativeSelect, NativeSelectOption } from '@kit/ui/native-select';
import { toast } from '@kit/ui/sonner';
import { X } from 'lucide-react';

import {
  createBayya3eenProductAction,
  updateBayya3eenProductAction,
} from '../_lib/server/products.actions';
import type { CatalogProduct } from '../_lib/server/products.loader';

type Category = { id: string; name_ar: string };

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function ProductFormDrawer({
  open,
  onOpenChange,
  categories,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  product?: CatalogProduct | null;
  onSaved?: () => void;
}) {
  const isEdit = Boolean(product);
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(999);
  const [cost, setCost] = useState(700);
  const [rate, setRate] = useState(8);

  useEffect(() => {
    if (!open) return;
    setPrice(product ? Number(product.price_egp) : 999);
    setCost(product ? Number(product.cost_egp ?? 700) : 700);
    setRate(product ? Number(product.commission_rate ?? 8) : 8);
  }, [open, product]);

  const margin = useMemo(() => {
    if (!price) return { pct: 0, after: 0 };
    const pct = Math.round(((price - cost) / price) * 100);
    const after = price - cost - (price * rate) / 100;
    return { pct, after };
  }, [price, cost, rate]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="left"
      shouldScaleBackground={false}
    >
      <DrawerContent
        dir="rtl"
        className="!h-full !w-full !max-w-[min(560px,100vw)] rounded-none border-[#E2E0EE] bg-white data-[vaul-drawer-direction=left]:rounded-e-2xl"
      >
        <DrawerHeader className="border-border flex-row items-center gap-3 border-b px-5 py-4 text-right md:text-right">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-[18px] font-extrabold">
              {isEdit ? 'تعديل منتج بياعين' : 'منتج بياعين جديد'}
            </DrawerTitle>
            <DrawerDescription className="text-muted-foreground mt-1 text-[12.5px]">
              المنصة بتحدد السعر وبتشيل المخزون.
            </DrawerDescription>
          </div>
          <DrawerClose className="bg-muted hover:bg-muted/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors">
            <X className="size-4" />
            <span className="sr-only">إغلاق</span>
          </DrawerClose>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const compareAtRaw = String(
              formData.get('compareAtPriceEgp') ?? '',
            ).trim();

            startTransition(async () => {
              try {
                const payload = {
                  nameAr: String(formData.get('nameAr') ?? ''),
                  brand: String(formData.get('brand') ?? '') || undefined,
                  categoryId: String(formData.get('categoryId') ?? ''),
                  priceEgp: Number(formData.get('priceEgp')),
                  compareAtPriceEgp: compareAtRaw
                    ? Number(compareAtRaw)
                    : undefined,
                  costEgp: Number(formData.get('costEgp')),
                  stock: Number(formData.get('stock') ?? 0),
                  commissionRate: Number(formData.get('commissionRate') ?? 0),
                  descriptionAr: undefined,
                  status: 'live' as const,
                };

                if (isEdit && product) {
                  await updateBayya3eenProductAction({
                    ...payload,
                    productId: product.id,
                    status:
                      product.status === 'draft' || product.status === 'hidden'
                        ? product.status
                        : 'live',
                  });
                  toast.success('اتحفظ المنتج');
                } else {
                  await createBayya3eenProductAction(payload);
                  toast.success(
                    `"${payload.nameAr}" اتنشر · ظاهر في الكتالوج`,
                  );
                }

                onOpenChange(false);
                onSaved?.();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : 'فشل حفظ المنتج',
                );
              }
            });
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="nameAr" className="text-[12.5px] font-bold">
                اسم المنتج
              </Label>
              <Input
                id="nameAr"
                name="nameAr"
                required
                minLength={3}
                dir="rtl"
                className="h-10 rounded-[10px]"
                placeholder="مثلاً: سماعة بلوتوث رياضية"
                defaultValue={product?.name_ar}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="categoryId" className="text-[12.5px] font-bold">
                  القسم
                </Label>
                <NativeSelect
                  id="categoryId"
                  name="categoryId"
                  required
                  className="h-10 w-full rounded-[10px]"
                  defaultValue={product?.category_id ?? categories[0]?.id}
                >
                  {categories.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name_ar}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand" className="text-[12.5px] font-bold">
                  الماركة
                </Label>
                <Input
                  id="brand"
                  name="brand"
                  className="h-10 rounded-[10px] font-[family-name:var(--font-heading)]"
                  defaultValue={product?.brand ?? 'Bayya3een'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priceEgp" className="text-[12.5px] font-bold">
                  سعر البيع (EGP)
                </Label>
                <Input
                  id="priceEgp"
                  name="priceEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  className="h-10 rounded-[10px]"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="compareAtPriceEgp"
                  className="text-[12.5px] font-bold"
                >
                  السعر قبل الخصم (اختياري)
                </Label>
                <Input
                  id="compareAtPriceEgp"
                  name="compareAtPriceEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  className="h-10 rounded-[10px]"
                  defaultValue={
                    product?.compare_at_price_egp != null
                      ? Number(product.compare_at_price_egp)
                      : undefined
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costEgp" className="text-[12.5px] font-bold">
                  تكلفة المنتج (EGP)
                </Label>
                <Input
                  id="costEgp"
                  name="costEgp"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  className="h-10 rounded-[10px]"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock" className="text-[12.5px] font-bold">
                  المخزون
                </Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  min={0}
                  step={1}
                  required
                  className="h-10 rounded-[10px]"
                  defaultValue={product?.stock ?? 20}
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="commissionRate"
                  className="text-[12.5px] font-bold"
                >
                  عمولة البيّاع %
                </Label>
                <Input
                  id="commissionRate"
                  name="commissionRate"
                  type="number"
                  min={0}
                  max={40}
                  step="0.1"
                  required
                  className="h-10 rounded-[10px]"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[12.5px] font-bold">هامش الربح</Label>
                <div className="by-note flex h-10 items-center">
                  <span>
                    <b
                      className="num"
                      style={{
                        color: margin.pct > 0 ? '#0A6B37' : '#B3261E',
                      }}
                    >
                      {margin.pct}%
                    </b>
                    {' · بعد عمولة البيّاع: '}
                    <b className="num">{fmt(margin.after)} EGP</b>
                  </span>
                </div>
              </div>
            </div>

            <div className="by-note">
              منتج مملوك لبياعين: المنصة بتحدد السعر وبتشيل المخزون.
              {!isEdit ? ' هيظهر في الكتالوج أول ما تحفظ.' : ''}
            </div>
          </div>

          <DrawerFooter className="border-border flex-row gap-2 border-t px-5 py-4">
            <Button
              type="submit"
              disabled={pending}
              className="h-10 flex-1 rounded-[10px] font-bold"
            >
              {pending
                ? 'جاري الحفظ...'
                : isEdit
                  ? 'احفظ'
                  : 'احفظ وانشر'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="h-10 rounded-[10px] font-bold"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

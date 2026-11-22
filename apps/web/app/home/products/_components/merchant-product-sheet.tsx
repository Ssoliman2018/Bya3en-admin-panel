'use client';

import { useTransition } from 'react';

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
import { toast } from '@kit/ui/sonner';
import { X } from 'lucide-react';

import { updateProductStatusAction } from '../_lib/server/products.actions';
import type { CatalogProduct } from '../_lib/server/products.loader';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function MerchantProductSheet({
  product,
  open,
  onOpenChange,
  onChanged,
}: {
  product: CatalogProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  if (!product) {
    return null;
  }

  const paused = product.is_hidden || product.status === 'hidden';
  const initial = product.name_ar.slice(0, 1);

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
          <DrawerTitle className="flex-1 text-[18px] font-extrabold">
            {product.name_ar}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            تفاصيل منتج التاجر وإجراءات الإدارة
          </DrawerDescription>
          <DrawerClose className="bg-muted hover:bg-muted/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors">
            <X className="size-4" />
            <span className="sr-only">إغلاق</span>
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div
            className="grid size-40 place-items-center rounded-2xl text-3xl font-extrabold text-[#5E00C7]"
            style={{
              background: 'linear-gradient(135deg,#F1E8FF,#E2F3FF)',
            }}
          >
            {initial}
          </div>

          <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-3 text-[13px]">
            <dt className="text-muted-foreground font-medium">الملكية</dt>
            <dd>
              <span className="by-own mr">
                تاجر
                {product.merchants?.store_name
                  ? ` · ${product.merchants.store_name}`
                  : ''}
              </span>
            </dd>

            <dt className="text-muted-foreground font-medium">التاجر</dt>
            <dd className="font-semibold">
              {product.merchants?.store_name ?? '—'}
            </dd>

            <dt className="text-muted-foreground font-medium">حالة التاجر</dt>
            <dd>
              {product.merchants?.status === 'active' ? (
                <span className="by-st green">نشط</span>
              ) : product.merchants?.status === 'pending' ? (
                <span className="by-st amber">بانتظار التحقق</span>
              ) : (
                <span className="by-st violet">
                  {product.merchants?.status ?? '—'}
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground font-medium">السعر</dt>
            <dd className="font-semibold" data-numeric>
              {fmt(Number(product.price_egp))} EGP
            </dd>

            <dt className="text-muted-foreground font-medium">المخزون</dt>
            <dd className="font-semibold" data-numeric>
              {product.stock}
            </dd>

            <dt className="text-muted-foreground font-medium">عمولة البيّاع</dt>
            <dd className="font-semibold" data-numeric>
              {product.commission_rate != null
                ? `${Number(product.commission_rate)}%`
                : '—'}
            </dd>

            <dt className="text-muted-foreground font-medium">الحالة</dt>
            <dd className="font-semibold">
              {paused
                ? `مخفي${product.rejection_reason ? ` · ${product.rejection_reason}` : ''}`
                : 'ظاهر للعملاء'}
            </dd>
          </dl>

          <div className="by-note">
            السعر والمخزون والتوفر بيتحكم فيهم التاجر من لوحته. الإدارة بتراجع
            وتوقف المنتج لو مخالف.
          </div>
        </div>

        <DrawerFooter className="border-border border-t px-5 py-4">
          <Button
            variant={paused ? 'default' : 'destructive'}
            disabled={pending}
            className="h-10 rounded-[10px] font-bold"
            onClick={() => {
              startTransition(async () => {
                try {
                  await updateProductStatusAction({
                    productId: product.id,
                    status: paused ? 'live' : 'hidden',
                    isHidden: !paused,
                    rejectionReason: paused ? undefined : 'متوقف من الإدارة',
                  });
                  toast.success(
                    paused
                      ? 'المنتج رجع ظاهر'
                      : 'المنتج اتوقف ومش ظاهر للعملاء',
                  );
                  onOpenChange(false);
                  onChanged?.();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'فشل تحديث المنتج',
                  );
                }
              });
            }}
          >
            {paused ? 'رجّع المنتج' : 'أوقف المنتج'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

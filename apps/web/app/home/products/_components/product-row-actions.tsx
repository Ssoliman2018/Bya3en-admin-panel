'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import {
  Check,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Ban,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import {
  deleteProductAction,
  updateProductStatusAction,
} from '../_lib/server/products.actions';
import type { CatalogProduct } from '../_lib/server/products.loader';

export function ProductRowActions({
  product,
  onView,
  onEdit,
  onReject,
}: {
  product: CatalogProduct;
  onView: () => void;
  onEdit: () => void;
  onReject?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isBayya3een = product.owner_type === 'bayya3een';
  const paused = product.is_hidden || product.status === 'hidden';
  const underReview = product.status === 'under_review';

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'حصل خطأ أثناء التنفيذ',
        );
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            disabled={pending}
            aria-label="إجراءات المنتج"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44" dir="rtl">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onView}>
            <Eye className="size-4" />
            عرض التفاصيل
          </DropdownMenuItem>

          {isBayya3een ? (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              تعديل
            </DropdownMenuItem>
          ) : null}

          {underReview ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  () =>
                    updateProductStatusAction({
                      productId: product.id,
                      status: 'live',
                      isHidden: false,
                    }),
                  'اتوافق على المنتج وظهر في الكتالوج',
                )
              }
            >
              <Check className="size-4" />
              موافقة ونشر
            </DropdownMenuItem>
          ) : null}

          {underReview && onReject ? (
            <DropdownMenuItem onClick={onReject}>
              <XCircle className="size-4" />
              رفض
            </DropdownMenuItem>
          ) : null}

          {!underReview && !paused && product.status === 'live' ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  () =>
                    updateProductStatusAction({
                      productId: product.id,
                      status: 'hidden',
                      isHidden: true,
                      rejectionReason: 'متوقف من الإدارة',
                    }),
                  'المنتج اتوقف ومش ظاهر للعملاء',
                )
              }
            >
              <Ban className="size-4" />
              إيقاف / إخفاء
            </DropdownMenuItem>
          ) : null}

          {paused ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  () =>
                    updateProductStatusAction({
                      productId: product.id,
                      status: 'live',
                      isHidden: false,
                    }),
                  'المنتج رجع ظاهر',
                )
              }
            >
              <RotateCcw className="size-4" />
              إرجاع للظهور
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (
              !window.confirm(
                `متأكد تحذف "${product.name_ar}"؟ الإجراء ده مش هيرجع.`,
              )
            ) {
              return;
            }

            run(
              () => deleteProductAction({ productId: product.id }),
              'اتحذف المنتج',
            );
          }}
        >
          <Trash2 className="size-4" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

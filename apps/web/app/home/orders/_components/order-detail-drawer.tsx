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
import { Check, RotateCcw, X } from 'lucide-react';

import { updateOrderStatusAction } from '../_lib/server/orders.actions';
import type { OrderRow } from '../_lib/server/orders.loader';
import {
  FULFILMENT_STEPS,
  ORDER_STATUS_AR,
  PAYMENT_AR,
  type OrderStatus,
} from '../_lib/orders.constants';
import { OrderStatusPill } from './order-status-pill';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

function groupItems(order: OrderRow) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      isBayya3een: boolean;
      items: OrderRow['order_items'];
    }
  >();

  for (const item of order.order_items) {
    const key = item.merchant_id ?? 'bayya3een';
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      label: item.merchants?.store_name ?? 'بياعين ماركت',
      isBayya3een: !item.merchant_id,
      items: [item],
    });
  }

  return [...groups.values()];
}

export function OrderDetailDrawer({
  order,
  open,
  onOpenChange,
  onChanged,
}: {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  if (!order) {
    return null;
  }

  const groups = groupItems(order);
  const stepIdx = FULFILMENT_STEPS.indexOf(order.status);
  const canConfirm = order.status === 'new';
  const canCancel = ['new', 'confirmed', 'processing'].includes(order.status);
  const canRefund = order.status === 'returned';
  const canReturn = order.status === 'delivered';

  function setStatus(status: OrderStatus) {
    startTransition(async () => {
      try {
        await updateOrderStatusAction({ orderId: order!.id, status });
        toast.success(`الطلب ${order!.code} بقى: ${ORDER_STATUS_AR[status]}`);
        onChanged?.();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث حالة الطلب',
        );
      }
    });
  }

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
              طلب <span data-numeric>{order.code}</span>
            </DrawerTitle>
            <DrawerDescription className="mt-1 text-[12.5px]">
              {order.customer_name} · {order.governorate}
            </DrawerDescription>
          </div>
          <DrawerClose className="bg-muted hover:bg-muted/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.status} />
            <span className="by-st violet">
              {PAYMENT_AR[order.payment_method] ?? order.payment_method}
            </span>
            {order.affiliate_code ? (
              <span className="by-st violet">
                بيّاع: <span data-numeric>{order.affiliate_code}</span>
              </span>
            ) : null}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                التاريخ
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {new Date(order.created_at).toLocaleString('ar-EG')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                الإجمالي
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {fmt(order.total_egp)} EGP
                <span className="text-muted-foreground ms-1 text-xs font-medium">
                  {order.shipping_fee_egp > 0
                    ? `(شحن ${fmt(order.shipping_fee_egp)})`
                    : '(شحن مجاني)'}
                </span>
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-[13px] font-bold">
              مسؤولية التجهيز حسب التاجر
            </h3>
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="rounded-xl border border-[#E2E0EE] p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={group.isBayya3een ? 'by-own by' : 'by-own mr'}
                    >
                      {group.isBayya3een ? 'بياعين' : group.label}
                    </span>
                    <span className="text-muted-foreground text-[11.5px] font-medium">
                      {group.isBayya3een
                        ? 'بياعين مسؤولة عن الشحن'
                        : 'التاجر مسؤول عن التجهيز والشحن'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">
                            {item.product_name_ar}
                          </div>
                          <div
                            className="text-muted-foreground text-[12px]"
                            data-numeric
                          >
                            {item.qty} × {fmt(item.unit_price_egp)}
                          </div>
                        </div>
                        <OrderStatusPill status={item.status} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[13px] font-bold">مراحل الطلب</h3>
            <ol className="space-y-2">
              {FULFILMENT_STEPS.map((step, index) => {
                const done = stepIdx >= 0 && index <= stepIdx;
                return (
                  <li
                    key={step}
                    className="flex items-center gap-2 text-[12.5px] font-semibold"
                  >
                    <span
                      className={
                        done
                          ? 'bg-primary size-2.5 rounded-full'
                          : 'size-2.5 rounded-full bg-[#E2E0EE]'
                      }
                    />
                    <span className={done ? 'text-[#0B0F2E]' : 'text-[#8B90B0]'}>
                      {ORDER_STATUS_AR[step]}
                    </span>
                  </li>
                );
              })}
              {stepIdx < 0 ? (
                <li className="flex items-center gap-2 text-[12.5px] font-semibold text-[#B3261E]">
                  <span className="size-2.5 rounded-full bg-[#B3261E]" />
                  {ORDER_STATUS_AR[order.status]}
                </li>
              ) : null}
            </ol>
          </div>

          {order.affiliate_code ? (
            <p className="rounded-xl border border-[#E2E0EE] bg-[#F8F7FC] px-3 py-2 text-[12.5px] leading-6">
              الطلب منسوب للبيّاع{' '}
              <b data-numeric>{order.affiliate_code}</b>. لو اتلغى أو اترجع
              العمولة بتتعكس تلقائياً.
            </p>
          ) : null}
        </div>

        <DrawerFooter className="border-border flex-row flex-wrap justify-start gap-2 border-t px-5 py-4">
          {canConfirm ? (
            <Button
              className="rounded-[10px] font-bold"
              disabled={pending}
              onClick={() => setStatus('confirmed')}
            >
              <Check className="size-4" />
              أكّد الطلب
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="outline"
              className="rounded-[10px] border-[#F3A9A3] font-bold text-[#B3261E] hover:bg-[#FDE7E5]"
              disabled={pending}
              onClick={() => setStatus('cancelled')}
            >
              إلغاء الطلب
            </Button>
          ) : null}
          {canReturn ? (
            <Button
              variant="outline"
              className="rounded-[10px] font-bold"
              disabled={pending}
              onClick={() => setStatus('returned')}
            >
              <RotateCcw className="size-4" />
              سجّل مرتجع
            </Button>
          ) : null}
          {canRefund ? (
            <Button
              className="rounded-[10px] bg-[#FF8A00] font-bold hover:bg-[#E07900]"
              disabled={pending}
              onClick={() => setStatus('refunded')}
            >
              رجّع الفلوس للعميل
            </Button>
          ) : null}
          {!canConfirm && !canCancel && !canReturn && !canRefund ? (
            <span className="text-muted-foreground text-sm">
              مفيش إجراءات متاحة للحالة دي
            </span>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

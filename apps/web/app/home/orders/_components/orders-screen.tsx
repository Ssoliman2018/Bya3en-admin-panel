'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Ban, Boxes, PackageCheck, Search, Truck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../../_components/admin-page-header';
import {
  ORDER_STATUSES,
  ORDER_STATUS_AR,
  PAYMENT_AR,
  type OrderFilter,
} from '../_lib/orders.constants';
import type { OrderRow } from '../_lib/server/orders.loader';
import { OrderDetailDrawer } from './order-detail-drawer';
import { OrderStatusPill } from './order-status-pill';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

function merchantBadges(order: OrderRow) {
  const labels = new Map<string, { label: string; bayya3een: boolean }>();

  for (const item of order.order_items) {
    if (!item.merchant_id) {
      labels.set('bayya3een', { label: 'بياعين', bayya3een: true });
      continue;
    }

    labels.set(item.merchant_id, {
      label: item.merchants?.store_name ?? 'تاجر',
      bayya3een: false,
    });
  }

  return [...labels.values()];
}

const TABS: Array<{ id: OrderFilter; label: string; hot?: boolean }> = [
  { id: 'all', label: 'الكل' },
  ...ORDER_STATUSES.map((status) => ({
    id: status as OrderFilter,
    label: ORDER_STATUS_AR[status],
    hot: status === 'new',
  })),
];

export function OrdersScreen({
  filter,
  q = '',
  orders,
  counts,
}: {
  filter: OrderFilter;
  q?: string;
  orders: OrderRow[];
  counts: Record<OrderFilter, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const tabHref = (id: OrderFilter) => {
    const params = new URLSearchParams();
    if (id !== 'all') params.set('status', id);
    if (q) params.set('q', q);
    const qs = params.toString();
    return qs ? `${pathsConfig.app.orders}?${qs}` : pathsConfig.app.orders;
  };

  const pushSearch = (value: string) => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (value.trim()) params.set('q', value.trim());
    const qs = params.toString();
    router.push(qs ? `${pathsConfig.app.orders}?${qs}` : pathsConfig.app.orders);
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="الطلبات"
        description="طلب واحد ممكن يجمع منتجات من أكتر من تاجر · كل تاجر مسؤول عن تجهيز منتجاته"
        searchPlaceholder="دور على رقم طلب، عميل، أو محافظة..."
        stats={[
          {
            label: 'كل الطلبات',
            value: counts.all,
            icon: <Boxes className="size-3.5" />,
          },
          {
            label: 'جديدة',
            value: counts.new,
            icon: <PackageCheck className="size-3.5" />,
          },
          {
            label: 'قيد التجهيز / شحن',
            value: counts.processing + counts.shipped + counts.confirmed,
            icon: <Truck className="size-3.5" />,
          },
          {
            label: 'ملغي / مرتجع',
            value: counts.cancelled + counts.returned + counts.refunded,
            icon: <Ban className="size-3.5" />,
          },
        ]}
      />

      <div className="by-list-tools">
        <nav className="by-wtabs" aria-label="فلاتر الطلبات">
          {TABS.map((tab) => {
            const count = counts[tab.id];
            const on = filter === tab.id;
            return (
              <Link
                key={tab.id}
                href={tabHref(tab.id)}
                className={on ? 'on' : undefined}
              >
                {tab.label}
                <span className={`ct ${tab.hot && count > 0 ? 'hot' : ''}`}>
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="by-fbar">
          <label className="by-wsearch">
            <Search aria-hidden />
            <input
              defaultValue={q}
              placeholder="رقم طلب، عميل، أو محافظة"
              onChange={(e) => {
                const value = e.target.value;
                window.clearTimeout(
                  (window as unknown as { _oq?: number })._oq,
                );
                (window as unknown as { _oq?: number })._oq = window.setTimeout(
                  () => pushSearch(value),
                  280,
                );
              }}
            />
          </label>
          <span className="by-fbar__count">
            <span className="num">{orders.length}</span> طلب
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          مفيش طلبات في الفلتر ده.
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">الطلب</TableHead>
                <TableHead className="text-right font-bold">التاريخ</TableHead>
                <TableHead className="text-right font-bold">العميل</TableHead>
                <TableHead className="text-right font-bold">
                  التجار المسؤولين
                </TableHead>
                <TableHead className="text-right font-bold">الإجمالي</TableHead>
                <TableHead className="text-right font-bold">الدفع</TableHead>
                <TableHead className="text-right font-bold">بيّاع</TableHead>
                <TableHead className="text-right font-bold">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const merchants = merchantBadges(order);
                const multi = merchants.length > 1;

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(order)}
                  >
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b className="num text-[13px]" data-numeric>
                          {order.code}
                        </b>
                        {multi ? (
                          <span className="by-st violet">
                            {merchants.length} تجار
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-[12.5px]" data-numeric>
                      {new Date(order.created_at).toLocaleDateString('ar-EG')}
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-semibold">
                        {order.customer_name}
                      </div>
                      <div className="text-muted-foreground text-[11.5px]">
                        {order.governorate}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {merchants.map((m) => (
                          <span
                            key={`${order.id}-${m.label}`}
                            className={m.bayya3een ? 'by-own by' : 'by-own mr'}
                          >
                            {m.label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold" data-numeric>
                      {fmt(order.total_egp)}
                    </TableCell>
                    <TableCell className="text-[12.5px]">
                      {PAYMENT_AR[order.payment_method] ?? order.payment_method}
                    </TableCell>
                    <TableCell>
                      {order.affiliate_code ? (
                        <span className="num text-[12px]" data-numeric>
                          {order.affiliate_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OrderStatusPill status={order.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <OrderDetailDrawer
        order={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

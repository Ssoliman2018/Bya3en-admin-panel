import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { OrdersScreen } from './_components/orders-screen';
import { ORDER_STATUSES, type OrderFilter } from './_lib/orders.constants';
import {
  loadOrderCounts,
  loadOrders,
} from './_lib/server/orders.loader';

export const metadata = { title: 'الطلبات' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const statusParam = params.status ?? 'all';
  const q = params.q?.trim() ?? '';
  const filter = (
    statusParam === 'all' ||
    ORDER_STATUSES.includes(statusParam as (typeof ORDER_STATUSES)[number])
      ? statusParam
      : 'all'
  ) as OrderFilter;

  const [orders, counts] = await Promise.all([
    loadOrders(filter),
    loadOrderCounts(),
  ]);

  const query = q.toLowerCase();
  const visibleOrders = query
    ? orders.filter((order) => {
        const hay = [
          order.code,
          order.customer_name,
          order.governorate,
          order.affiliate_code,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      })
    : orders;

  return (
    <PageBody className="gap-0 pt-0">
      <OrdersScreen
        filter={filter}
        q={q}
        orders={visibleOrders}
        counts={counts}
      />
    </PageBody>
  );
}

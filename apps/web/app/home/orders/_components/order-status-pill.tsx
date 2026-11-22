import {
  ORDER_STATUS_AR,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '../_lib/orders.constants';

export function OrderStatusPill({ status }: { status: OrderStatus | string }) {
  const tone = ORDER_STATUS_TONE[status as OrderStatus] ?? 'violet';
  const label = ORDER_STATUS_AR[status as OrderStatus] ?? status;

  return <span className={`by-st ${tone}`}>{label}</span>;
}

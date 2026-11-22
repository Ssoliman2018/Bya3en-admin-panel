export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderFilter = 'all' | OrderStatus;

export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكّد',
  processing: 'قيد التجهيز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
  refunded: 'اترد المبلغ',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  new: 'amber',
  confirmed: 'blue',
  processing: 'violet',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
  returned: 'red',
  refunded: 'red',
};

export const PAYMENT_AR: Record<string, string> = {
  cod: 'عند الاستلام',
  card: 'كارت',
  wallet: 'محفظة',
};

export const FULFILMENT_STEPS: OrderStatus[] = [
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

export const COMMISSION_TABS = [
  'rules',
  'products',
  'fees',
  'campaigns',
  'elig',
  'rev',
] as const;

export type CommissionTab = (typeof COMMISSION_TABS)[number];

export const COMMISSION_TAB_AR: Record<CommissionTab, string> = {
  rules: 'القواعد العامة',
  products: 'نسب المنتجات',
  fees: 'رسوم التجار',
  campaigns: 'الحملات',
  elig: 'الأهلية',
  rev: 'الانعكاسات والسجل',
};

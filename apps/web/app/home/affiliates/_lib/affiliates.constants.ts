export const AFFILIATE_STATUSES = [
  'pending',
  'active',
  'suspended',
  'rejected',
] as const;

export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

export type AffiliateFilter =
  | 'all'
  | 'pending'
  | 'flagged'
  | 'suspended'
  | 'wd';

export const AFFILIATE_STATUS_AR: Record<AffiliateStatus, string> = {
  pending: 'بانتظار الموافقة',
  active: 'نشط',
  suspended: 'موقوف',
  rejected: 'مرفوض',
};

export const AFFILIATE_STATUS_TONE: Record<AffiliateStatus, string> = {
  pending: 'amber',
  active: 'green',
  suspended: 'red',
  rejected: 'red',
};

export const TIER_AR: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
};

export const WITHDRAWAL_METHOD_AR: Record<string, string> = {
  vf: 'فودافون كاش',
  ip: 'إنستاباي',
  bank: 'تحويل بنكي',
};

export const WITHDRAWAL_STATUS_AR: Record<string, string> = {
  pending: 'مستني موافقة',
  withdrawn: 'اتحوّل',
  cancelled: 'اترفض',
};

export const WITHDRAWAL_STATUS_TONE: Record<string, string> = {
  pending: 'amber',
  withdrawn: 'green',
  cancelled: 'red',
};

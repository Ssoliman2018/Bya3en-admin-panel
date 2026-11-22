'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Crown, Package, Percent, Receipt, Shield } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
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
  extendSubscriptionAction,
  refundSubscriptionPaymentAction,
  saveSubscriptionPolicyAction,
  togglePackageAction,
  togglePromoAction,
} from '../_lib/server/subscriptions.actions';
import type { loadSubscriptionsBundle } from '../_lib/server/subscriptions.loader';

type Bundle = Awaited<ReturnType<typeof loadSubscriptionsBundle>>;
type Tab = 'packages' | 'list' | 'pay' | 'promo' | 'policy';

const TABS: Array<{ id: Tab; label: string; hot?: boolean }> = [
  { id: 'packages', label: 'الباقات' },
  { id: 'list', label: 'الاشتراكات' },
  { id: 'pay', label: 'المدفوعات' },
  { id: 'promo', label: 'العروض' },
  { id: 'policy', label: 'سياسة الانتهاء' },
];

const STATE_AR: Record<string, string> = {
  active: 'نشط',
  expiring: 'قرب ينتهي',
  expired: 'منتهي',
  cancelled: 'ملغي',
};

const STATE_TONE: Record<string, string> = {
  active: 'green',
  expiring: 'amber',
  expired: 'red',
  cancelled: 'violet',
};

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function SubscriptionsScreen({
  tab,
  data,
}: {
  tab: Tab;
  data: Bundle;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [policy, setPolicy] = useState({
    merchantExpiry: String(data.policy.merchant_expiry ?? 'grace_then_hide'),
    merchantGrace: Number(data.policy.merchant_grace ?? 7),
    affiliateLinks: String(data.policy.affiliate_links ?? 'grace_then_pause'),
    affiliateGrace: Number(data.policy.affiliate_grace ?? 7),
    downgrade: String(data.policy.downgrade ?? 'next_cycle'),
    reminders: (data.policy.reminders as number[]) ?? [14, 7, 1],
  });

  function run(action: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'فشل العملية');
      }
    });
  }

  const tabHref = (id: Tab) =>
    id === 'packages'
      ? pathsConfig.app.subscriptions
      : `${pathsConfig.app.subscriptions}?tab=${id}`;

  const merchantPkgs = data.packages.filter((p) => p.party_type === 'merchant');
  const affiliatePkgs = data.packages.filter((p) => p.party_type === 'affiliate');

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="إدارة الاشتراكات"
        description="باقات ربع سنوية للتجار والبيّاعين · الاشتراكات المدفوعة بتفضل على شروطها لحد التجديد"
        searchPlaceholder="دور على باقة أو مشترك..."
        stats={[
          {
            label: 'الباقات',
            value: data.counts.packages,
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'اشتراكات',
            value: data.counts.subscriptions,
            icon: <Crown className="size-3.5" />,
          },
          {
            label: 'قرب تنتهي',
            value: data.counts.expiring,
            icon: <Shield className="size-3.5" />,
          },
          {
            label: 'عروض نشطة',
            value: data.counts.promos,
            icon: <Percent className="size-3.5" />,
          },
        ]}
      />

      <div className="by-list-tools">
        <nav className="by-wtabs">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              className={tab === t.id ? 'on' : undefined}
            >
              {t.label}
              <span
                className={`ct ${t.id === 'list' && data.counts.expiring ? 'hot' : ''}`}
              >
                {t.id === 'packages'
                  ? data.counts.packages
                  : t.id === 'list'
                    ? data.counts.subscriptions
                    : t.id === 'pay'
                      ? data.counts.payments
                      : t.id === 'promo'
                        ? data.counts.promos
                        : '·'}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'packages' ? (
        <>
          {(['merchant', 'affiliate'] as const).map((type) => (
            <div key={type} className="space-y-3">
              <h2 className="text-[15px] font-bold">
                باقات {type === 'merchant' ? 'التجار' : 'البيّاعين'}
                <small className="text-muted-foreground ms-2 text-xs font-medium">
                  {type === 'merchant'
                    ? 'حد المنتجات المنشورة'
                    : 'العضوية بتفتح أدوات · مش بتغيّر نسبة العمولة'}
                </small>
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                {(type === 'merchant' ? merchantPkgs : affiliatePkgs).map((p) => (
                  <div key={String(p.id)} className="by-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[16px] font-extrabold">
                          {String(p.name_en)}{' '}
                          <small className="text-muted-foreground text-xs font-semibold">
                            {String(p.name_ar)}
                          </small>
                        </div>
                        <div className="mt-1 text-[20px] font-bold" data-numeric>
                          {fmt(Number(p.price_egp))}{' '}
                          <span className="text-muted-foreground text-xs font-medium">
                            EGP / {String(p.days)} يوم
                          </span>
                        </div>
                      </div>
                      <span className={`by-st ${p.is_active ? 'green' : 'violet'}`}>
                        {p.is_active ? 'متاحة' : 'موقوفة'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {type === 'merchant' ? (
                        <span className="by-st blue">
                          {p.product_limit == null
                            ? `بلا حد (عادل ${p.fair_use_limit})`
                            : `حتى ${p.product_limit} منتج`}
                        </span>
                      ) : (
                        <span className="by-st violet">مستوى {String(p.tier)}</span>
                      )}
                      <span className="by-st violet">v{String(p.version)}</span>
                    </div>
                    <ul className="space-y-1 text-[12.5px] font-medium leading-5">
                      {(p.features as string[]).map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={`by-toggle ${p.is_active ? 'on' : ''}`}
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            togglePackageAction({
                              packageId: String(p.id),
                              isActive: !p.is_active,
                            }),
                          p.is_active
                            ? 'الباقة اتقفلت للاشتراكات الجديدة'
                            : 'الباقة متاحة للشراء',
                        )
                      }
                    >
                      <span />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="by-note">
            <b>قاعدة:</b> تعديل السعر أو الحد بيعمل نسخة جديدة. الاشتراكات
            المدفوعة مابتتغيّرش بهدوء.
          </p>
        </>
      ) : null}

      {tab === 'list' ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">المشترك</TableHead>
                <TableHead className="text-right font-bold">النوع</TableHead>
                <TableHead className="text-right font-bold">الباقة</TableHead>
                <TableHead className="text-right font-bold">السعر</TableHead>
                <TableHead className="text-right font-bold">لحد</TableHead>
                <TableHead className="text-right font-bold">باقي</TableHead>
                <TableHead className="text-right font-bold">الحالة</TableHead>
                <TableHead className="text-right font-bold" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subscriptions.map((s) => (
                <TableRow key={String(s.id)}>
                  <TableCell>
                    <b>{String(s.owner_name)}</b>
                    <div className="text-muted-foreground num text-[11px]">
                      {String(s.code)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.party_type === 'merchant' ? 'تاجر' : 'بيّاع'}
                  </TableCell>
                  <TableCell>
                    {String(s.package_name)}{' '}
                    <span className="text-muted-foreground text-[11px]">
                      v{String(s.package_version)}
                    </span>
                  </TableCell>
                  <TableCell data-numeric>{fmt(Number(s.price_egp))}</TableCell>
                  <TableCell data-numeric>
                    {new Date(String(s.ends_at)).toLocaleDateString('ar-EG')}
                  </TableCell>
                  <TableCell data-numeric>
                    {Number(s.days_left) >= 0
                      ? `${s.days_left} يوم`
                      : 'منتهي'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`by-st ${STATE_TONE[String(s.computed_status)]}`}
                    >
                      {STATE_AR[String(s.computed_status)]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-[12px] font-bold"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            extendSubscriptionAction({
                              subscriptionId: String(s.id),
                            }),
                          'اتمدّ الاشتراك 30 يوم',
                        )
                      }
                    >
                      مدّ 30 يوم
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === 'pay' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="by-card">
              <div className="text-muted-foreground text-xs font-semibold">
                مدفوعات مدفوعة
              </div>
              <div className="mt-1 text-xl font-bold" data-numeric>
                {fmt(
                  data.payments
                    .filter((p) => p.status === 'paid')
                    .reduce((a, p) => a + Number(p.amount_egp), 0),
                )}{' '}
                EGP
              </div>
            </div>
            <div className="by-card">
              <div className="text-muted-foreground text-xs font-semibold">
                مسترد
              </div>
              <div className="mt-1 text-xl font-bold" data-numeric>
                {fmt(
                  data.payments
                    .filter((p) => p.status === 'refunded')
                    .reduce((a, p) => a + Number(p.amount_egp), 0),
                )}{' '}
                EGP
              </div>
            </div>
            <div className="by-card">
              <div className="text-muted-foreground text-xs font-semibold">
                فواتير
              </div>
              <div className="mt-1 text-xl font-bold" data-numeric>
                {data.payments.length}
              </div>
            </div>
          </div>
          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                  <TableHead className="text-right font-bold">الفاتورة</TableHead>
                  <TableHead className="text-right font-bold">المشترك</TableHead>
                  <TableHead className="text-right font-bold">الباقة</TableHead>
                  <TableHead className="text-right font-bold">المبلغ</TableHead>
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-right font-bold" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell data-numeric>
                      <b>{String(p.invoice_code)}</b>
                    </TableCell>
                    <TableCell>{String(p.owner_name)}</TableCell>
                    <TableCell>{String(p.package_name)}</TableCell>
                    <TableCell data-numeric>{fmt(Number(p.amount_egp))}</TableCell>
                    <TableCell>
                      <span
                        className={`by-st ${p.status === 'paid' ? 'green' : 'violet'}`}
                      >
                        {p.status === 'paid' ? 'مدفوع' : 'مسترد'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.status === 'paid' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-[12px] font-bold"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                refundSubscriptionPaymentAction({
                                  paymentId: String(p.id),
                                  reason: 'استرداد تجريبي',
                                }),
                              'اتعمل الاسترداد (تجريبي)',
                            )
                          }
                        >
                          <Receipt className="size-3.5" />
                          استرداد
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {tab === 'promo' ? (
        <>
          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                  <TableHead className="text-right font-bold">الكود</TableHead>
                  <TableHead className="text-right font-bold">الوصف</TableHead>
                  <TableHead className="text-right font-bold">الخصم</TableHead>
                  <TableHead className="text-right font-bold">على</TableHead>
                  <TableHead className="text-right font-bold">استخدامات</TableHead>
                  <TableHead className="text-right font-bold">شغّال</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.promos.map((p) => (
                  <TableRow key={String(p.code)}>
                    <TableCell data-numeric>
                      <b>{String(p.code)}</b>
                    </TableCell>
                    <TableCell>{String(p.label_ar)}</TableCell>
                    <TableCell data-numeric>{String(p.pct)}%</TableCell>
                    <TableCell>
                      {p.applies === 'merchant'
                        ? 'تجار'
                        : p.applies === 'affiliate'
                          ? 'بيّاعين'
                          : 'الكل'}
                    </TableCell>
                    <TableCell data-numeric>{String(p.uses)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className={`by-toggle ${p.is_active ? 'on' : ''}`}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              togglePromoAction({
                                code: String(p.code),
                                isActive: !p.is_active,
                              }),
                            p.is_active ? 'الكود اتوقف' : 'الكود اشتغل',
                          )
                        }
                      >
                        <span />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-[12px]">
            جرّب <b className="num">WHITEFRI</b> للتجار أو{' '}
            <b className="num">BAYA3</b> للبيّاعين.
          </p>
        </>
      ) : null}

      {tab === 'policy' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="by-card space-y-3">
            <h2 className="text-[15px] font-bold">لما اشتراك التاجر ينتهي</h2>
            {(
              [
                ['keep', 'خلي المنتجات ظاهرة'],
                ['grace_then_hide', `فترة سماح ثم إخفاء`],
                ['hide_now', 'إخفاء فوري'],
              ] as const
            ).map(([val, label]) => (
              <label
                key={val}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-[13px] font-semibold ${
                  policy.merchantExpiry === val
                    ? 'border-[#7A00FF] bg-[#F7F1FF]'
                    : 'border-[#E2E0EE]'
                }`}
              >
                <input
                  type="radio"
                  name="merchantExpiry"
                  checked={policy.merchantExpiry === val}
                  onChange={() =>
                    setPolicy((p) => ({ ...p, merchantExpiry: val }))
                  }
                />
                {label}
              </label>
            ))}
            <div className="space-y-1">
              <span className="text-xs font-semibold">أيام السماح</span>
              <Input
                className="num h-10 max-w-[120px] rounded-[10px]"
                value={policy.merchantGrace}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    merchantGrace: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <div className="by-card space-y-3">
            <h2 className="text-[15px] font-bold">لما عضوية البيّاع تنتهي</h2>
            {(
              [
                ['keep', 'اللينكات تفضل شغّالة بعمولة'],
                ['grace_then_pause', 'سماح ثم إيقاف العمولات الجديدة'],
                ['pause_now', 'إيقاف العمولات فوراً'],
              ] as const
            ).map(([val, label]) => (
              <label
                key={val}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-[13px] font-semibold ${
                  policy.affiliateLinks === val
                    ? 'border-[#7A00FF] bg-[#F7F1FF]'
                    : 'border-[#E2E0EE]'
                }`}
              >
                <input
                  type="radio"
                  name="affiliateLinks"
                  checked={policy.affiliateLinks === val}
                  onChange={() =>
                    setPolicy((p) => ({ ...p, affiliateLinks: val }))
                  }
                />
                {label}
              </label>
            ))}
            <div className="space-y-1">
              <span className="text-xs font-semibold">أيام السماح</span>
              <Input
                className="num h-10 max-w-[120px] rounded-[10px]"
                value={policy.affiliateGrace}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    affiliateGrace: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <Button
              className="rounded-[10px] font-bold"
              disabled={pending}
              onClick={() =>
                run(
                  () => saveSubscriptionPolicyAction(policy),
                  'اتحفظت السياسات',
                )
              }
            >
              احفظ السياسات
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { Tab as SubscriptionsTab };

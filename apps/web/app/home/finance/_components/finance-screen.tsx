'use client';

import { useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  BadgePercent,
  Landmark,
  Scale,
  Store,
  Wallet,
} from 'lucide-react';
import { Button } from '@kit/ui/button';
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
  matchReconAction,
  paySettlementAction,
} from '../_lib/server/finance.actions';
import type { loadFinanceBundle } from '../_lib/server/finance.loader';

type Bundle = Awaited<ReturnType<typeof loadFinanceBundle>>;
type Tab = 'overview' | 'settle' | 'recon' | 'tx' | 'profit';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'نظرة مالية' },
  { id: 'settle', label: 'تسويات التجار' },
  { id: 'recon', label: 'المطابقة' },
  { id: 'tx', label: 'سجل المعاملات' },
  { id: 'profit', label: 'الربحية' },
];

const TX_AR: Record<string, string> = {
  customer_payment: 'دفع عميل',
  marketplace_fee: 'رسوم السوق',
  merchant_payable: 'مستحق للتاجر',
  affiliate_commission: 'عمولة بيّاع',
  refund: 'استرداد',
};

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
}

export function FinanceScreen({ tab, data }: { tab: Tab; data: Bundle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'فشل');
      }
    });
  }

  const href = (id: Tab) =>
    id === 'overview'
      ? pathsConfig.app.finance
      : `${pathsConfig.app.finance}?tab=${id}`;

  const cards = [
    ['GMV', data.totals.gmv, 'فلوس العملاء · مش إيراد', '#0B0F2E'],
    ['رسوم السوق', data.totals.fee, 'عمولة المنصة على التجار', '#0A8FB8'],
    ['مبيعات بياعين', data.totals.own, 'إيراد مباشر قبل التكلفة', '#7A00FF'],
    ['الاشتراكات', data.totals.subs, 'تجار + بيّاعين', '#E07A00'],
    ['عمولات البيّاعين', -data.totals.aff, 'مصروف تسويق', '#C21FB5'],
    ['مستحقات التجار', data.totals.payables, 'التزام مش إيراد', '#585C78'],
    ['المرتجعات', -data.totals.refunds, 'فلوس رجعت للعملاء', '#B3261E'],
    ['التشغيل', -data.totals.opex, 'رواتب وتسويق ومخازن', '#585C78'],
    ['صافي تقديري', data.totals.net, 'بعد كل التكاليف', '#0A6B37'],
  ] as const;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="المالية"
        description="مدفوعات العملاء مش إيراد المنصة · كل نوع فلوس ليه سطره"
        searchPlaceholder="دور على تسوية أو معاملة..."
        stats={[
          {
            label: 'صافي إيرادات المنصة',
            value: fmtK(data.totals.netRev),
            icon: <Landmark className="size-3.5" />,
            hint: 'EGP',
          },
          {
            label: 'تسويات مستحقة',
            value: data.counts.dueSettlements,
            icon: <Store className="size-3.5" />,
          },
          {
            label: 'فروقات مطابقة',
            value: data.counts.reconDiff,
            icon: <Scale className="size-3.5" />,
          },
          {
            label: 'سحوبات معلّقة',
            value: fmtK(data.counts.pendingWdAmount),
            icon: <Wallet className="size-3.5" />,
            hint: `${data.counts.pendingWd} طلب`,
          },
        ]}
      />

      <div className="by-list-tools">
        <nav className="by-wtabs">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={href(t.id)}
              className={tab === t.id ? 'on' : undefined}
            >
              {t.label}
              {t.id === 'settle' && data.counts.dueSettlements ? (
                <span className="ct hot">{data.counts.dueSettlements}</span>
              ) : null}
              {t.id === 'recon' && data.counts.reconDiff ? (
                <span className="ct hot">{data.counts.reconDiff}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="by-note">
            <b>مهم:</b> إجمالي مدفوعات العملاء (
            <span className="num">{fmtK(data.totals.gmv)}</span>) مش إيراد
            المنصة. صافي إيرادات المنصة{' '}
            <b className="num">{fmtK(data.totals.netRev)}</b> بس.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(([label, value, hint, color]) => (
              <div
                key={label}
                className="by-card"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="text-muted-foreground text-[12px] font-semibold">
                  {label}
                </div>
                <div
                  className="mt-1 text-[22px] font-extrabold"
                  data-numeric
                  style={{ color }}
                >
                  {value < 0 ? '−' : ''}
                  {fmtK(Math.abs(value))}
                </div>
                <div className="text-muted-foreground mt-1 text-[11.5px]">
                  {hint}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'settle' ? (
        <>
          <div className="by-note">
            التسوية = مبيعات مسلّمة − رسوم السوق − المرتجعات. بتفضل متاحة حتى لو
            الاشتراك انتهى.
          </div>
          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                  <TableHead className="text-right font-bold">التسوية</TableHead>
                  <TableHead className="text-right font-bold">التاجر</TableHead>
                  <TableHead className="text-right font-bold">الفترة</TableHead>
                  <TableHead className="text-right font-bold">المبيعات</TableHead>
                  <TableHead className="text-right font-bold">الرسوم</TableHead>
                  <TableHead className="text-right font-bold">الصافي</TableHead>
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-right font-bold" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.settlements.map((s) => (
                  <TableRow key={String(s.id)}>
                    <TableCell data-numeric>
                      <b>{String(s.code)}</b>
                    </TableCell>
                    <TableCell>{String(s.merchant_name)}</TableCell>
                    <TableCell>{String(s.period_label)}</TableCell>
                    <TableCell data-numeric>{fmt(s.gross_egp)}</TableCell>
                    <TableCell data-numeric>−{fmt(s.fee_egp)}</TableCell>
                    <TableCell className="font-bold" data-numeric>
                      {fmt(s.net_egp)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`by-st ${s.status === 'paid' ? 'green' : 'amber'}`}
                      >
                        {s.status === 'paid' ? 'اتحوّل' : 'مستحق'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.status === 'due' ? (
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-[12px] font-bold"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                paySettlementAction({
                                  settlementId: String(s.id),
                                }),
                              'اتحوّلت التسوية (تجريبي)',
                            )
                          }
                        >
                          حوّل
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

      {tab === 'recon' ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">المصدر</TableHead>
                <TableHead className="text-right font-bold">اليوم</TableHead>
                <TableHead className="text-right font-bold">البوابة</TableHead>
                <TableHead className="text-right font-bold">دفترنا</TableHead>
                <TableHead className="text-right font-bold">الفرق</TableHead>
                <TableHead className="text-right font-bold">الحالة</TableHead>
                <TableHead className="text-right font-bold" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recon.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-semibold">
                    {String(r.source)}
                  </TableCell>
                  <TableCell data-numeric>
                    {new Date(String(r.recon_date)).toLocaleDateString('ar-EG')}
                  </TableCell>
                  <TableCell data-numeric>{fmt(r.gateway_egp)}</TableCell>
                  <TableCell data-numeric>{fmt(r.ledger_egp)}</TableCell>
                  <TableCell
                    className={r.diff_egp ? 'font-bold text-[#B3261E]' : ''}
                    data-numeric
                  >
                    {r.diff_egp
                      ? `${r.diff_egp > 0 ? '+' : ''}${fmt(r.diff_egp)}`
                      : '0'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`by-st ${r.status === 'matched' ? 'green' : 'red'}`}
                    >
                      {r.status === 'matched' ? 'متطابق' : 'فيه فرق'}
                    </span>
                    {r.note ? (
                      <div className="text-muted-foreground mt-1 max-w-[220px] text-[11px]">
                        {String(r.note)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.status === 'diff' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-[12px] font-bold"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => matchReconAction({ reconId: String(r.id) }),
                            'اتسجّلت التسوية في الدفتر',
                          )
                        }
                      >
                        اتسوّى
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === 'tx' ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">المعاملة</TableHead>
                <TableHead className="text-right font-bold">التاريخ</TableHead>
                <TableHead className="text-right font-bold">النوع</TableHead>
                <TableHead className="text-right font-bold">المرجع</TableHead>
                <TableHead className="text-right font-bold">الطرف</TableHead>
                <TableHead className="text-right font-bold">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ledger.map((l) => (
                <TableRow key={String(l.id)}>
                  <TableCell data-numeric>{String(l.tx_code)}</TableCell>
                  <TableCell data-numeric>
                    {new Date(String(l.tx_date)).toLocaleDateString('ar-EG')}
                  </TableCell>
                  <TableCell>
                    <span className="by-st blue">
                      <BadgePercent className="size-3" />
                      {TX_AR[String(l.tx_type)] ?? String(l.tx_type)}
                    </span>
                  </TableCell>
                  <TableCell data-numeric>{String(l.ref_code ?? '—')}</TableCell>
                  <TableCell>{String(l.party ?? '—')}</TableCell>
                  <TableCell className="font-semibold" data-numeric>
                    {fmt(l.amount_egp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === 'profit' ? (
        <div className="border-border overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">البند</TableHead>
                {data.months.map((m) => (
                  <TableHead
                    key={String(m.id)}
                    className="text-right font-bold"
                  >
                    {String(m.label_ar)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ['GMV', 'gmv'],
                  ['مبيعات بياعين', 'own_sales'],
                  ['رسوم السوق', 'marketplace_fee'],
                  ['اشتراكات تجار', 'sub_merchant'],
                  ['اشتراكات بيّاعين', 'sub_affiliate'],
                  ['صافي إيرادات', 'net_revenue'],
                  ['مجمل ربح', 'gross_profit'],
                  ['صافي تقديري', 'net_profit'],
                ] as const
              ).map(([label, key]) => (
                <TableRow key={key}>
                  <TableCell className="font-semibold">{label}</TableCell>
                  {data.months.map((m) => (
                    <TableCell key={String(m.id)} data-numeric>
                      {fmtK(Number(m[key]))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

export type { Tab as FinanceTab };

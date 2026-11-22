'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  Ban,
  Check,
  Flag,
  Link2,
  UserPlus,
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
  AFFILIATE_STATUS_AR,
  AFFILIATE_STATUS_TONE,
  TIER_AR,
  WITHDRAWAL_METHOD_AR,
  WITHDRAWAL_STATUS_AR,
  WITHDRAWAL_STATUS_TONE,
  type AffiliateFilter,
} from '../_lib/affiliates.constants';
import { updateWithdrawalStatusAction } from '../_lib/server/affiliates.actions';
import type {
  AffiliateRow,
  WithdrawalRow,
} from '../_lib/server/affiliates.loader';
import { AffiliateDetailDrawer } from './affiliate-detail-drawer';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

const TABS: Array<{ id: AffiliateFilter; label: string; hot?: boolean }> = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'طلبات تسجيل', hot: true },
  { id: 'flagged', label: 'مؤشرات احتيال', hot: true },
  { id: 'suspended', label: 'موقوفين' },
  { id: 'wd', label: 'طلبات السحب', hot: true },
];

export function AffiliatesScreen({
  filter,
  affiliates,
  withdrawals,
  counts,
}: {
  filter: AffiliateFilter;
  affiliates: AffiliateRow[];
  withdrawals: WithdrawalRow[];
  counts: Record<AffiliateFilter, number> & { active: number };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AffiliateRow | null>(null);
  const [pending, startTransition] = useTransition();

  const tabHref = (id: AffiliateFilter) => {
    if (id === 'all') return pathsConfig.app.affiliates;
    return `${pathsConfig.app.affiliates}?tab=${id}`;
  };

  function setWithdrawal(
    withdrawalId: string,
    status: 'withdrawn' | 'cancelled',
  ) {
    startTransition(async () => {
      try {
        await updateWithdrawalStatusAction({ withdrawalId, status });
        toast.success(
          status === 'withdrawn'
            ? 'اتحوّل المبلغ (تجريبي) · البيّاع هيشوف الحالة'
            : 'اترفض الطلب والمبلغ رجع لرصيد البيّاع',
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث طلب السحب',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="البيّاعين"
        description="بيروّجوا منتجات بلينكات · مالهمش وصول لمخزون التجار ولا لبيانات العملاء"
        searchPlaceholder="دور على كود بيّاع أو اسم..."
        stats={[
          {
            label: 'كل البيّاعين',
            value: counts.all,
            icon: <Link2 className="size-3.5" />,
            hint: `${counts.active} نشط`,
          },
          {
            label: 'طلبات تسجيل',
            value: counts.pending,
            icon: <UserPlus className="size-3.5" />,
          },
          {
            label: 'مؤشرات احتيال',
            value: counts.flagged,
            icon: <Flag className="size-3.5" />,
          },
          {
            label: 'سحوبات معلّقة',
            value: counts.wd,
            icon: <Wallet className="size-3.5" />,
          },
        ]}
      />

      <div className="by-list-tools">
        <nav className="by-wtabs" aria-label="فلاتر البيّاعين">
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
      </div>

      {filter === 'wd' ? (
        <>
          <div className="by-note">
            الموافقة هنا بتحاكي التحويل. طلبات{' '}
            <b className="num">AHMED24</b> مرتبطة بتطبيق البيّاع.
          </div>
          {withdrawals.length === 0 ? (
            <div className="border-border rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              مفيش طلبات سحب.
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                    <TableHead className="text-right font-bold">الطلب</TableHead>
                    <TableHead className="text-right font-bold">
                      البيّاع
                    </TableHead>
                    <TableHead className="text-right font-bold">المبلغ</TableHead>
                    <TableHead className="text-right font-bold">
                      الطريقة
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      التاريخ
                    </TableHead>
                    <TableHead className="text-right font-bold">تنبيه</TableHead>
                    <TableHead className="text-right font-bold">الحالة</TableHead>
                    <TableHead className="text-right font-bold" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <b className="num text-[13px]" data-numeric>
                          {w.code}
                        </b>
                      </TableCell>
                      <TableCell>
                        <div className="text-[13px] font-semibold">
                          {w.affiliates?.name ?? '—'}
                        </div>
                        <div
                          className="text-muted-foreground num text-[11.5px]"
                          data-numeric
                        >
                          {w.affiliates?.code}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold" data-numeric>
                        {fmt(w.amount_egp)}
                      </TableCell>
                      <TableCell>
                        <div className="text-[12.5px]">
                          {WITHDRAWAL_METHOD_AR[w.method] ?? w.method}
                        </div>
                        <div
                          className="text-muted-foreground num text-[11px]"
                          data-numeric
                        >
                          {w.account_masked}
                        </div>
                      </TableCell>
                      <TableCell className="text-[12.5px]" data-numeric>
                        {new Date(w.requested_at).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell>
                        {w.risk_flag ? (
                          <span className="by-st red">
                            <AlertTriangle className="size-3" />
                            مراجعة احتيال
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`by-st ${WITHDRAWAL_STATUS_TONE[w.status] ?? 'violet'}`}
                        >
                          {WITHDRAWAL_STATUS_AR[w.status] ?? w.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {w.status === 'pending' ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-[12px] font-bold"
                              disabled={pending}
                              onClick={() => setWithdrawal(w.id, 'withdrawn')}
                            >
                              <Check className="size-3.5" />
                              وافق وحوّل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-[#F3A9A3] text-[12px] font-bold text-[#B3261E]"
                              disabled={pending}
                              onClick={() => setWithdrawal(w.id, 'cancelled')}
                            >
                              ارفض
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="by-note">
            عيّنة من شبكة البيّاعين. حساب{' '}
            <b className="num">AHMED24</b> متصل مباشرة بتطبيق البيّاع.
          </div>
          {affiliates.length === 0 ? (
            <div className="border-border rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              مفيش بيّاعين في الفلتر ده.
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                    <TableHead className="text-right font-bold">
                      البيّاع
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      العضوية
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      ضغطات 30 يوم
                    </TableHead>
                    <TableHead className="text-right font-bold">طلبات</TableHead>
                    <TableHead className="text-right font-bold">تحويل</TableHead>
                    <TableHead className="text-right font-bold">
                      إجمالي الأرباح
                    </TableHead>
                    <TableHead className="text-right font-bold">معلّق</TableHead>
                    <TableHead className="text-right font-bold">
                      مؤشرات
                    </TableHead>
                    <TableHead className="text-right font-bold">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((a) => {
                    const conversion =
                      a.clicks_30d > 0
                        ? ((a.orders_count / a.clicks_30d) * 100).toFixed(1)
                        : '—';

                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(a)}
                      >
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <b className="text-[13px]">{a.name}</b>
                            {a.is_live_demo ? (
                              <span className="by-st green">مباشر</span>
                            ) : null}
                          </div>
                          <div
                            className="text-muted-foreground num text-[11.5px]"
                            data-numeric
                          >
                            {a.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="by-st violet">
                            {TIER_AR[a.membership_tier] ?? a.membership_tier}
                          </span>
                        </TableCell>
                        <TableCell data-numeric>{fmt(a.clicks_30d)}</TableCell>
                        <TableCell data-numeric>{a.orders_count}</TableCell>
                        <TableCell data-numeric>
                          {conversion === '—' ? '—' : `${conversion}%`}
                        </TableCell>
                        <TableCell className="font-semibold" data-numeric>
                          {fmt(a.earnings_egp)}
                        </TableCell>
                        <TableCell data-numeric>{fmt(a.pending_egp)}</TableCell>
                        <TableCell>
                          {a.flags.length > 0 ? (
                            <span className="by-st red">
                              <Flag className="size-3" />
                              {a.flags.length} مؤشر
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`by-st ${AFFILIATE_STATUS_TONE[a.status]}`}
                          >
                            {a.status === 'suspended' ? (
                              <Ban className="size-3" />
                            ) : null}
                            {AFFILIATE_STATUS_AR[a.status]}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <AffiliateDetailDrawer
        affiliate={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

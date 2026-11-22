import { connection } from 'next/server';

import {
  BadgePercent,
  LineChart,
  Package,
  TrendingUp,
} from 'lucide-react';
import { PageBody } from '@kit/ui/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { AdminPageHeader } from '../_components/admin-page-header';
import { loadFinanceBundle } from '../finance/_lib/server/finance.loader';

export const metadata = { title: 'أداء المشروع' };

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-EG');
}

export default async function PerformancePage() {
  await connection();
  const finance = await loadFinanceBundle();
  const latest = finance.latest;

  return (
    <PageBody className="gap-4 pt-0">
      <AdminPageHeader
        title="أداء المشروع"
        description="GMV → إيراد المنصة → مجمل الربح → صافي تقديري · مصادر منفصلة"
        searchPlaceholder="دور على شهر أو مؤشر..."
        stats={[
          {
            label: 'GMV',
            value: latest ? fmtK(latest.gmv) : '—',
            icon: <TrendingUp className="size-3.5" />,
            hint: latest ? String(latest.label_ar) : undefined,
          },
          {
            label: 'صافي إيرادات',
            value: latest ? fmtK(latest.net_revenue) : '—',
            icon: <LineChart className="size-3.5" />,
          },
          {
            label: 'مبيعات بياعين',
            value: latest ? fmtK(latest.own_sales) : '—',
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'رسوم السوق',
            value: latest ? fmtK(latest.marketplace_fee) : '—',
            icon: <BadgePercent className="size-3.5" />,
          },
        ]}
      />

      <div className="by-note">
        سلم الأرقام الأربعة منفصلين: GMV مش إيراد · صافي الإيرادات من (منتجات
        بياعين + رسوم السوق + الاشتراكات) · بعد التكلفة والعمولات يطلع الصافي
        التقديري.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['GMV', latest?.gmv, '#0B0F2E'],
            ['صافي إيرادات المنصة', latest?.net_revenue, '#7A00FF'],
            ['مجمل الربح', latest?.gross_profit, '#0A8FB8'],
            ['صافي تقديري', latest?.net_profit, '#0A6B37'],
          ] as const
        ).map(([label, value, color]) => (
          <div
            key={label}
            className="by-card"
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div className="text-muted-foreground text-xs font-semibold">
              {label}
            </div>
            <div
              className="mt-1 text-[22px] font-extrabold"
              style={{ color }}
              data-numeric
            >
              {value == null ? '—' : fmtK(value)}
            </div>
          </div>
        ))}
      </div>

      <div className="by-card">
        <h2 className="text-[15px] font-bold">مقارنة شهرية</h2>
        <div className="border-border mt-3 overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">الشهر</TableHead>
                <TableHead className="text-right font-bold">GMV</TableHead>
                <TableHead className="text-right font-bold">إيرادات</TableHead>
                <TableHead className="text-right font-bold">مجمل</TableHead>
                <TableHead className="text-right font-bold">صافي</TableHead>
                <TableHead className="text-right font-bold">طلبات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finance.months.map((m) => (
                <TableRow key={String(m.id)}>
                  <TableCell className="font-semibold">
                    {String(m.label_ar)}
                  </TableCell>
                  <TableCell data-numeric>{fmtK(m.gmv)}</TableCell>
                  <TableCell data-numeric>{fmtK(m.net_revenue)}</TableCell>
                  <TableCell data-numeric>{fmtK(m.gross_profit)}</TableCell>
                  <TableCell data-numeric>{fmtK(m.net_profit)}</TableCell>
                  <TableCell data-numeric>{m.orders_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageBody>
  );
}

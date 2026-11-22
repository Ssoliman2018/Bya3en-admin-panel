'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import {
  RotateCcw,
  Search,
  ShoppingBag,
  UserPlus,
  Users,
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
import type {
  CustomerRow,
  CustomersSummary,
} from '../_lib/server/customers.loader';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function CustomersScreen({
  customers,
  summary,
}: {
  customers: CustomerRow[];
  summary: CustomersSummary;
}) {
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) => {
      const hay = `${c.name} ${c.governorate} ${c.phoneMasked}`.toLowerCase();
      return hay.includes(query);
    });
  }, [customers, q]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="العملاء"
        description="بيانات العملاء للإدارة والدعم فقط · التجار يشوفوا عنوان الشحن لطلباتهم، والبيّاعين مابيشوفوش أي بيانات"
        searchPlaceholder="دور على عميل أو محافظة..."
        stats={[
          {
            label: 'عملاء نشطين (90 يوم)',
            value: summary.active90,
            icon: <Users className="size-3.5" />,
            hint: `${summary.total} إجمالي`,
          },
          {
            label: 'عملاء جداد الشهر ده',
            value: summary.newThisMonth,
            icon: <UserPlus className="size-3.5" />,
          },
          {
            label: 'متوسط قيمة الطلب',
            value: fmt(summary.avgOrderValue),
            icon: <Wallet className="size-3.5" />,
            hint: 'EGP',
          },
          {
            label: 'نسبة المرتجعات',
            value: `${summary.returnRatePct}%`,
            icon: <RotateCcw className="size-3.5" />,
          },
        ]}
      />

      <div className="by-list-tools">
        <div className="by-fbar" style={{ paddingTop: 0 }}>
          <label className="by-wsearch">
            <Search aria-hidden />
            <input
              value={q}
              placeholder="اسم العميل أو المحافظة"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <span className="by-fbar__count">
            <span className="num">{visible.length}</span> عميل
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          مفيش عملاء مطابقين للبحث.
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">العميل</TableHead>
                <TableHead className="text-right font-bold">المحافظة</TableHead>
                <TableHead className="text-right font-bold">الموبايل</TableHead>
                <TableHead className="text-right font-bold">طلبات</TableHead>
                <TableHead className="text-right font-bold">
                  إجمالي المشتريات
                </TableHead>
                <TableHead className="text-right font-bold">مرتجعات</TableHead>
                <TableHead className="text-right font-bold">آخر طلب</TableHead>
                <TableHead className="text-right font-bold" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-bold">{customer.name}</TableCell>
                  <TableCell className="text-[13px]">
                    {customer.governorate}
                  </TableCell>
                  <TableCell>
                    <span className="num text-[12.5px]" data-numeric>
                      {customer.phoneMasked}
                    </span>
                  </TableCell>
                  <TableCell data-numeric>{customer.ordersCount}</TableCell>
                  <TableCell className="font-semibold" data-numeric>
                    {fmt(customer.spentEgp)}
                  </TableCell>
                  <TableCell data-numeric>{customer.returnsCount}</TableCell>
                  <TableCell>
                    <div className="text-[12.5px]" data-numeric>
                      {new Date(customer.lastOrderAt).toLocaleDateString(
                        'ar-EG',
                      )}
                    </div>
                    {customer.lastOrderCode ? (
                      <Link
                        href={`${pathsConfig.app.orders}`}
                        className="text-primary num text-[11.5px] font-semibold hover:underline"
                        data-numeric
                      >
                        {customer.lastOrderCode}
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-[12px] font-bold"
                        onClick={() =>
                          toast.success(
                            'ملف العميل والتذاكر · محاكاة · هيتفعّل مع تذاكر الدعم',
                          )
                        }
                      >
                        ملف العميل
                      </Button>
                      <Button
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-[12px] font-bold"
                        render={
                          <Link
                            href={`${pathsConfig.app.orders}?q=${encodeURIComponent(customer.name)}`}
                          />
                        }
                      >
                        <ShoppingBag className="size-3.5" />
                        الطلبات
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

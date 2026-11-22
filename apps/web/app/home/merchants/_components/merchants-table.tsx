'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { toast } from '@kit/ui/sonner';

import { updateMerchantStatusAction } from '../_lib/server/merchants.actions';

type MerchantRow = {
  id: string;
  store_name: string;
  legal_name: string | null;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  governorate: string | null;
  marketplace_fee_pct: number;
  status: string;
  categories: { name_ar: string } | null;
};

const statusLabel: Record<string, string> = {
  pending: 'بانتظار المراجعة',
  active: 'نشط',
  suspended: 'موقوف',
  rejected: 'مرفوض',
};

const statusTone: Record<string, string> = {
  pending: 'amber',
  active: 'green',
  suspended: 'blue',
  rejected: 'red',
};

export function MerchantsTable({ merchants }: { merchants: MerchantRow[] }) {
  const [pending, startTransition] = useTransition();

  if (merchants.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        مفيش تجار في الفلتر ده.
      </div>
    );
  }

  function setStatus(
    merchantId: string,
    status: 'active' | 'suspended' | 'rejected' | 'pending',
  ) {
    startTransition(async () => {
      try {
        await updateMerchantStatusAction({
          merchantId,
          status,
          rejectionReason:
            status === 'rejected' ? 'مرفوض من لوحة الإدارة' : undefined,
        });
        toast.success('اتحدثت حالة التاجر');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث الحالة',
        );
      }
    });
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">المتجر</TableHead>
            <TableHead className="text-right">القسم</TableHead>
            <TableHead className="text-right">المدينة</TableHead>
            <TableHead className="text-right">رسوم السوق</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {merchants.map((merchant) => (
            <TableRow key={merchant.id}>
              <TableCell>
                <Link
                  href={`/home/merchants/${merchant.id}`}
                  className="hover:text-primary font-medium"
                >
                  {merchant.store_name}
                </Link>
                <div className="text-muted-foreground text-xs">
                  {merchant.contact_name ?? merchant.legal_name ?? '—'}
                  {merchant.phone ? ` · ${merchant.phone}` : ''}
                </div>
              </TableCell>
              <TableCell>{merchant.categories?.name_ar ?? '—'}</TableCell>
              <TableCell>
                {[merchant.city, merchant.governorate].filter(Boolean).join('، ') ||
                  '—'}
              </TableCell>
              <TableCell>{Number(merchant.marketplace_fee_pct)}%</TableCell>
              <TableCell>
                <span
                  className={`by-st ${statusTone[merchant.status] ?? 'violet'}`}
                >
                  {statusLabel[merchant.status] ?? merchant.status}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/home/merchants/${merchant.id}`} />}
                  >
                    فتح
                  </Button>
                  {merchant.status !== 'active' ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(merchant.id, 'active')}
                    >
                      موافقة
                    </Button>
                  ) : null}
                  {merchant.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setStatus(merchant.id, 'suspended')}
                    >
                      إيقاف
                    </Button>
                  ) : null}
                  {merchant.status === 'pending' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => setStatus(merchant.id, 'rejected')}
                    >
                      رفض
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

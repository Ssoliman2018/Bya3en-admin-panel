import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { ArrowRight, BadgePercent, MapPin, Store, User } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../../_components/admin-page-header';
import { MerchantDetailActions } from '../_components/merchant-detail-actions';
import { loadMerchant } from '../_lib/server/merchants.loader';

export const metadata = { title: 'تفاصيل التاجر' };

const statusTone: Record<string, string> = {
  pending: 'amber',
  active: 'green',
  suspended: 'blue',
  rejected: 'red',
};

const statusLabel: Record<string, string> = {
  pending: 'بانتظار المراجعة',
  active: 'نشط',
  suspended: 'موقوف',
  rejected: 'مرفوض',
};

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  await connection();
  const { merchantId } = await params;
  const merchant = await loadMerchant(merchantId);

  if (!merchant) {
    notFound();
  }

  return (
    <PageBody className="gap-6 pt-0">
      <AdminPageHeader
        title={merchant.store_name}
        description="ملف التاجر · الرسوم · قرارات الموافقة"
        searchPlaceholder="دور على تاجر آخر..."
        stats={[
          {
            label: 'الحالة',
            value: statusLabel[merchant.status] ?? merchant.status,
            icon: <Store className="size-3.5" />,
          },
          {
            label: 'رسوم السوق',
            value: `${Number(merchant.marketplace_fee_pct)}%`,
            icon: <BadgePercent className="size-3.5" />,
          },
          {
            label: 'المدينة',
            value: merchant.city || '—',
            icon: <MapPin className="size-3.5" />,
            hint: merchant.governorate ?? undefined,
          },
          {
            label: 'المسؤول',
            value: merchant.contact_name || '—',
            icon: <User className="size-3.5" />,
          },
        ]}
        actions={
          <Button
            nativeButton={false}
            className="by-hero-btn by-hero-btn-secondary"
            render={<Link href={pathsConfig.app.merchants} />}
          >
            <ArrowRight className="size-4" />
            رجوع للتجار
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="by-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold">بيانات المتجر</h2>
            <span className={`by-st ${statusTone[merchant.status] ?? 'violet'}`}>
              {statusLabel[merchant.status] ?? merchant.status}
            </span>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                الاسم القانوني
              </dt>
              <dd className="mt-1 font-semibold">
                {merchant.legal_name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                المسؤول
              </dt>
              <dd className="mt-1 font-semibold">
                {merchant.contact_name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                الهاتف
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {merchant.phone ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                البريد
              </dt>
              <dd className="mt-1 font-semibold">{merchant.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                المدينة
              </dt>
              <dd className="mt-1 font-semibold">
                {[merchant.city, merchant.governorate]
                  .filter(Boolean)
                  .join('، ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                القسم
              </dt>
              <dd className="mt-1 font-semibold">
                {merchant.categories?.name_ar ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                السجل التجاري
              </dt>
              <dd className="mt-1 font-semibold">
                {merchant.cr_number ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                تاريخ التقديم
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {new Date(merchant.created_at).toLocaleDateString('ar-EG')}
              </dd>
            </div>
          </dl>

          {merchant.rejection_reason ? (
            <div className="rounded-xl border border-[#F3A9A3] bg-[#FDE7E5] px-3 py-2 text-sm font-medium text-[#B3261E]">
              سبب الرفض: {merchant.rejection_reason}
            </div>
          ) : null}
        </div>

        <MerchantDetailActions
          merchantId={merchant.id}
          status={merchant.status}
          marketplaceFeePct={Number(merchant.marketplace_fee_pct)}
          notes={merchant.notes ?? ''}
        />
      </div>
    </PageBody>
  );
}

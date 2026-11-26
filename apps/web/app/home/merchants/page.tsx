import Link from 'next/link';
import { connection } from 'next/server';

import { BadgeCheck, Clock3, Store, UserX } from 'lucide-react';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../_components/admin-page-header';
import { MerchantsTable } from './_components/merchants-table';
import {
  loadMerchantCounts,
  loadMerchants,
} from './_lib/server/merchants.loader';

export const metadata = { title: 'التجار' };

const filters = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'بانتظار المراجعة' },
  { id: 'active', label: 'نشط' },
  { id: 'suspended', label: 'موقوف' },
  { id: 'rejected', label: 'مرفوض' },
] as const;

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const status = params.status ?? 'all';
  const [merchants, counts] = await Promise.all([
    loadMerchants(status),
    loadMerchantCounts(),
  ]);

  return (
    <PageBody className="gap-4 pt-0">
      <AdminPageHeader
        title="التجار"
        description="طلبات التسجيل والموافقة ورسوم السوق"
        searchPlaceholder="دور على تاجر، مدينة، أو قسم..."
        stats={[
          {
            label: 'كل التجار',
            value: counts.all,
            icon: <Store className="size-3.5" />,
          },
          {
            label: 'بانتظار المراجعة',
            value: counts.pending,
            icon: <Clock3 className="size-3.5" />,
          },
          {
            label: 'نشط',
            value: counts.active,
            icon: <BadgeCheck className="size-3.5" />,
          },
          {
            label: 'موقوف / مرفوض',
            value: counts.suspended + counts.rejected,
            icon: <UserX className="size-3.5" />,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const count =
            filter.id === 'all'
              ? counts.all
              : counts[filter.id as keyof typeof counts];
          const href =
            filter.id === 'all'
              ? pathsConfig.app.merchants
              : `${pathsConfig.app.merchants}?status=${filter.id}`;
          const active = status === filter.id;

          return (
            <Link
              key={filter.id}
              href={href}
              className={
                active
                  ? 'rounded-full border border-[#7A00FF] bg-[#F1E8FF] px-3 py-1.5 text-[12.5px] font-semibold text-[#5E00C7]'
                  : 'rounded-full border border-[#E2E0EE] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#0B0F2E] hover:border-[#C9C4E6]'
              }
            >
              {filter.label} · {count}
            </Link>
          );
        })}
      </div>

      <MerchantsTable merchants={merchants} />
    </PageBody>
  );
}

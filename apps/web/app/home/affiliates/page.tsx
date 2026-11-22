import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { AffiliatesScreen } from './_components/affiliates-screen';
import type { AffiliateFilter } from './_lib/affiliates.constants';
import {
  loadAffiliateCounts,
  loadAffiliates,
  loadWithdrawals,
} from './_lib/server/affiliates.loader';

export const metadata = { title: 'البيّاعين' };

const FILTERS: AffiliateFilter[] = [
  'all',
  'pending',
  'flagged',
  'suspended',
  'wd',
];

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const filter = (
    FILTERS.includes(params.tab as AffiliateFilter) ? params.tab : 'all'
  ) as AffiliateFilter;

  const [counts, affiliates, withdrawals] = await Promise.all([
    loadAffiliateCounts(),
    filter === 'wd' ? Promise.resolve([]) : loadAffiliates(filter),
    loadWithdrawals(),
  ]);

  return (
    <PageBody className="gap-0 pt-0">
      <AffiliatesScreen
        filter={filter}
        affiliates={affiliates}
        withdrawals={withdrawals}
        counts={counts}
      />
    </PageBody>
  );
}

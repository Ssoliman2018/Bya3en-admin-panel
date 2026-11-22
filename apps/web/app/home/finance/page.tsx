import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import {
  FinanceScreen,
  type FinanceTab,
} from './_components/finance-screen';
import { loadFinanceBundle } from './_lib/server/finance.loader';

export const metadata = { title: 'المالية' };

const TABS: FinanceTab[] = ['overview', 'settle', 'recon', 'tx', 'profit'];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const tab = (
    TABS.includes(params.tab as FinanceTab) ? params.tab : 'overview'
  ) as FinanceTab;
  const data = await loadFinanceBundle();

  return (
    <PageBody className="gap-0 pt-0">
      <FinanceScreen tab={tab} data={data} />
    </PageBody>
  );
}

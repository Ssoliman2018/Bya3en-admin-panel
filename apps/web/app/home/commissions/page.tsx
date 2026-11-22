import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { CommissionsScreen } from './_components/commissions-screen';
import {
  COMMISSION_TABS,
  type CommissionTab,
} from './_lib/commissions.constants';
import { loadCommissionBundle } from './_lib/server/commissions.loader';

export const metadata = { title: 'محرك العمولات' };

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const tab = (
    COMMISSION_TABS.includes(params.tab as CommissionTab)
      ? params.tab
      : 'rules'
  ) as CommissionTab;

  const data = await loadCommissionBundle();

  return (
    <PageBody className="gap-0 pt-0">
      <CommissionsScreen tab={tab} data={data} />
    </PageBody>
  );
}

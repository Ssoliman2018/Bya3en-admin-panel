import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import {
  SubscriptionsScreen,
  type SubscriptionsTab,
} from './_components/subscriptions-screen';
import { loadSubscriptionsBundle } from './_lib/server/subscriptions.loader';

export const metadata = { title: 'إدارة الاشتراكات' };

const TABS: SubscriptionsTab[] = [
  'packages',
  'list',
  'pay',
  'promo',
  'policy',
];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const tab = (
    TABS.includes(params.tab as SubscriptionsTab) ? params.tab : 'packages'
  ) as SubscriptionsTab;
  const data = await loadSubscriptionsBundle();

  return (
    <PageBody className="gap-0 pt-0">
      <SubscriptionsScreen tab={tab} data={data} />
    </PageBody>
  );
}

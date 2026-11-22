import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { CustomersScreen } from './_components/customers-screen';
import { loadCustomers } from './_lib/server/customers.loader';

export const metadata = { title: 'العملاء' };

export default async function CustomersPage() {
  await connection();
  const { customers, summary } = await loadCustomers();

  return (
    <PageBody className="gap-0 pt-0">
      <CustomersScreen customers={customers} summary={summary} />
    </PageBody>
  );
}

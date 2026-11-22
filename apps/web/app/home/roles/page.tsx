import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { RolesScreen } from './_components/roles-screen';
import { loadRolesBundle } from './_lib/server/roles.loader';

export const metadata = { title: 'الأدوار والصلاحيات' };

export default async function RolesPage() {
  await connection();
  const data = await loadRolesBundle();

  return (
    <PageBody className="gap-0 pt-0">
      <RolesScreen data={data} />
    </PageBody>
  );
}

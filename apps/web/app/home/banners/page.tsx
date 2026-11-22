import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { BannersScreen } from './_components/banners-screen';
import {
  loadBannerCounts,
  loadHomeBanners,
} from './_lib/server/banners.loader';

export const metadata = { title: 'إعلانات الهوم' };

export default async function BannersPage() {
  await connection();
  const banners = await loadHomeBanners();
  const counts = await loadBannerCounts(banners);

  return (
    <PageBody className="gap-0 pt-0">
      <BannersScreen banners={banners} counts={counts} />
    </PageBody>
  );
}

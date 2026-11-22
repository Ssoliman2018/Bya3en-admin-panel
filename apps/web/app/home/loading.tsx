import { PageBody } from '@kit/ui/page';

import { ChartCardsSkeleton } from '~/components/skeletons/page-skeletons';

export default function HomeLoading() {
  return (
    <PageBody className="gap-6 pt-0">
      <section className="by-module-hero">
        <div className="by-module-hero__bg" aria-hidden />
        <div className="by-module-hero__inner">
          <div className="by-module-hero__toolbar">
            <div className="by-module-hero__search h-11 w-full max-w-md animate-pulse bg-white/90" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-white/15" />
          </div>
          <div className="by-module-hero__title-row">
            <div className="h-9 w-48 animate-pulse rounded-lg bg-white/20" />
          </div>
          <div className="by-module-hero__stats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="by-module-hero__stat h-[88px] animate-pulse" />
            ))}
          </div>
        </div>
      </section>

      <ChartCardsSkeleton />
    </PageBody>
  );
}

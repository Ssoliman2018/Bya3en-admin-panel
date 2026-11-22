import { Construction, Layers3, Sparkles, Timer } from 'lucide-react';
import { PageBody } from '@kit/ui/page';

import { AdminPageHeader } from './admin-page-header';

export function SectionPlaceholder({
  title,
  description,
  phase = 'قريبًا',
  bullets = [],
}: {
  title: string;
  description: string;
  phase?: string;
  bullets?: string[];
}) {
  return (
    <PageBody className="pt-0">
      <AdminPageHeader
        title={title}
        description={description}
        searchPlaceholder={`دور في ${title}...`}
        stats={[
          {
            label: 'الحالة',
            value: 'قريبًا',
            icon: <Timer className="size-3.5" />,
            hint: phase,
          },
          {
            label: 'النطاق',
            value: bullets.length || '—',
            icon: <Layers3 className="size-3.5" />,
            hint: 'بنود مخططة',
          },
          {
            label: 'الأولوية',
            value: 'BRD',
            icon: <Sparkles className="size-3.5" />,
          },
          {
            label: 'البناء',
            value: 'تحت التجهيز',
            icon: <Construction className="size-3.5" />,
          },
        ]}
        actions={
          <span className="by-hero-btn by-hero-btn-secondary inline-flex items-center">
            <b className="num me-1">SOON</b>
            {phase}
          </span>
        }
      />

      <div className="by-card max-w-3xl">
        <h2 className="text-[15px] font-bold">القسم تحت التجهيز</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          ده جزء من لوحة إدارة بياعين حسب الـ BRD. هنكمّله بعد تثبيت مسار
          الكتالوج والتجار والطلبات.
        </p>
        {bullets.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {bullets.map((item) => (
              <li key={item} className="by-decision-row text-sm font-semibold">
                <span>{item}</span>
                <span className="by-decision-count">·</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </PageBody>
  );
}

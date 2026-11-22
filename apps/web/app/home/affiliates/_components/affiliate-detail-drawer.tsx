'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@kit/ui/drawer';
import { toast } from '@kit/ui/sonner';
import { Check, Flag, Pause, X } from 'lucide-react';

import { updateAffiliateStatusAction } from '../_lib/server/affiliates.actions';
import type { AffiliateRow } from '../_lib/server/affiliates.loader';
import {
  AFFILIATE_STATUS_AR,
  AFFILIATE_STATUS_TONE,
  TIER_AR,
} from '../_lib/affiliates.constants';

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function AffiliateDetailDrawer({
  affiliate,
  open,
  onOpenChange,
  onChanged,
}: {
  affiliate: AffiliateRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  if (!affiliate) return null;

  const conversion =
    affiliate.clicks_30d > 0
      ? ((affiliate.orders_count / affiliate.clicks_30d) * 100).toFixed(1)
      : '0';

  function setStatus(
    status: 'pending' | 'active' | 'suspended' | 'rejected',
    suspendReason?: string,
  ) {
    startTransition(async () => {
      try {
        await updateAffiliateStatusAction({
          affiliateId: affiliate!.id,
          status,
          suspendReason,
        });
        toast.success(`الحالة بقت: ${AFFILIATE_STATUS_AR[status]}`);
        onChanged?.();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث الحالة',
        );
      }
    });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="left"
      shouldScaleBackground={false}
    >
      <DrawerContent
        dir="rtl"
        className="!h-full !w-full !max-w-[min(560px,100vw)] rounded-none border-[#E2E0EE] bg-white data-[vaul-drawer-direction=left]:rounded-e-2xl"
      >
        <DrawerHeader className="border-border flex-row items-center gap-3 border-b px-5 py-4 text-right md:text-right">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-[18px] font-extrabold">
              {affiliate.name}{' '}
              <span className="text-muted-foreground num text-[13px] font-semibold">
                {affiliate.code}
              </span>
            </DrawerTitle>
            <DrawerDescription className="mt-1 text-[12.5px]">
              {affiliate.governorate ?? '—'} · {affiliate.phone_masked ?? '—'}
            </DrawerDescription>
          </div>
          <DrawerClose className="bg-muted hover:bg-muted/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <span
              className={`by-st ${AFFILIATE_STATUS_TONE[affiliate.status]}`}
            >
              {AFFILIATE_STATUS_AR[affiliate.status]}
            </span>
            <span className="by-st violet">
              {TIER_AR[affiliate.membership_tier] ?? affiliate.membership_tier}
            </span>
            {affiliate.is_live_demo ? (
              <span className="by-st green">متصل بالتطبيق</span>
            ) : null}
          </div>

          {affiliate.flags.length > 0 ? (
            <div>
              <h3 className="mb-2 text-[13px] font-bold">مؤشرات احتيال</h3>
              <div className="space-y-2">
                {affiliate.flags.map((flag) => (
                  <div
                    key={flag}
                    className="flex items-start gap-2 rounded-xl border border-[#F3A9A3] bg-[#FDE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B3261E]"
                  >
                    <Flag className="mt-0.5 size-3.5 shrink-0" />
                    {flag}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-[11.5px]">
                مؤشرات آلية للمراجعة · مش حكم نهائي.
              </p>
            </div>
          ) : null}

          {affiliate.suspend_reason ? (
            <div className="rounded-xl border border-[#F3A9A3] bg-[#FDE7E5] px-3 py-2 text-sm font-medium text-[#B3261E]">
              {affiliate.suspend_reason}
            </div>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                انضم
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {new Date(affiliate.joined_at).toLocaleDateString('ar-EG')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                ضغطات 30 يوم
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {fmt(affiliate.clicks_30d)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                طلبات منسوبة
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {affiliate.orders_count}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                تحويل
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {conversion}%
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                إجمالي الأرباح
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {fmt(affiliate.earnings_egp)} EGP
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold">
                معلّق
              </dt>
              <dd className="mt-1 font-semibold" data-numeric>
                {fmt(affiliate.pending_egp)} EGP
              </dd>
            </div>
          </dl>

          <p className="rounded-xl border border-[#E2E0EE] bg-[#F8F7FC] px-3 py-2 text-[12.5px] leading-6">
            نسب العمولة بتتحدد حسب المنتج (محرك العمولات)، مش حسب باقة العضوية.
            الباقة بتفتح أدوات وتحليلات بس.
          </p>
        </div>

        <DrawerFooter className="border-border flex-row flex-wrap justify-start gap-2 border-t px-5 py-4">
          {affiliate.status === 'pending' ? (
            <>
              <Button
                className="rounded-[10px] font-bold"
                disabled={pending}
                onClick={() => setStatus('active')}
              >
                <Check className="size-4" />
                وافق
              </Button>
              <Button
                variant="outline"
                className="rounded-[10px] border-[#F3A9A3] font-bold text-[#B3261E] hover:bg-[#FDE7E5]"
                disabled={pending}
                onClick={() => setStatus('rejected')}
              >
                ارفض
              </Button>
            </>
          ) : null}
          {affiliate.status === 'suspended' ? (
            <Button
              className="rounded-[10px] font-bold"
              disabled={pending}
              onClick={() => setStatus('active')}
            >
              <Check className="size-4" />
              رجّع الحساب
            </Button>
          ) : null}
          {affiliate.status === 'active' ? (
            <Button
              variant="outline"
              className="rounded-[10px] border-[#F3A9A3] font-bold text-[#B3261E] hover:bg-[#FDE7E5]"
              disabled={pending}
              onClick={() =>
                setStatus(
                  'suspended',
                  'موقوف بقرار الإدارة لمراجعة مؤشرات احتيال',
                )
              }
            >
              <Pause className="size-4" />
              إيقاف
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

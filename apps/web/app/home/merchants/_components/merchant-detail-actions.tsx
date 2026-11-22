'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  updateMerchantFeeAction,
  updateMerchantStatusAction,
} from '../_lib/server/merchants.actions';

export function MerchantDetailActions({
  merchantId,
  status,
  marketplaceFeePct,
  notes,
}: {
  merchantId: string;
  status: string;
  marketplaceFeePct: number;
  notes: string;
}) {
  const [pending, startTransition] = useTransition();

  function setStatus(
    next: 'active' | 'suspended' | 'rejected' | 'pending',
    rejectionReason?: string,
  ) {
    startTransition(async () => {
      try {
        await updateMerchantStatusAction({
          merchantId,
          status: next,
          rejectionReason,
        });
        toast.success('اتحدثت حالة التاجر');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث الحالة',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="by-card space-y-3">
        <h2 className="text-[15px] font-bold">قرارات</h2>
        <div className="flex flex-wrap gap-2">
          {status !== 'active' ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => setStatus('active')}
            >
              موافقة وتفعيل
            </Button>
          ) : null}
          {status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setStatus('suspended')}
            >
              إيقاف مؤقت
            </Button>
          ) : null}
          {status === 'pending' || status === 'active' ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                setStatus('rejected', 'مرفوض من لوحة الإدارة بعد المراجعة')
              }
            >
              رفض
            </Button>
          ) : null}
        </div>
      </div>

      <form
        className="by-card space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          startTransition(async () => {
            try {
              await updateMerchantFeeAction({
                merchantId,
                marketplaceFeePct: Number(formData.get('marketplaceFeePct')),
                notes: String(formData.get('notes') ?? '') || undefined,
              });
              toast.success('اتحفظت رسوم السوق والملاحظات');
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : 'فشل الحفظ',
              );
            }
          });
        }}
      >
        <h2 className="text-[15px] font-bold">رسوم السوق</h2>
        <div className="grid gap-2">
          <Label htmlFor="marketplaceFeePct">نسبة رسوم السوق %</Label>
          <Input
            id="marketplaceFeePct"
            name="marketplaceFeePct"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={marketplaceFeePct}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">ملاحظات داخلية</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            dir="rtl"
            defaultValue={notes}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'جاري الحفظ...' : 'حفظ الرسوم'}
        </Button>
      </form>
    </div>
  );
}

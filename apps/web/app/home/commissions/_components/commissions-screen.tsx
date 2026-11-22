'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  BadgePercent,
  ListTree,
  Percent,
  Plus,
  ShieldCheck,
  Store,
  Tags,
} from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../../_components/admin-page-header';
import {
  COMMISSION_TAB_AR,
  COMMISSION_TABS,
  type CommissionTab,
} from '../_lib/commissions.constants';
import {
  createCampaignAction,
  saveCommissionRulesAction,
  toggleCampaignAction,
  toggleEligibilityAction,
  updateCategoryRateAction,
  updateCommissionMerchantFeeAction,
  updateCommissionProductRateAction,
} from '../_lib/server/commissions.actions';
import type { loadCommissionBundle } from '../_lib/server/commissions.loader';

type Bundle = Awaited<ReturnType<typeof loadCommissionBundle>>;

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

export function CommissionsScreen({
  tab,
  data,
}: {
  tab: CommissionTab;
  data: Bundle;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState(data.settings);
  const [campaignForm, setCampaignForm] = useState({
    nameAr: 'أسبوع الجمال',
    categoryId: data.categories[0]?.id ?? 'beauty',
    extraRatePct: 2,
    startsInDays: 0,
    durationDays: 7,
  });

  const tabHref = (id: CommissionTab) =>
    id === 'rules'
      ? pathsConfig.app.commissions
      : `${pathsConfig.app.commissions}?tab=${id}`;

  function run(action: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'فشل الحفظ');
      }
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="محرك العمولات"
        description="نسبة البيّاع حسب المنتج والقسم والحملات · رسوم السوق والاشتراكات منفصلة تمامًا"
        searchPlaceholder="دور على منتج أو قسم..."
        stats={[
          {
            label: 'عمولة افتراضية',
            value: `${data.settings.default_rate}%`,
            icon: <Percent className="size-3.5" />,
          },
          {
            label: 'حملات نشطة',
            value: data.activeCampaigns,
            icon: <Tags className="size-3.5" />,
          },
          {
            label: 'فترة الإتاحة',
            value: data.settings.hold_days,
            icon: <ShieldCheck className="size-3.5" />,
            hint: 'يوم بعد التسليم',
          },
          {
            label: 'أقل سحب',
            value: fmt(data.settings.min_withdraw_egp),
            icon: <BadgePercent className="size-3.5" />,
            hint: 'EGP',
          },
        ]}
        actions={
          tab === 'campaigns' ? (
            <Button
              className="by-hero-btn by-hero-btn-primary"
              disabled={pending}
              onClick={() =>
                run(
                  () => createCampaignAction(campaignForm),
                  'اتعملت الحملة',
                )
              }
            >
              <Plus className="size-4" />
              حملة جديدة
            </Button>
          ) : undefined
        }
      />

      <div className="by-list-tools">
        <nav className="by-wtabs" aria-label="أقسام محرك العمولات">
          {COMMISSION_TABS.map((id) => {
            const on = tab === id;
            const count =
              id === 'campaigns' ? data.activeCampaigns : undefined;
            return (
              <Link
                key={id}
                href={tabHref(id)}
                className={on ? 'on' : undefined}
              >
                {COMMISSION_TAB_AR[id]}
                {count != null ? (
                  <span className={`ct ${count > 0 ? 'hot' : ''}`}>{count}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === 'rules' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="by-card space-y-4">
            <div>
              <h2 className="text-[15px] font-bold">قواعد عامة</h2>
              <p className="text-muted-foreground mt-1 text-[12.5px]">
                بتسري على الطلبات الجديدة بس
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['default_rate', 'العمولة الافتراضية %', rules.default_rate],
                  ['hold_days', 'فترة الإتاحة بعد التسليم (يوم)', rules.hold_days],
                  ['attr_days', 'نافذة الإحالة (يوم)', rules.attr_days],
                  [
                    'min_withdraw_egp',
                    'أقل مبلغ للسحب (EGP)',
                    rules.min_withdraw_egp,
                  ],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[12px]">{label}</Label>
                  <Input
                    className="num h-10 rounded-[10px]"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) =>
                      setRules((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              className="rounded-[10px] font-bold"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveCommissionRulesAction({
                      defaultRate: rules.default_rate,
                      holdDays: rules.hold_days,
                      attrDays: rules.attr_days,
                      minWithdrawEgp: rules.min_withdraw_egp,
                    }),
                  'اتحفظت القواعد · بتسري على الطلبات الجديدة',
                )
              }
            >
              احفظ القواعد
            </Button>
          </div>

          <div className="by-card space-y-4">
            <div>
              <h2 className="inline-flex items-center gap-2 text-[15px] font-bold">
                <ListTree className="size-4 text-[#7A00FF]" />
                ترتيب الأولوية
              </h2>
              <p className="text-muted-foreground mt-1 text-[12.5px]">
                النسبة الأخص هي اللي بتتطبق
              </p>
            </div>
            <ol className="space-y-2 pr-4 text-[13px] font-semibold leading-7">
              <li>نسبة المنتج (لو متحددة)</li>
              <li>+ حملة ترويجية شغّالة على القسم</li>
              <li>نسبة القسم</li>
              <li>النسبة الافتراضية</li>
            </ol>

            <h3 className="pt-2 text-[14px] font-bold">نسب الأقسام</h3>
            <div className="border-border overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                    <TableHead className="text-right font-bold">القسم</TableHead>
                    <TableHead className="text-right font-bold">النسبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categoryRates.map((c) => (
                    <TableRow key={c.category_id}>
                      <TableCell className="font-semibold">{c.name_ar}</TableCell>
                      <TableCell>
                        <input
                          className="by-cell-input"
                          defaultValue={c.rate_pct}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const ratePct = Number(e.target.value);
                            if (
                              Number.isNaN(ratePct) ||
                              ratePct === c.rate_pct
                            ) {
                              return;
                            }
                            run(
                              () =>
                                updateCategoryRateAction({
                                  categoryId: c.category_id,
                                  ratePct,
                                }),
                              'اتحفظت نسبة القسم',
                            );
                          }}
                        />
                        <span className="text-muted-foreground ms-1 text-xs">
                          %
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="by-note !mb-0">
              باقة عضوية البيّاع (Starter / Pro / Elite){' '}
              <b>مابتغيّرش</b> نسبة العمولة. بتفتح أدوات وتحليلات بس.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'products' ? (
        <>
          <div className="by-note">
            أي تعديل هنا بيظهر للبيّاعين في التطبيق (منتجات للتسويق ومولّد
            اللينكات).
          </div>
          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                  <TableHead className="text-right font-bold">المنتج</TableHead>
                  <TableHead className="text-right font-bold">الملكية</TableHead>
                  <TableHead className="text-right font-bold">السعر</TableHead>
                  <TableHead className="text-right font-bold">
                    نسبة القسم
                  </TableHead>
                  <TableHead className="text-right font-bold">
                    نسبة المنتج
                  </TableHead>
                  <TableHead className="text-right font-bold">
                    ربح البيّاع / بيعة
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((p) => {
                  const rate = p.commission_rate ?? p.category_rate;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-semibold">{p.name_ar}</div>
                        <div className="text-muted-foreground text-[11.5px]">
                          {p.brand ?? p.category_name ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            p.owner_type === 'bayya3een'
                              ? 'by-own by'
                              : 'by-own mr'
                          }
                        >
                          {p.owner_type === 'bayya3een' ? 'بياعين' : 'تاجر'}
                        </span>
                      </TableCell>
                      <TableCell data-numeric>{fmt(p.price_egp)}</TableCell>
                      <TableCell data-numeric>{p.category_rate}%</TableCell>
                      <TableCell>
                        <input
                          className="by-cell-input"
                          defaultValue={rate}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const ratePct = Number(e.target.value);
                            if (Number.isNaN(ratePct) || ratePct === rate) {
                              return;
                            }
                            run(
                              () =>
                                updateCommissionProductRateAction({
                                  productId: p.id,
                                  ratePct,
                                }),
                              'اتحفظت نسبة المنتج',
                            );
                          }}
                        />
                        <span className="text-muted-foreground ms-1 text-xs">
                          %
                        </span>
                      </TableCell>
                      <TableCell data-numeric>
                        {fmt((p.price_egp * rate) / 100)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {tab === 'fees' ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">التاجر</TableHead>
                <TableHead className="text-right font-bold">الحالة</TableHead>
                <TableHead className="text-right font-bold">رسوم السوق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.merchants.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <Store className="size-3.5 text-[#7A00FF]" />
                      {m.store_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="by-st green">{m.status}</span>
                  </TableCell>
                  <TableCell>
                    <input
                      className="by-cell-input"
                      defaultValue={m.marketplace_fee_pct}
                      inputMode="numeric"
                      onBlur={(e) => {
                        const feePct = Number(e.target.value);
                        if (
                          Number.isNaN(feePct) ||
                          feePct === m.marketplace_fee_pct
                        ) {
                          return;
                        }
                        run(
                          () =>
                            updateCommissionMerchantFeeAction({
                              merchantId: m.id,
                              feePct,
                            }),
                          'اتحفظت رسوم التاجر',
                        );
                      }}
                    />
                    <span className="text-muted-foreground ms-1 text-xs">%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === 'campaigns' ? (
        <>
          <div className="by-card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-[12px]">اسم الحملة</Label>
              <Input
                className="h-10 rounded-[10px]"
                value={campaignForm.nameAr}
                onChange={(e) =>
                  setCampaignForm((p) => ({ ...p, nameAr: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">القسم</Label>
              <select
                className="by-fchip w-full"
                value={campaignForm.categoryId}
                onChange={(e) =>
                  setCampaignForm((p) => ({
                    ...p,
                    categoryId: e.target.value,
                  }))
                }
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">عمولة إضافية %</Label>
              <Input
                className="num h-10 rounded-[10px]"
                inputMode="numeric"
                value={campaignForm.extraRatePct}
                onChange={(e) =>
                  setCampaignForm((p) => ({
                    ...p,
                    extraRatePct: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">المدة (يوم)</Label>
              <Input
                className="num h-10 rounded-[10px]"
                inputMode="numeric"
                value={campaignForm.durationDays}
                onChange={(e) =>
                  setCampaignForm((p) => ({
                    ...p,
                    durationDays: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                  <TableHead className="text-right font-bold">الحملة</TableHead>
                  <TableHead className="text-right font-bold">القسم</TableHead>
                  <TableHead className="text-right font-bold">
                    عمولة إضافية
                  </TableHead>
                  <TableHead className="text-right font-bold">الفترة</TableHead>
                  <TableHead className="text-right font-bold">شغّالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <b>{c.name_ar}</b>
                      <div
                        className="text-muted-foreground num text-[11.5px]"
                        data-numeric
                      >
                        {c.code}
                      </div>
                    </TableCell>
                    <TableCell>{c.category_name ?? c.category_id}</TableCell>
                    <TableCell data-numeric>+{c.extra_rate_pct}%</TableCell>
                    <TableCell className="text-[12.5px]" data-numeric>
                      {new Date(c.starts_at).toLocaleDateString('ar-EG')} –{' '}
                      {new Date(c.ends_at).toLocaleDateString('ar-EG')}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className={`by-toggle ${c.is_active ? 'on' : ''}`}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              toggleCampaignAction({
                                campaignId: c.id,
                                isActive: !c.is_active,
                              }),
                            c.is_active
                              ? 'الحملة اتوقفت'
                              : 'الحملة اشتغلت',
                          )
                        }
                      >
                        <span />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-[12px]">
            الحملة بتزوّد عمولة البيّاع لفترة محدودة على قسم معيّن. مبتعدّش وعود
            بدخل.
          </p>
        </>
      ) : null}

      {tab === 'elig' ? (
        <div className="by-card space-y-1">
          {data.eligibility.map((e) => (
            <div
              key={e.key}
              className="flex items-center justify-between gap-3 border-b border-[#EFEEF6] py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{e.label_ar}</div>
                {e.is_locked ? (
                  <span className="by-st violet mt-1">ثابتة</span>
                ) : null}
              </div>
              <button
                type="button"
                className={`by-toggle ${e.is_enabled ? 'on' : ''}`}
                disabled={pending || e.is_locked}
                onClick={() =>
                  run(
                    () =>
                      toggleEligibilityAction({
                        key: e.key,
                        isEnabled: !e.is_enabled,
                      }),
                    e.is_enabled ? 'القاعدة اتوقفت' : 'القاعدة اتفعّلت',
                  )
                }
              >
                <span />
              </button>
            </div>
          ))}
          <p className="text-muted-foreground pt-2 text-[12px]">
            عكس العمولة عند الإلغاء أو الاسترجاع ثابت دايماً.
          </p>
        </div>
      ) : null}

      {tab === 'rev' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="by-card">
            <h2 className="text-[15px] font-bold">انعكاسات العمولة</h2>
            <p className="text-muted-foreground mt-1 text-[12.5px]">
              عمولات اتعكست بسبب إلغاء أو استرجاع
            </p>
            <div className="border-border mt-3 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                    <TableHead className="text-right font-bold">التاريخ</TableHead>
                    <TableHead className="text-right font-bold">الطلب</TableHead>
                    <TableHead className="text-right font-bold">البيّاع</TableHead>
                    <TableHead className="text-right font-bold">المبلغ</TableHead>
                    <TableHead className="text-right font-bold">السبب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reversals.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground text-center text-sm"
                      >
                        مفيش انعكاسات حالياً
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.reversals.map((r) => (
                      <TableRow key={`${r.order_code}-${r.date}`}>
                        <TableCell data-numeric>
                          {new Date(r.date).toLocaleDateString('ar-EG')}
                        </TableCell>
                        <TableCell data-numeric>{r.order_code}</TableCell>
                        <TableCell data-numeric>{r.affiliate_code}</TableCell>
                        <TableCell
                          className="font-semibold text-[#B3261E]"
                          data-numeric
                        >
                          −{fmt(r.amount)}
                        </TableCell>
                        <TableCell>{r.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="by-card">
            <h2 className="text-[15px] font-bold">سجل التغييرات</h2>
            <p className="text-muted-foreground mt-1 text-[12.5px]">
              مين غيّر إيه
            </p>
            <div className="border-border mt-3 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                    <TableHead className="text-right font-bold">التاريخ</TableHead>
                    <TableHead className="text-right font-bold">التغيير</TableHead>
                    <TableHead className="text-right font-bold">بواسطة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.changeLog.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell data-numeric>
                        {new Date(row.created_at).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell className="text-[12.5px]">{row.what}</TableCell>
                      <TableCell>{row.who}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

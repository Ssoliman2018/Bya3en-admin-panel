'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  ImageIcon,
  Megaphone,
  Plus,
  Power,
  Trash2,
  Upload,
} from 'lucide-react';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
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

import { AdminPageHeader } from '../../_components/admin-page-header';
import type { HomeBannerRow } from '../_lib/server/banners.loader';
import {
  deleteBannerAction,
  toggleBannerAction,
  upsertBannerAction,
} from '../_lib/server/banners.actions';

const BANNER_BUCKET = 'home_banners';

const EMPTY_FORM = {
  id: undefined as string | undefined,
  brandAr: 'إعلان · ',
  titleAr: '',
  subtitleAr: '',
  priceLabelAr: '',
  ctaAr: 'اشتري دلوقتي',
  imageUrl: '',
  bgColor: '#5B2B9E',
  linkType: 'category' as 'none' | 'product' | 'category' | 'url',
  linkValue: 'mobiles',
  sortOrder: 0,
  isActive: true,
};

export function BannersScreen({
  banners,
  counts,
}: {
  banners: HomeBannerRow[];
  counts: { total: number; active: number; inactive: number };
}) {
  const router = useRouter();
  const supabase = useSupabase();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  const preview = useMemo(
    () => ({
      bg: form.bgColor || '#5B2B9E',
      image: form.imageUrl,
      brand: form.brandAr || 'إعلان',
      title: form.titleAr || 'عنوان الإعلان',
      sub: form.subtitleAr || 'وصف مختصر',
      price: form.priceLabelAr,
      cta: form.ctaAr || 'اشتري دلوقتي',
    }),
    [form],
  );

  function run(action: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
        setEditing(false);
        setForm(EMPTY_FORM);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'فشل الحفظ');
      }
    });
  }

  async function uploadBannerImage(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('اختار ملف صورة (PNG / JPG / WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('الصورة أكبر من 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bytes = await file.arrayBuffer();
      const { error } = await supabase.storage
        .from(BANNER_BUCKET)
        .upload(path, bytes, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);

      setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
      toast.success('اترفعت الصورة على Storage — هتظهر على الموبايل');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'فشل رفع الصورة',
      );
    } finally {
      setUploading(false);
    }
  }

  function startEdit(row: HomeBannerRow) {
    setEditing(true);
    setForm({
      id: row.id,
      brandAr: row.brand_ar,
      titleAr: row.title_ar,
      subtitleAr: row.subtitle_ar ?? '',
      priceLabelAr: row.price_label_ar ?? '',
      ctaAr: row.cta_ar,
      imageUrl: row.image_url,
      bgColor: row.bg_color,
      linkType: row.link_type,
      linkValue: row.link_value ?? '',
      sortOrder: row.sort_order,
      isActive: row.is_active,
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="إعلانات الهوم"
        description="سلايدر الصفحة الرئيسية في تطبيق العملاء · صورة + نص + لينك"
        searchPlaceholder="دور على إعلان..."
        stats={[
          {
            label: 'كل الإعلانات',
            value: counts.total,
            icon: <Megaphone className="size-3.5" />,
          },
          {
            label: 'نشطة',
            value: counts.active,
            icon: <ImageIcon className="size-3.5" />,
          },
          {
            label: 'متوقفة',
            value: counts.inactive,
            icon: <Power className="size-3.5" />,
          },
        ]}
        actions={
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => {
              setEditing(true);
              setForm({
                ...EMPTY_FORM,
                sortOrder: banners.length,
              });
            }}
          >
            <Plus className="size-4" />
            إعلان جديد
          </Button>
        }
      />

      {editing ? (
        <div className="grid gap-4 rounded-2xl border bg-white p-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3" dir="rtl">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="البراند / التسمية">
                <Input
                  value={form.brandAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brandAr: e.target.value }))
                  }
                />
              </Field>
              <Field label="العنوان">
                <Input
                  value={form.titleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titleAr: e.target.value }))
                  }
                />
              </Field>
              <Field label="الوصف">
                <Input
                  value={form.subtitleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subtitleAr: e.target.value }))
                  }
                />
              </Field>
              <Field label="السعر (اختياري)">
                <Input
                  value={form.priceLabelAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priceLabelAr: e.target.value }))
                  }
                  placeholder="من 1,099 EGP"
                  dir="ltr"
                />
              </Field>
              <Field label="نص الزر">
                <Input
                  value={form.ctaAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ctaAr: e.target.value }))
                  }
                />
              </Field>
              <Field label="لون الخلفية">
                <Input
                  value={form.bgColor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bgColor: e.target.value }))
                  }
                  dir="ltr"
                />
              </Field>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-[#5B607A]">صورة الإعلان</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-[#F8F7FC] px-3 py-2 text-sm font-bold">
                    <Upload className="size-4" />
                    {uploading ? 'بيرفع…' : 'ارفع صورة'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading || pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadBannerImage(file);
                      }}
                    />
                  </label>
                  <span className="text-xs text-[#8B90B0]">
                    مهم: ارفع الصورة هنا — الروابط الخارجية غالبًا مش بتفتح على
                    الموبايل
                  </span>
                </div>
                <Input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="أو الصق رابط Storage محلي…"
                  dir="ltr"
                />
              </div>
              <Field label="الترتيب">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value || 0),
                    }))
                  }
                  dir="ltr"
                />
              </Field>
              <Field label="نوع اللينك">
                <select
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={form.linkType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      linkType: e.target.value as typeof form.linkType,
                    }))
                  }
                >
                  <option value="none">بدون</option>
                  <option value="category">قسم</option>
                  <option value="product">منتج</option>
                  <option value="url">رابط خارجي</option>
                </select>
              </Field>
              <Field label="قيمة اللينك">
                <Input
                  value={form.linkValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, linkValue: e.target.value }))
                  }
                  placeholder="mobiles / product-id / https://..."
                  dir="ltr"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              نشط على الموبايل
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => upsertBannerAction(form),
                    form.id ? 'تم تحديث الإعلان' : 'تم إضافة الإعلان',
                  )
                }
              >
                حفظ
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setForm(EMPTY_FORM);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-2xl p-5 text-white"
            style={{ backgroundColor: preview.bg, minHeight: 180 }}
            dir="rtl"
          >
            <div className="relative z-10 max-w-[62%]">
              <p className="text-[11px] font-semibold opacity-80">
                {preview.brand}
              </p>
              <h3 className="mt-1 text-xl font-black">{preview.title}</h3>
              <p className="mt-1 text-xs opacity-90">{preview.sub}</p>
              {preview.price ? (
                <p className="mt-2 text-sm font-extrabold">{preview.price}</p>
              ) : null}
              <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0B0F2E]">
                {preview.cta} ‹
              </span>
            </div>
            {preview.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.image}
                alt=""
                className="absolute bottom-3 left-3 h-[120px] w-[110px] rounded-xl object-cover shadow-lg"
              />
            ) : (
              <div className="absolute bottom-3 left-3 grid h-[120px] w-[110px] place-items-center rounded-xl bg-white/15 text-xs">
                معاينة الصورة
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الإعلان</TableHead>
              <TableHead className="text-right">الترتيب</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm">
                  مفيش إعلانات — اضغط «إعلان جديد»
                </TableCell>
              </TableRow>
            ) : (
              banners.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-right"
                      onClick={() => startEdit(row)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.image_url}
                        alt=""
                        className="size-14 rounded-xl object-cover"
                      />
                      <span>
                        <span className="block text-[11px] text-[#8B90B0]">
                          {row.brand_ar}
                        </span>
                        <span className="block font-bold text-[#0B0F2E]">
                          {row.title_ar}
                        </span>
                        <span className="block text-xs text-[#5B607A]">
                          {row.subtitle_ar}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell dir="ltr">{row.sort_order}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.is_active
                          ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700'
                          : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500'
                      }
                    >
                      {row.is_active ? 'نشط' : 'متوقف'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => startEdit(row)}
                      >
                        تعديل
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              toggleBannerAction({
                                id: row.id,
                                isActive: !row.is_active,
                              }),
                            row.is_active ? 'تم الإيقاف' : 'تم التفعيل',
                          )
                        }
                      >
                        {row.is_active ? 'إيقاف' : 'تفعيل'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deleteBannerAction({ id: row.id }),
                            'تم حذف الإعلان',
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[#5B607A]">{label}</Label>
      {children}
    </div>
  );
}

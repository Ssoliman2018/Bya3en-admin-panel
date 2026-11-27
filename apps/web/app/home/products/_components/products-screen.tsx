'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { Boxes, EyeOff, Package, Plus, Search, Store } from 'lucide-react';

import pathsConfig from '~/config/paths.config';

import { updateProductStatusAction } from '../_lib/server/products.actions';
import type {
  CatalogProduct,
  ProductFilter,
} from '../_lib/server/products.loader';
import { MerchantProductSheet } from './merchant-product-sheet';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { ProductFormDrawer } from './product-form-drawer';
import { ProductRowActions } from './product-row-actions';

type Category = { id: string; name_ar: string };
type Counts = Record<ProductFilter, number>;

const TABS: Array<{ id: ProductFilter; label: string; hot?: boolean }> = [
  { id: 'all', label: 'كل المنتجات' },
  { id: 'bayya3een', label: 'منتجات بياعين' },
  { id: 'merchant', label: 'منتجات التجار' },
  { id: 'review', label: 'مراجعة منتجات التجار', hot: true },
  { id: 'hidden', label: 'مخفية / خلصانة' },
];

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-EG');
}

function discountPct(price: number, compareAt: number | null) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

function statusPill(product: CatalogProduct) {
  if (product.is_hidden || product.status === 'hidden') {
    return <span className="by-st violet">مخفي</span>;
  }
  if (product.status === 'under_review') {
    return <span className="by-st amber">مستني مراجعة</span>;
  }
  if (product.status === 'rejected') {
    return <span className="by-st red">مرفوض</span>;
  }
  if (product.status === 'draft') {
    return <span className="by-st violet">مسودة</span>;
  }
  if (product.stock === 0) {
    return <span className="by-st red">خلص</span>;
  }
  return <span className="by-st green">ظاهر</span>;
}

export function ProductsScreen({
  filter,
  q,
  categoryId,
  products,
  counts,
  categories,
}: {
  filter: ProductFilter;
  q: string;
  categoryId: string;
  products: CatalogProduct[];
  counts: Counts;
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [viewing, setViewing] = useState<CatalogProduct | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(
    'الصور مش واضحة · ضيف صور على خلفية بيضا',
  );

  const tabHref = (id: ProductFilter) => {
    const params = new URLSearchParams();
    if (id !== 'all') params.set('filter', id);
    if (q) params.set('q', q);
    if (categoryId) params.set('cat', categoryId);
    const qs = params.toString();
    return qs ? `${pathsConfig.app.products}?${qs}` : pathsConfig.app.products;
  };

  const pushFilters = (next: {
    filter?: ProductFilter;
    q?: string;
    cat?: string;
  }) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const query = next.q ?? q;
    const cat = next.cat ?? categoryId;
    if (f !== 'all') params.set('filter', f);
    if (query) params.set('q', query);
    if (cat) params.set('cat', cat);
    const qs = params.toString();
    router.push(
      qs ? `${pathsConfig.app.products}?${qs}` : pathsConfig.app.products,
    );
  };

  const filteredCountLabel = useMemo(
    () => `${products.length} منتج`,
    [products.length],
  );

  function refresh() {
    router.refresh();
  }

  function setStatus(
    productId: string,
    status: 'live' | 'rejected' | 'hidden',
    rejectionReason?: string,
  ) {
    startTransition(async () => {
      try {
        await updateProductStatusAction({
          productId,
          status,
          isHidden: status === 'hidden',
          rejectionReason,
        });
        toast.success(
          status === 'live'
            ? 'اتوافق على المنتج وظهر في الكتالوج'
            : status === 'rejected'
              ? 'اترفض المنتج واتبعت السبب'
              : 'اتحدثت الحالة',
        );
        setRejectId(null);
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'فشل تحديث الحالة',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="المنتجات"
        description="نوعين ملكية: منتج بياعين بنحدد سعره وتكلفته، ومنتج تاجر بنراجعه"
        searchPlaceholder="دور على منتج، ماركة، أو تاجر..."
        stats={[
          {
            label: 'كل المنتجات',
            value: counts.all,
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'منتجات بياعين',
            value: counts.bayya3een,
            icon: <Store className="size-3.5" />,
          },
          {
            label: 'قيد المراجعة',
            value: counts.review,
            icon: <Boxes className="size-3.5" />,
          },
          {
            label: 'مخفية / خلصانة',
            value: counts.hidden,
            icon: <EyeOff className="size-3.5" />,
          },
        ]}
        actions={
          <Button
            className="by-hero-btn by-hero-btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            منتج بياعين جديد
          </Button>
        }
      />

      <div className="by-list-tools">
        <nav className="by-wtabs" aria-label="فلاتر المنتجات">
          {TABS.map((tab) => {
            const count = counts[tab.id];
            const on = filter === tab.id;
            return (
              <a
                key={tab.id}
                href={tabHref(tab.id)}
                className={on ? 'on' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  pushFilters({ filter: tab.id });
                }}
              >
                {tab.label}
                <span className={`ct ${tab.hot && count > 0 ? 'hot' : ''}`}>
                  {count}
                </span>
              </a>
            );
          })}
        </nav>

        {filter !== 'review' ? (
          <div className="by-fbar">
            <label className="by-wsearch">
              <Search aria-hidden />
              <input
                defaultValue={q}
                placeholder="اسم المنتج أو الماركة أو التاجر"
                onChange={(e) => {
                  const value = e.target.value;
                  window.clearTimeout(
                    (window as unknown as { _pq?: number })._pq,
                  );
                  (window as unknown as { _pq?: number })._pq =
                    window.setTimeout(() => pushFilters({ q: value }), 280);
                }}
              />
            </label>
            <select
              className="by-fchip"
              aria-label="القسم"
              value={categoryId}
              onChange={(e) => pushFilters({ cat: e.target.value })}
            >
              <option value="">كل الأقسام</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ar}
                </option>
              ))}
            </select>
            <span className="by-fbar__count">
              <span className="num">{filteredCountLabel}</span>
            </span>
          </div>
        ) : (
          <div className="by-note mt-3">
            التاجر بيبعت المنتج حسب حد باقته. لما توافق المنتج بيظهر للعملاء في
            التطبيق على طول.
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="by-card text-muted-foreground text-center text-sm">
          مفيش منتجات في الفلتر ده.
        </div>
      ) : filter === 'review' ? (
        <div className="by-tw">
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>التاجر</th>
                <th className="n">السعر</th>
                <th className="n">المخزون</th>
                <th className="n">عمولة البيّاع</th>
                <th>اتبعت</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="by-pr">
                      <span className="im">
                        {product.name_ar.slice(0, 1)}
                      </span>
                      <span>
                        <b>{product.name_ar}</b>
                        <small>{product.brand ?? '—'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {product.merchants?.store_name ?? '—'}
                    {product.merchants?.status === 'pending' ? (
                      <div>
                        <span className="by-st amber">حساب مستني تحقق</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="n">
                    {fmt(Number(product.price_egp))}
                    {product.seller_price_egp != null ? (
                      <div className="text-muted-foreground text-xs">
                        بيّاع {fmt(Number(product.seller_price_egp))}
                      </div>
                    ) : null}
                  </td>
                  <td className="n">{product.stock}</td>
                  <td className="n">
                    {product.commission_rate != null
                      ? `${Number(product.commission_rate)}%`
                      : '—'}
                  </td>
                  <td>
                    {new Date(product.created_at).toLocaleDateString('ar-EG')}
                  </td>
                  <td>{statusPill(product)}</td>
                  <td>
                    <ProductRowActions
                      product={product}
                      onView={() => setViewing(product)}
                      onEdit={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                      onReject={() => setRejectId(product.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="by-tw">
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الملكية</th>
                <th className="n">سعر البيع</th>
                <th className="n">التكلفة / الهامش</th>
                <th className="n">المخزون</th>
                <th className="n">عمولة البيّاع</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const price = Number(product.price_egp);
                const cost =
                  product.cost_egp != null ? Number(product.cost_egp) : null;
                const disc = discountPct(
                  price,
                  product.compare_at_price_egp != null
                    ? Number(product.compare_at_price_egp)
                    : null,
                );
                const margin =
                  product.owner_type === 'bayya3een' && cost != null && price > 0
                    ? Math.round(((price - cost) / price) * 100)
                    : null;

                return (
                  <tr key={product.id}>
                    <td>
                      <div className="by-pr">
                        <span className="im">
                          {product.name_ar.slice(0, 1)}
                        </span>
                        <span>
                          <b>{product.name_ar}</b>
                          <small>
                            {[product.brand, product.categories?.name_ar]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {product.owner_type === 'bayya3een' ? (
                        <span className="by-own by">منتج بياعين</span>
                      ) : (
                        <span className="by-own mr">
                          تاجر
                          {product.merchants?.store_name
                            ? ` · ${product.merchants.store_name}`
                            : ''}
                        </span>
                      )}
                    </td>
                    <td className="n">
                      {fmt(price)}
                      {disc != null ? (
                        <span className="text-muted-foreground ms-1 text-xs">
                          -{disc}%
                        </span>
                      ) : null}
                    </td>
                    <td className="n">
                      {product.owner_type === 'bayya3een' && cost != null ? (
                        <>
                          {fmt(cost)}
                          {margin != null ? (
                            <>
                              {' · '}
                              <b style={{ color: '#0A6B37' }}>{margin}%</b>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">عند التاجر</span>
                      )}
                    </td>
                    <td className="n">
                      {product.stock === 0 ? (
                        <span className="font-bold text-[#B3261E]">0</span>
                      ) : (
                        fmt(product.stock)
                      )}
                    </td>
                    <td className="n">
                      {product.commission_rate != null
                        ? `${Number(product.commission_rate)}%`
                        : '—'}
                      {product.owner_type === 'merchant' &&
                      product.seller_price_egp != null ? (
                        <div className="text-muted-foreground text-xs">
                          من فرق السعر
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {statusPill(product)}
                      {product.is_hidden && product.rejection_reason ? (
                        <div className="text-muted-foreground mt-1 max-w-[160px] text-[11px]">
                          {product.rejection_reason}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <ProductRowActions
                        product={product}
                        onView={() => {
                          if (product.owner_type === 'bayya3een') {
                            router.push(`/home/products/${product.id}`);
                            return;
                          }
                          setViewing(product);
                        }}
                        onEdit={() => {
                          setEditing(product);
                          setFormOpen(true);
                        }}
                        onReject={() => setRejectId(product.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        product={editing}
        onSaved={refresh}
      />

      <MerchantProductSheet
        product={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        onChanged={refresh}
      />

      <Dialog
        open={Boolean(rejectId)}
        onOpenChange={(next) => {
          if (!next) setRejectId(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-md"
        >
          <DialogHeader className="border-border border-b px-5 py-4 text-right">
            <DialogTitle className="text-[17px] font-extrabold">
              رفض المنتج
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <label className="grid gap-2 text-sm font-bold">
              سبب الرفض (هيوصل للتاجر)
              <Textarea
                dir="rtl"
                className="min-h-24 rounded-[10px]"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter className="bg-background mx-0 mb-0 justify-start rounded-none border-0 px-5 py-4 sm:justify-start">
            <Button
              variant="destructive"
              disabled={pending || !rejectId}
              className="h-9 rounded-[10px] font-bold"
              onClick={() => {
                if (!rejectId) return;
                setStatus(rejectId, 'rejected', rejectReason);
              }}
            >
              ارفض
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-[10px] font-bold"
              onClick={() => setRejectId(null)}
            >
              رجوع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import Link from 'next/link';
import { connection } from 'next/server';

import {
  AlertTriangle,
  Boxes,
  Package,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from './_components/admin-page-header';
import { loadOverviewStats } from './_lib/server/overview.loader';

export default async function HomePage() {
  await connection();
  const stats = await loadOverviewStats();

  return (
    <PageBody className="gap-6 pt-0">
      <AdminPageHeader
        title="نظرة عامة"
        description="أداء بياعين · كتالوج وتجار · الأرقام بالجنيه المصري"
        searchPlaceholder="دور على طلب، منتج، تاجر..."
        stats={[
          {
            label: 'منتجات منشورة',
            value: stats.liveProducts,
            icon: <Package className="size-3.5" />,
            hint: `${stats.bayya3eenProducts} بياعين · ${stats.merchantProducts} تاجر`,
          },
          {
            label: 'طلبات مفتوحة',
            value: stats.openOrders,
            icon: <ShoppingBag className="size-3.5" />,
            hint: `${stats.newOrders} جديدة`,
          },
          {
            label: 'تجار نشطين',
            value: stats.activeMerchants,
            icon: <Store className="size-3.5" />,
            hint: `${stats.pendingMerchants} بانتظار المراجعة`,
          },
          {
            label: 'للمراجعة',
            value: stats.productsUnderReview,
            icon: <Boxes className="size-3.5" />,
          },
        ]}
      />

      <div className="by-section-title">
        قرارات محتاجة
        <small className="text-muted-foreground text-xs font-medium">
          من الطلبات والكتالوج والتجار
        </small>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="by-card">
          <h2 className="text-[15px] font-bold">محتاج قرارك</h2>
          <div className="mt-2">
            <Link
              href={`${pathsConfig.app.orders}?status=new`}
              className="by-decision-row hover:text-primary"
            >
              <span>طلبات جديدة للتأكيد</span>
              <span className="by-decision-count">{stats.newOrders}</span>
            </Link>
            <Link
              href={`${pathsConfig.app.merchants}?status=pending`}
              className="by-decision-row hover:text-primary"
            >
              <span>طلبات تسجيل تجار</span>
              <span className="by-decision-count">{stats.pendingMerchants}</span>
            </Link>
            <Link
              href={`${pathsConfig.app.products}?filter=review`}
              className="by-decision-row hover:text-primary"
            >
              <span>منتجات قيد المراجعة</span>
              <span className="by-decision-count">
                {stats.productsUnderReview}
              </span>
            </Link>
            <Link
              href={`${pathsConfig.app.affiliates}?tab=wd`}
              className="by-decision-row hover:text-primary"
            >
              <span>طلبات سحب للبيّاعين</span>
              <span className="by-decision-count">
                {stats.pendingWithdrawals}
              </span>
            </Link>
            <Link
              href={`${pathsConfig.app.affiliates}?tab=pending`}
              className="by-decision-row hover:text-primary"
            >
              <span>طلبات تسجيل بيّاعين</span>
              <span className="by-decision-count">
                {stats.pendingAffiliates}
              </span>
            </Link>
            <div className="by-decision-row text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="size-3.5 text-[#FF8A00]" />
                مخزون منخفض / خلصان
              </span>
              <span className="num text-sm font-bold text-[#0B0F2E]">
                {stats.lowStock} / {stats.outOfStock}
              </span>
            </div>
          </div>
        </div>

        <div className="by-card">
          <h2 className="text-[15px] font-bold">خريطة الأدمن</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-7">
            لوحة الإدارة مكتملة — كل الأقسام شغّالة بالبيانات التجريبية.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                [pathsConfig.app.home, 'نظرة عامة'],
                [pathsConfig.app.performance, 'أداء المشروع'],
                [pathsConfig.app.products, 'المنتجات'],
                [pathsConfig.app.banners, 'إعلانات الهوم'],
                [pathsConfig.app.orders, 'الطلبات'],
                [pathsConfig.app.customers, 'العملاء'],
                [pathsConfig.app.merchants, 'التجار'],
                [pathsConfig.app.affiliates, 'البيّاعين'],
                [pathsConfig.app.commissions, 'العمولات'],
                [pathsConfig.app.subscriptions, 'الاشتراكات'],
                [pathsConfig.app.finance, 'المالية'],
                [pathsConfig.app.roles, 'الأدوار'],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg bg-[#F8F7FC] px-3 py-2 text-center text-[12px] font-bold text-[#0B0F2E] transition hover:bg-[#7A00FF]/10 hover:text-[#7A00FF]"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageBody>
  );
}

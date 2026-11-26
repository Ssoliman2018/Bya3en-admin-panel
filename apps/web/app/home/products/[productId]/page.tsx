import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { ArrowRight, Package, Tag } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../../_components/admin-page-header';
import { ProductDetailPanel } from '../_components/product-detail-panel';
import {
  loadCategories,
  loadProduct,
} from '../_lib/server/products.loader';

export const metadata = { title: 'تفاصيل المنتج' };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await connection();
  const { productId } = await params;
  const [product, categories] = await Promise.all([
    loadProduct(productId),
    loadCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const isBayya3een = product.owner_type === 'bayya3een';

  return (
    <PageBody className="gap-4 pt-0">
      <AdminPageHeader
        title={product.name_ar}
        description={
          isBayya3een
            ? 'منتج بياعين · تعديل السعر والتكلفة والمخزون'
            : 'منتج تاجر · مراجعة ونشر أو رفض'
        }
        searchPlaceholder="دور على منتج آخر..."
        stats={[
          {
            label: 'السعر',
            value: `${Math.round(Number(product.price_egp)).toLocaleString()}`,
            icon: <Tag className="size-3.5" />,
            hint: 'EGP',
          },
          {
            label: 'المخزون',
            value: product.stock,
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'الملكية',
            value: isBayya3een ? 'بياعين' : 'تاجر',
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'الحالة',
            value:
              product.status === 'live'
                ? 'ظاهر'
                : product.status === 'under_review'
                  ? 'مراجعة'
                  : product.is_hidden
                    ? 'مخفي'
                    : product.status,
          },
        ]}
        actions={
          <Button
            nativeButton={false}
            className="by-hero-btn by-hero-btn-secondary"
            render={<Link href={pathsConfig.app.products} />}
          >
            <ArrowRight className="size-4" />
            رجوع للمنتجات
          </Button>
        }
      />

      <ProductDetailPanel product={product} categories={categories} />
    </PageBody>
  );
}

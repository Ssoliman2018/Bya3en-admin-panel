import Link from 'next/link';

import { ArrowRight, Package, Plus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AdminPageHeader } from '../../_components/admin-page-header';
import { CreateProductForm } from '../_components/create-product-form';
import { loadCategories } from '../_lib/server/products.loader';

export const metadata = {
  title: 'منتج بياعين جديد',
};

export default async function NewProductPage() {
  const categories = await loadCategories();

  return (
    <PageBody className="gap-4 pt-0">
      <AdminPageHeader
        title="منتج بياعين جديد"
        description="المنتج هيظهر للعملاء بعد ما حالته تكون منشور"
        searchPlaceholder="دور على منتج موجود..."
        stats={[
          {
            label: 'النوع',
            value: 'بياعين',
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'الحالة الابتدائية',
            value: 'منشور',
            icon: <Plus className="size-3.5" />,
          },
          {
            label: 'الأقسام',
            value: categories.length,
            icon: <Package className="size-3.5" />,
          },
          {
            label: 'الملكية',
            value: 'منصة',
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

      <CreateProductForm categories={categories} />
    </PageBody>
  );
}

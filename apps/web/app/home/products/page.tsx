import { connection } from 'next/server';

import { PageBody } from '@kit/ui/page';

import { ProductsScreen } from './_components/products-screen';
import {
  loadCategories,
  loadProductCounts,
  loadProducts,
  type ProductFilter,
} from './_lib/server/products.loader';

export const metadata = {
  title: 'المنتجات',
};

const FILTERS: ProductFilter[] = [
  'all',
  'bayya3een',
  'merchant',
  'review',
  'hidden',
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; cat?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const filter = (FILTERS.includes(params.filter as ProductFilter)
    ? params.filter
    : 'all') as ProductFilter;
  const q = params.q?.trim() ?? '';
  const categoryId = params.cat?.trim() ?? '';

  const [products, counts, categories] = await Promise.all([
    loadProducts(filter, { categoryId: categoryId || undefined }),
    loadProductCounts(),
    loadCategories(),
  ]);

  const query = q.toLowerCase();
  const visibleProducts = query
    ? products.filter((product) => {
        const haystack = [
          product.name_ar,
          product.brand,
          product.description_ar,
          product.categories?.name_ar,
          product.merchants?.store_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : products;

  return (
    <PageBody className="gap-0 pt-0">
      <ProductsScreen
        filter={filter}
        q={q}
        categoryId={categoryId}
        products={visibleProducts}
        counts={counts}
        categories={categories}
      />
    </PageBody>
  );
}

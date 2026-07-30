import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Package } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { COLLECTIONS } from '@/lib/pocketbase'
import type { Category, CategoryWithExpand, ProductWithExpand } from '@/types'

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  )
}

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: category, isLoading } = useRecord<CategoryWithExpand & RecordModel>(
    COLLECTIONS.CATEGORIES,
    id,
    'parent',
  )

  const productsOptions = useMemo(
    () => ({
      filter: id
        ? `category = "${id}" || sub_category = "${id}"`
        : undefined,
      sort: 'name',
      perPage: 200,
      expand: 'category,supplier',
    }),
    [id],
  )

  const { data: productsData, isLoading: productsLoading } =
    useTypedCollectionQuery('products', productsOptions)

  const childCategoriesOptions = useMemo(
    () => ({
      filter: id ? `parent = "${id}"` : undefined,
      sort: 'name',
      perPage: 100,
    }),
    [id],
  )

  const { data: childCategoriesData, isLoading: childCategoriesLoading } =
    useTypedCollectionQuery('categories', childCategoriesOptions)

  const productColumns: ColumnDef<ProductWithExpand>[] = [
    {
      accessorKey: 'asset_tag',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Asset Tag" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/products/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.asset_tag}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: 'sku',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => row.getValue('sku') || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} type="product" />
      ),
    },
    {
      id: 'category',
      accessorFn: (row) => row.expand?.category?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Categories
          </Link>
        </Button>
        <p className="text-muted-foreground">Category not found.</p>
      </div>
    )
  }

  const products = productsData?.items ?? []
  const childCategories = childCategoriesData?.items ?? []
  const parentCategory = category.expand?.parent

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        breadcrumbs={[
          { label: 'Categories', href: '/categories' },
          { label: category.name },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/categories">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>Classification information</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={category.name} />
            <DetailField label="Description" value={category.description} />
            <DetailField
              label="Parent Category"
              value={
                parentCategory ? (
                  <Link
                    to={`/categories/${parentCategory.id}`}
                    className="text-primary hover:underline"
                  >
                    {parentCategory.name}
                  </Link>
                ) : null
              }
            />
          </dl>
        </CardContent>
      </Card>

      {(childCategories.length > 0 || childCategoriesLoading) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Child Categories</h2>
          {childCategoriesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ul className="divide-y">
                  {childCategories.map((child: Category) => (
                    <li key={child.id} className="py-2">
                      <Link
                        to={`/categories/${child.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {child.name}
                      </Link>
                      {child.description && (
                        <p className="text-sm text-muted-foreground">
                          {child.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Products</h2>
        {products.length === 0 && !productsLoading ? (
          <EmptyState
            icon={Package}
            title="No products"
            description="No products are assigned to this category."
          />
        ) : (
          <DataTable
            columns={productColumns}
            data={products}
            isLoading={productsLoading}
          />
        )}
      </div>
    </div>
  )
}

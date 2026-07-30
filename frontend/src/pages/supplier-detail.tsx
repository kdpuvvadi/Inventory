import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Package } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'

import { CompanyContactsPanel } from '@/components/company-contacts-panel'
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
import type { ProductWithExpand, Supplier } from '@/types'

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

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: supplier, isLoading } = useRecord<Supplier & RecordModel>(
    COLLECTIONS.SUPPLIERS,
    id,
  )

  const productsOptions = useMemo(
    () => ({
      filter: id ? `supplier = "${id}"` : undefined,
      sort: 'name',
      perPage: 200,
      expand: 'category,supplier',
    }),
    [id],
  )

  const { data: productsData, isLoading: productsLoading } =
    useTypedCollectionQuery('products', productsOptions)

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

  if (!supplier) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Suppliers
          </Link>
        </Button>
        <p className="text-muted-foreground">Supplier not found.</p>
      </div>
    )
  }

  const products = productsData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        breadcrumbs={[
          { label: 'Suppliers', href: '/suppliers' },
          { label: supplier.name },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/suppliers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Supplier Details</CardTitle>
          <CardDescription>Legacy primary contact summary</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Contact Person" value={supplier.contact_person} />
            <DetailField label="Email" value={supplier.email} />
            <DetailField label="Phone" value={supplier.phone} />
            <DetailField label="Address" value={supplier.address} />
            <DetailField
              label="Website"
              value={
                supplier.website ? (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {supplier.website}
                  </a>
                ) : null
              }
            />
            <DetailField label="GST / VAT Number" value={supplier.gst_vat_number} />
            {supplier.payment_terms && (
              <DetailField label="Payment Terms" value={supplier.payment_terms} />
            )}
            <DetailField label="Notes" value={supplier.notes} />
          </dl>
        </CardContent>
      </Card>

      <CompanyContactsPanel entityType="supplier" entityId={id!} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Products</h2>
        {products.length === 0 && !productsLoading ? (
          <EmptyState
            icon={Package}
            title="No products"
            description="No products are linked to this supplier."
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

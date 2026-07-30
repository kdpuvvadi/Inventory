import { format } from 'date-fns'
import { Loader2, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { BarcodeDisplay, QRCodeDisplay } from '@/components/barcode-display'
import { ProductSerialsPanel } from '@/components/product-serials-panel'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useRecord,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import type { RecordModel } from 'pocketbase'
import { canWrite } from '@/lib/auth'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { useFormatMoney } from '@/contexts/settings-context'
import { ProductEditDialog } from '@/pages/product-form'
import type { ProductWithExpand, StockTransactionWithExpand } from '@/types'
import { getLabel, TRANSACTION_TYPES, UNIT_OF_MEASURES } from '@/utils/constants'

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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const writeAccess = canWrite()
  const [editOpen, setEditOpen] = useState(false)
  const formatMoney = useFormatMoney()

  const expand = 'manufacturer,supplier,category,sub_category'
  const { data: product, isLoading, refetch } = useRecord<
    ProductWithExpand & RecordModel
  >(COLLECTIONS.PRODUCTS, id, expand)

  const transactionOptions = useMemo(
    () => ({
      filter: id ? `product = "${id}"` : undefined,
      sort: '-created',
      perPage: 50,
      expand: 'warehouse,user',
    }),
    [id],
  )
  const { data: transactions, isLoading: transactionsLoading } =
    useTypedCollectionQuery('stock_transactions', transactionOptions)

  useEffect(() => {
    if (searchParams.get('edit') === '1' && writeAccess) {
      setEditOpen(true)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('edit')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams, writeAccess])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product Not Found" />
        <p className="text-muted-foreground">
          The requested product could not be found.
        </p>
        <Button asChild variant="outline">
          <Link to="/products">Back to Products</Link>
        </Button>
      </div>
    )
  }

  const imageUrl = product.image
    ? pb.files.getURL(product, product.image)
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`Asset tag: ${product.asset_tag}`}
        breadcrumbs={[
          { label: 'Products', href: '/products' },
          { label: product.name },
        ]}
        actions={
          writeAccess ? (
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Product Details</CardTitle>
                <CardDescription>Core product information</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {product.track_serials && (
                  <Badge variant="outline">Serial tracking</Badge>
                )}
                <StatusBadge status={product.status} type="product" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Asset Tag" value={product.asset_tag} />
              <DetailField label="SKU" value={product.sku} />
              <DetailField label="Model" value={product.model} />
              <DetailField
                label="Manufacturer"
                value={product.expand?.manufacturer?.name}
              />
              <DetailField
                label="Supplier"
                value={product.expand?.supplier?.name}
              />
              <DetailField
                label="Manufacturer Code"
                value={product.manufacturer_code}
              />
              <DetailField
                label="Category"
                value={product.expand?.category?.name}
              />
              <DetailField
                label="Sub-category"
                value={product.expand?.sub_category?.name}
              />
              <DetailField
                label="Unit of Measure"
                value={getLabel(UNIT_OF_MEASURES, product.unit_of_measure)}
              />
              <DetailField
                label="Unit Cost"
                value={
                  product.unit_cost != null
                    ? formatMoney(product.unit_cost)
                    : '—'
                }
              />
              <DetailField label="Serial Number" value={product.serial_number} />
              <DetailField label="Lot Number" value={product.lot_number} />
              <DetailField label="Purchase Date" value={product.purchase_date} />
              <DetailField label="Received Date" value={product.received_date} />
            </dl>
            {product.description && (
              <div className="mt-4 space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  Description
                </dt>
                <dd className="text-sm">{product.description}</dd>
              </div>
            )}
            {product.tags?.length > 0 && (
              <div className="mt-4 space-y-2">
                <dt className="text-sm font-medium text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Image</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full rounded-md object-cover"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Barcode</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <BarcodeDisplay value={product.barcode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <QRCodeDisplay value={product.qr_code || product.asset_tag} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductSerialsPanel product={product} />

      <Card>
        <CardHeader>
          <CardTitle>Asset History</CardTitle>
          <CardDescription>
            Stock transactions for this product, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (transactions?.items ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stock transactions recorded for this product.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((transactions?.items ?? []) as StockTransactionWithExpand[]).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(tx.created), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {getLabel(TRANSACTION_TYPES, tx.type)}
                      </TableCell>
                      <TableCell
                        className={
                          tx.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {tx.quantity > 0 ? '+' : ''}
                        {tx.quantity}
                      </TableCell>
                      <TableCell>
                        {tx.expand?.warehouse?.name ?? '—'}
                      </TableCell>
                      <TableCell>{tx.reason || '—'}</TableCell>
                      <TableCell>
                        {tx.expand?.user?.name ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {writeAccess && (
        <ProductEditDialog
          product={product}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

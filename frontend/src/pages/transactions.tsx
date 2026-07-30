import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowDownUp, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatDateTime } from '@/lib/utils'
import { adjustStock } from '@/services/inventory'
import type { Product, StockTransactionWithExpand, TransactionType, Warehouse } from '@/types'
import { TRANSACTION_TYPES, getLabel } from '@/utils/constants'

const MANUAL_TYPES: TransactionType[] = [
  'adjustment',
  'scrap',
  'transfer',
  'return',
  'consumption',
  'production',
]

const manualAdjustmentSchema = z.object({
  product: z.string().min(1, 'Product is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  type: z.enum([
    'adjustment',
    'scrap',
    'transfer',
    'return',
    'consumption',
    'production',
  ]),
  direction: z.enum(['in', 'out']),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(1, 'Reason is required'),
  remarks: z.string().optional(),
})

type ManualAdjustmentValues = z.infer<typeof manualAdjustmentSchema>

function getQuantityDelta(
  type: TransactionType,
  quantity: number,
  direction: 'in' | 'out',
): number {
  const abs = Math.abs(quantity)
  switch (type) {
    case 'scrap':
    case 'consumption':
      return -abs
    case 'return':
    case 'production':
      return abs
    case 'adjustment':
    case 'transfer':
      return direction === 'in' ? abs : -abs
    default:
      return direction === 'in' ? abs : -abs
  }
}

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const writable = canWrite()

  const filter = useMemo(() => {
    const parts: string[] = []
    if (typeFilter !== 'all') {
      parts.push(`type = "${typeFilter}"`)
    }
    if (dateFrom) {
      parts.push(`created >= "${dateFrom} 00:00:00"`)
    }
    if (dateTo) {
      parts.push(`created <= "${dateTo} 23:59:59"`)
    }
    if (productSearch.trim()) {
      const term = productSearch.trim().replace(/"/g, '\\"')
      parts.push(`product.name ~ "${term}"`)
    }
    return parts.length > 0 ? parts.join(' && ') : undefined
  }, [typeFilter, dateFrom, dateTo, productSearch])

  const listOptions = useMemo(
    () => ({
      perPage: 200,
      sort: '-created',
      expand: 'product,warehouse,user',
      filter,
    }),
    [filter],
  )

  const queryKey = collectionQueryKey(COLLECTIONS.STOCK_TRANSACTIONS, listOptions)
  const { data, isLoading, refetch } = useTypedCollectionQuery(
    'stock_transactions',
    listOptions,
  )
  useRealtimeCollection(COLLECTIONS.STOCK_TRANSACTIONS, queryKey)

  const { data: productsData } = useTypedCollectionQuery('products', {
    perPage: 500,
    sort: 'name',
  })
  const { data: warehousesData } = useTypedCollectionQuery('warehouses', {
    perPage: 100,
    sort: 'name',
  })

  const form = useForm<ManualAdjustmentValues>({
    resolver: zodResolver(manualAdjustmentSchema),
    defaultValues: {
      product: '',
      warehouse: '',
      type: 'adjustment',
      direction: 'in',
      quantity: 1,
      reason: '',
      remarks: '',
    },
  })

  const adjustType = form.watch('type')
  const showDirection = adjustType === 'adjustment' || adjustType === 'transfer'

  const handleManualAdjust = async (values: ManualAdjustmentValues) => {
    setIsSubmitting(true)
    try {
      const quantityDelta = getQuantityDelta(
        values.type,
        values.quantity,
        values.direction,
      )
      await adjustStock({
        productId: values.product,
        warehouseId: values.warehouse,
        quantityDelta,
        type: values.type,
        reason: values.reason,
        remarks: values.remarks,
      })
      toast.success('Adjustment recorded')
      setAdjustOpen(false)
      form.reset()
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record adjustment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<StockTransactionWithExpand>[] = [
    {
      accessorKey: 'created',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDateTime(row.getValue('created') as string),
    },
    {
      id: 'product',
      accessorFn: (row) =>
        row.expand?.product
          ? `${row.expand.product.name} (${row.expand.product.asset_tag})`
          : row.product,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: ({ row }) => {
        const product = row.original.expand?.product
        if (!product) return row.original.product
        return (
          <div>
            <Link
              to={`/products/${product.id}`}
              className="font-medium text-primary hover:underline"
            >
              {product.name}
            </Link>
            <div>
              <Link
                to={`/products/${product.id}`}
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                {product.asset_tag}
              </Link>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => getLabel(TRANSACTION_TYPES, row.original.type),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quantity" />
      ),
      cell: ({ row }) => {
        const qty = row.getValue('quantity') as number
        return (
          <span className={qty < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
            {qty > 0 ? `+${qty}` : qty}
          </span>
        )
      },
    },
    {
      accessorKey: 'before_quantity',
      header: 'Before',
    },
    {
      accessorKey: 'after_quantity',
      header: 'After',
    },
    {
      id: 'warehouse',
      accessorFn: (row) => row.expand?.warehouse?.name ?? row.warehouse,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Warehouse" />
      ),
    },
    {
      id: 'user',
      accessorFn: (row) => row.expand?.user?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => row.getValue('reason') || '—',
    },
    {
      accessorKey: 'reference_document',
      header: 'Reference',
      cell: ({ row }) => row.getValue('reference_document') || '—',
    },
  ]

  const items = data?.items ?? []
  const products = productsData?.items ?? []
  const warehouses = warehousesData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Immutable stock transaction history."
        actions={
          writable ? (
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Manual Adjustment
            </Button>
          ) : undefined
        }
      />

      {!isLoading && items.length === 0 && !filter ? (
        <EmptyState
          icon={ArrowDownUp}
          title="No transactions yet"
          description="Stock movements will appear here as inventory changes."
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          filterSlot={
            <div className="flex flex-wrap items-center gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TRANSACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
                placeholder="To"
              />
              <Input
                placeholder="Search product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-[200px]"
              />
            </div>
          }
        />
      )}

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Adjustment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleManualAdjust)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product: Product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.asset_tag})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="warehouse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((wh: Warehouse) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MANUAL_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {getLabel(TRANSACTION_TYPES, type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showDirection && (
                <FormField
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direction</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in">Increase</SelectItem>
                          <SelectItem value="out">Decrease</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="Reason for adjustment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional remarks" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Adjustment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

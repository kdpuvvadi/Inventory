import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, MoreHorizontal, Package, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { SerialNumbersInput } from '@/components/serial-numbers-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { cn } from '@/lib/utils'
import { updateRecord } from '@/services/crud'
import { adjustStock } from '@/services/inventory'
import { parseSerialList } from '@/services/serials'
import type { InventoryWithExpand, ProductSerial, TransactionType, Warehouse } from '@/types'
import { TRANSACTION_TYPES, getLabel } from '@/utils/constants'

const ADJUST_TYPES: TransactionType[] = [
  'adjustment',
  'scrap',
  'transfer',
  'return',
  'consumption',
]

const adjustStockSchema = z.object({
  type: z.enum(['adjustment', 'scrap', 'transfer', 'return', 'consumption']),
  direction: z.enum(['in', 'out']),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(1, 'Reason is required'),
  remarks: z.string().optional(),
})

const setLevelsSchema = z.object({
  min_stock: z.coerce.number().min(0),
  max_stock: z.coerce.number().min(0),
  reorder_level: z.coerce.number().min(0),
  location: z.string().optional(),
})

type AdjustStockFormValues = z.infer<typeof adjustStockSchema>
type SetLevelsFormValues = z.infer<typeof setLevelsSchema>

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
      return abs
    case 'adjustment':
    case 'transfer':
      return direction === 'in' ? abs : -abs
    default:
      return direction === 'in' ? abs : -abs
  }
}

function isLowStock(item: InventoryWithExpand): boolean {
  return item.available <= item.reorder_level && item.reorder_level > 0
}

export default function InventoryPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [outOfStockOnly, setOutOfStockOnly] = useState(false)
  const [damagedOnly, setDamagedOnly] = useState(false)
  const [adjustItem, setAdjustItem] = useState<InventoryWithExpand | null>(null)
  const [levelsItem, setLevelsItem] = useState<InventoryWithExpand | null>(null)
  const [serialsText, setSerialsText] = useState('')
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const writable = canWrite()

  const filter = useMemo(() => {
    const parts: string[] = []
    if (warehouseFilter !== 'all') {
      parts.push(`warehouse = "${warehouseFilter}"`)
    }
    if (lowStockOnly) {
      parts.push('available <= reorder_level && reorder_level > 0')
    }
    if (outOfStockOnly) {
      parts.push('available <= 0')
    }
    if (damagedOnly) {
      parts.push('damaged > 0')
    }
    return parts.length > 0 ? parts.join(' && ') : undefined
  }, [warehouseFilter, lowStockOnly, outOfStockOnly, damagedOnly])

  const listOptions = useMemo(
    () => ({
      perPage: 200,
      sort: '-updated',
      expand: 'product,warehouse',
      filter,
    }),
    [filter],
  )

  const queryKey = collectionQueryKey(COLLECTIONS.INVENTORY, listOptions)
  const { data, isLoading, refetch } = useTypedCollectionQuery('inventory', listOptions)
  useRealtimeCollection(COLLECTIONS.INVENTORY, queryKey)

  const { data: warehousesData } = useTypedCollectionQuery('warehouses', {
    perPage: 100,
    sort: 'name',
  })

  const adjustForm = useForm<AdjustStockFormValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      type: 'adjustment',
      direction: 'in',
      quantity: 1,
      reason: '',
      remarks: '',
    },
  })

  const levelsForm = useForm<SetLevelsFormValues>({
    resolver: zodResolver(setLevelsSchema),
    defaultValues: {
      min_stock: 0,
      max_stock: 0,
      reorder_level: 0,
      location: '',
    },
  })

  const adjustType = adjustForm.watch('type')
  const adjustDirection = adjustForm.watch('direction')
  const adjustQuantity = adjustForm.watch('quantity')
  const showDirection = adjustType === 'adjustment' || adjustType === 'transfer'

  const trackSerials = Boolean(adjustItem?.expand?.product?.track_serials)
  const isOutbound =
    adjustType === 'scrap' ||
    adjustType === 'consumption' ||
    (showDirection && adjustDirection === 'out')

  const availableSerialsOptions = useMemo(
    () =>
      adjustItem
        ? {
            filter: `product = "${adjustItem.product}" && status = "available" && warehouse = "${adjustItem.warehouse}"`,
            perPage: 500,
            sort: 'serial',
          }
        : undefined,
    [adjustItem],
  )

  const { data: availableSerialsData } = useTypedCollectionQuery(
    'product_serials',
    availableSerialsOptions ?? { filter: 'id = ""' },
  )
  const availableSerials = (availableSerialsData?.items ?? []) as ProductSerial[]

  const openAdjust = (item: InventoryWithExpand) => {
    setAdjustItem(item)
    setSerialsText('')
    setSelectedSerialIds([])
    adjustForm.reset({
      type: 'adjustment',
      direction: 'in',
      quantity: 1,
      reason: '',
      remarks: '',
    })
  }

  const openLevels = (item: InventoryWithExpand) => {
    setLevelsItem(item)
    levelsForm.reset({
      min_stock: item.min_stock,
      max_stock: item.max_stock,
      reorder_level: item.reorder_level,
      location: item.location ?? '',
    })
  }

  const handleAdjust = async (values: AdjustStockFormValues) => {
    if (!adjustItem) return

    const quantityDelta = getQuantityDelta(values.type, values.quantity, values.direction)
    const absQty = Math.abs(quantityDelta)
    const serials =
      trackSerials && quantityDelta > 0 ? parseSerialList(serialsText) : undefined

    if (trackSerials && quantityDelta > 0) {
      if (serials!.length !== absQty) {
        toast.error(`Enter exactly ${absQty} serial number(s) for this intake`)
        return
      }
    }

    if (trackSerials && quantityDelta < 0) {
      if (selectedSerialIds.length !== absQty) {
        toast.error(`Select exactly ${absQty} available serial number(s)`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      await adjustStock({
        productId: adjustItem.product,
        warehouseId: adjustItem.warehouse,
        quantityDelta,
        type: values.type,
        reason: values.reason,
        remarks: values.remarks,
        location: adjustItem.location,
        serials,
        serialIds: quantityDelta < 0 ? selectedSerialIds : undefined,
      })
      toast.success('Stock adjusted successfully')
      setAdjustItem(null)
      setSerialsText('')
      setSelectedSerialIds([])
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to adjust stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetLevels = async (values: SetLevelsFormValues) => {
    if (!levelsItem) return
    setIsSubmitting(true)
    try {
      await updateRecord(COLLECTIONS.INVENTORY, levelsItem.id, values)
      toast.success('Stock levels updated')
      setLevelsItem(null)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update levels')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<InventoryWithExpand>[] = [
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
                {product.sku ? ` · ${product.sku}` : ''}
              </Link>
            </div>
          </div>
        )
      },
    },
    {
      id: 'warehouse',
      accessorFn: (row) => row.expand?.warehouse?.name ?? row.warehouse,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Warehouse" />
      ),
      cell: ({ row }) => row.original.expand?.warehouse?.name ?? '—',
    },
    {
      accessorKey: 'location',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => row.getValue('location') || '—',
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" />
      ),
    },
    {
      accessorKey: 'available',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Available" />
      ),
      cell: ({ row }) => {
        const available = row.getValue('available') as number
        const low = isLowStock(row.original)
        return (
          <span className={cn(low && 'font-medium text-amber-600 dark:text-amber-400')}>
            {available}
          </span>
        )
      },
    },
    {
      accessorKey: 'reserved',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reserved" />
      ),
    },
    {
      accessorKey: 'damaged',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Damaged" />
      ),
      cell: ({ row }) => {
        const damaged = row.getValue('damaged') as number
        return (
          <span className={cn(damaged > 0 && 'font-medium text-destructive')}>
            {damaged}
          </span>
        )
      },
    },
    {
      accessorKey: 'min_stock',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Min Stock" />
      ),
    },
    {
      accessorKey: 'reorder_level',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reorder Level" />
      ),
    },
    ...(writable
      ? [
          {
            id: 'actions',
            cell: ({ row }: { row: { original: InventoryWithExpand } }) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openAdjust(row.original)}>
                    Adjust Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openLevels(row.original)}>
                    Set Levels
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as ColumnDef<InventoryWithExpand>,
        ]
      : []),
  ]

  const items = data?.items ?? []
  const warehouses = warehousesData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="View and manage stock levels across warehouses."
        actions={
          writable ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/warehouses">Warehouses</Link>
              </Button>
              <Button asChild>
                <Link to="/inventory/intake">
                  <Plus className="mr-2 h-4 w-4" />
                  Stock Intake
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {!isLoading && items.length === 0 && !filter ? (
        <EmptyState
          icon={Package}
          title="No inventory records"
          description="Inventory records are created when products are received into warehouses."
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="product"
          searchPlaceholder="Search products..."
          isLoading={isLoading}
          getRowClassName={(row) =>
            isLowStock(row) ? 'bg-amber-50/50 dark:bg-amber-950/20' : undefined
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-3">
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses.map((wh: Warehouse) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id="low-stock"
                  checked={lowStockOnly}
                  onCheckedChange={setLowStockOnly}
                />
                <Label htmlFor="low-stock" className="text-sm">
                  Low stock
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="out-of-stock"
                  checked={outOfStockOnly}
                  onCheckedChange={setOutOfStockOnly}
                />
                <Label htmlFor="out-of-stock" className="text-sm">
                  Out of stock
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="damaged"
                  checked={damagedOnly}
                  onCheckedChange={setDamagedOnly}
                />
                <Label htmlFor="damaged" className="text-sm">
                  Has damaged
                </Label>
              </div>
            </div>
          }
        />
      )}

      <Dialog open={Boolean(adjustItem)} onOpenChange={(open) => !open && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          {adjustItem && (
            <p className="text-sm text-muted-foreground">
              {adjustItem.expand?.product?.name} —{' '}
              {adjustItem.expand?.warehouse?.name}
            </p>
          )}
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(handleAdjust)} className="space-y-4">
              <FormField
                control={adjustForm.control}
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
                        {ADJUST_TYPES.map((type) => (
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
                  control={adjustForm.control}
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
                control={adjustForm.control}
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
              {trackSerials && !isOutbound && (
                <SerialNumbersInput
                  value={serialsText}
                  onChange={setSerialsText}
                  expectedQuantity={adjustQuantity ?? 1}
                />
              )}
              {trackSerials && isOutbound && (
                <div className="space-y-2">
                  <Label>
                    Select serials ({selectedSerialIds.length} / {adjustQuantity ?? 1})
                  </Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                    {availableSerials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No available serial numbers in this warehouse.
                      </p>
                    ) : (
                      availableSerials.map((serial) => (
                        <div key={serial.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`serial-${serial.id}`}
                            checked={selectedSerialIds.includes(serial.id)}
                            onCheckedChange={(checked) => {
                              setSelectedSerialIds((prev) =>
                                checked
                                  ? [...prev, serial.id]
                                  : prev.filter((id) => id !== serial.id),
                              )
                            }}
                          />
                          <label
                            htmlFor={`serial-${serial.id}`}
                            className="font-mono text-sm leading-none"
                          >
                            {serial.serial}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              <FormField
                control={adjustForm.control}
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
                control={adjustForm.control}
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
                  onClick={() => setAdjustItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adjust Stock
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(levelsItem)} onOpenChange={(open) => !open && setLevelsItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Stock Levels</DialogTitle>
          </DialogHeader>
          <Form {...levelsForm}>
            <form onSubmit={levelsForm.handleSubmit(handleSetLevels)} className="space-y-4">
              <FormField
                control={levelsForm.control}
                name="min_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={levelsForm.control}
                name="max_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={levelsForm.control}
                name="reorder_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={levelsForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Shelf / bin location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLevelsItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Levels
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

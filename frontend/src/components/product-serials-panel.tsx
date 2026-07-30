import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { SerialNumbersInput } from '@/components/serial-numbers-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatDate } from '@/lib/utils'
import { serialSchema } from '@/schemas'
import { createSerialsForIntake, parseSerialList } from '@/services/serials'
import type { Product, ProductSerialWithExpand, SerialStatus } from '@/types'
import { SERIAL_STATUSES, getLabel } from '@/utils/constants'

const SERIAL_VARIANTS: Record<SerialStatus, 'success' | 'warning' | 'secondary' | 'destructive' | 'outline' | 'default'> = {
  available: 'success',
  reserved: 'warning',
  assigned: 'secondary',
  damaged: 'destructive',
  scrap: 'destructive',
  sold: 'outline',
  installed: 'default',
  returned: 'secondary',
}

function SerialStatusBadge({ status }: { status: SerialStatus }) {
  return (
    <Badge variant={SERIAL_VARIANTS[status] ?? 'outline'}>
      {getLabel(SERIAL_STATUSES, status)}
    </Badge>
  )
}

const addSerialSchema = serialSchema.extend({
  warehouse: z.string().min(1, 'Warehouse is required'),
})

type AddSerialFormValues = z.infer<typeof addSerialSchema>

interface ProductSerialsPanelProps {
  product: Product
}

export function ProductSerialsPanel({ product }: ProductSerialsPanelProps) {
  const writeAccess = canWrite()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const listOptions = useMemo(
    () => ({
      filter: `product = "${product.id}"`,
      sort: '-created',
      perPage: 500,
      expand: 'warehouse,project',
    }),
    [product.id],
  )

  const queryKey = collectionQueryKey(COLLECTIONS.PRODUCT_SERIALS, listOptions)
  const { data, isLoading, refetch } = useTypedCollectionQuery(
    'product_serials',
    listOptions,
  )
  useRealtimeCollection(COLLECTIONS.PRODUCT_SERIALS, queryKey)

  const { data: warehousesData } = useTypedCollectionQuery('warehouses', {
    perPage: 100,
    sort: 'name',
  })

  const warehouses = warehousesData?.items ?? []
  const defaultWarehouse = warehouses.find((w) => w.is_default) ?? warehouses[0]

  const form = useForm<AddSerialFormValues>({
    resolver: zodResolver(addSerialSchema),
    defaultValues: {
      serial: '',
      notes: '',
      warehouse: defaultWarehouse?.id ?? '',
      status: 'available',
    },
  })

  const allSerials = (data?.items ?? []) as ProductSerialWithExpand[]
  const filteredSerials = useMemo(() => {
    if (statusFilter === 'all') return allSerials
    return allSerials.filter((s) => s.status === statusFilter)
  }, [allSerials, statusFilter])

  const handleAddSingle = async (values: AddSerialFormValues) => {
    setIsSubmitting(true)
    try {
      await createSerialsForIntake({
        productId: product.id,
        warehouseId: values.warehouse,
        serials: [values.serial],
        notes: values.notes,
      })
      toast.success('Serial number added')
      setAddOpen(false)
      form.reset({
        serial: '',
        notes: '',
        warehouse: defaultWarehouse?.id ?? '',
        status: 'available',
      })
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add serial')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddBulk = async () => {
    const serials = parseSerialList(bulkText)
    if (serials.length === 0) {
      toast.error('Enter at least one serial number')
      return
    }
    const warehouseId = form.getValues('warehouse') || defaultWarehouse?.id
    if (!warehouseId) {
      toast.error('Select a warehouse')
      return
    }

    setIsSubmitting(true)
    try {
      await createSerialsForIntake({
        productId: product.id,
        warehouseId,
        serials,
        notes: form.getValues('notes'),
      })
      toast.success(`${serials.length} serial number(s) added`)
      setAddOpen(false)
      setBulkText('')
      form.reset({
        serial: '',
        notes: '',
        warehouse: defaultWarehouse?.id ?? '',
        status: 'available',
      })
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add serials')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<ProductSerialWithExpand>[] = [
    {
      accessorKey: 'serial',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Serial" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue('serial')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <SerialStatusBadge status={row.getValue('status') as SerialStatus} />
      ),
    },
    {
      id: 'warehouse',
      accessorFn: (row) => row.expand?.warehouse?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Warehouse" />
      ),
    },
    {
      id: 'project',
      accessorFn: (row) => row.expand?.project?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        const project = row.original.expand?.project
        if (!project) return '—'
        return (
          <Link
            to={`/projects/${project.id}`}
            className="text-primary hover:underline"
          >
            {project.name}
          </Link>
        )
      },
    },
    {
      accessorKey: 'received_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Received" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('received_at') as string
        return date ? formatDate(date) : '—'
      },
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }) => row.getValue('notes') || '—',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Serial Numbers</CardTitle>
            <CardDescription>
              Individual unit serial numbers for this product.
            </CardDescription>
          </div>
          {writeAccess && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Serial
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {allSerials.length === 0 && !isLoading ? (
          <EmptyState
            icon={Plus}
            title="No serial numbers"
            description={
              product.track_serials
                ? 'Add stock with serial numbers or add serials manually.'
                : 'Enable "Track serial numbers" on the product to manage per-unit serials.'
            }
            action={
              writeAccess && product.track_serials ? (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Serial
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SERIAL_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DataTable
              columns={columns}
              data={filteredSerials}
              searchKey="serial"
              searchPlaceholder="Search serials..."
              isLoading={isLoading}
            />
          </>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Serial Number</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="single">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single</TabsTrigger>
              <TabsTrigger value="bulk">Bulk</TabsTrigger>
            </TabsList>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddSingle)}>
                <TabsContent value="single" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="serial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Serial number" {...field} />
                        </FormControl>
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
                            {warehouses.map((wh) => (
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Optional notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Serial
                    </Button>
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="bulk" className="space-y-4">
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
                            {warehouses.map((wh) => (
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
                  <SerialNumbersInput
                    value={bulkText}
                    onChange={setBulkText}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Optional notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddBulk}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Serials
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </form>
            </Form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

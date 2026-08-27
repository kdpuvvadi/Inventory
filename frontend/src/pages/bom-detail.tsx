import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Check, Download, FileJson, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings } from '@/contexts/settings-context'
import { useRecord, useRealtimeCollection, useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { downloadCsv, downloadJson, slugifyFilename } from '@/lib/utils'
import { bomItemSchema, type BomItemFormValues } from '@/schemas'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import { approveBom } from '@/services/inventory'
import type { BomItemWithExpand, BomStatus, BomWithExpand } from '@/types'
import { BOM_STATUSES, UNIT_OF_MEASURES, getLabel } from '@/utils/constants'
import { stripHtml } from '@/utils/documents'
import { printBom } from '@/utils/print-bom'

const BOM_STATUS_VARIANTS: Record<BomStatus, 'outline' | 'success' | 'secondary' | 'warning'> = {
  draft: 'outline',
  active: 'secondary',
  approved: 'success',
  archived: 'outline',
}

const CSV_COLUMNS = ['Product', 'SKU', 'Asset Tag', 'Quantity', 'Unit']

function BomStatusBadge({ status }: { status: BomStatus }) {
  return (
    <Badge variant={BOM_STATUS_VARIANTS[status]} className="capitalize">
      {getLabel(BOM_STATUSES, status)}
    </Badge>
  )
}

function toExportRows(items: BomItemWithExpand[]) {
  return items.map((item) => ({
    Product: item.expand?.product?.name ?? item.product,
    SKU: item.expand?.product?.sku ?? '',
    'Asset Tag': item.expand?.product?.asset_tag ?? '',
    Quantity: item.quantity,
    Unit: item.unit_of_measure,
  }))
}

export default function BomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const writable = canWrite()
  const { settings } = useSettings()

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BomItemWithExpand | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<BomItemWithExpand | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)

  const { data: bom, isLoading: bomLoading, refetch: refetchBom } = useRecord<BomWithExpand>(
    COLLECTIONS.BOMS,
    id,
    'project',
  )

  useRealtimeCollection(COLLECTIONS.BOM_ITEMS)

  const { data: productsData } = useTypedCollectionQuery(COLLECTIONS.PRODUCTS, {
    sort: 'name',
    perPage: 500,
  })

  const { data: bomItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['bom-items', id],
    queryFn: () =>
      pb.collection(COLLECTIONS.BOM_ITEMS).getFullList<BomItemWithExpand>({
        filter: `bom = "${id}"`,
        expand: 'product',
        sort: 'created',
      }),
    enabled: Boolean(id),
  })

  const itemForm = useForm<BomItemFormValues>({
    resolver: zodResolver(bomItemSchema),
    defaultValues: {
      bom: id ?? '',
      product: '',
      quantity: 1,
      unit_of_measure: 'each',
    },
  })

  const addedProductIds = useMemo(
    () => new Set(bomItems.map((item) => item.product)),
    [bomItems],
  )

  const productOptions = useMemo(() => {
    const products = productsData?.items ?? []
    if (editingItem) {
      return products.filter(
        (product) => product.id === editingItem.product || !addedProductIds.has(product.id),
      )
    }
    return products.filter((product) => !addedProductIds.has(product.id))
  }, [addedProductIds, editingItem, productsData?.items])

  const saveItemMutation = useMutation({
    mutationFn: (values: BomItemFormValues) => {
      if (editingItem) {
        return updateRecord(COLLECTIONS.BOM_ITEMS, editingItem.id, values)
      }
      return createRecord(COLLECTIONS.BOM_ITEMS, values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items', id] })
      toast.success(editingItem ? 'BOM item updated' : 'Item added to BOM')
      closeItemDialog()
    },
    onError: () => toast.error(editingItem ? 'Failed to update item' : 'Failed to add BOM item'),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteRecord(COLLECTIONS.BOM_ITEMS, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items', id] })
      toast.success('Item removed')
      setDeleteItemTarget(null)
    },
    onError: () => toast.error('Failed to remove item'),
  })

  const approveMutation = useMutation({
    mutationFn: () => approveBom(id!),
    onSuccess: async () => {
      await refetchBom()
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.BOMS] })
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.PROJECT_ASSIGNMENTS] })
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.INVENTORY] })
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.STOCK_TRANSACTIONS] })
      toast.success('BOM approved and items assigned to the project')
      setApproveOpen(false)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to approve BOM'),
  })

  const openAddItem = () => {
    setEditingItem(null)
    itemForm.reset({
      bom: id ?? '',
      product: '',
      quantity: 1,
      unit_of_measure: 'each',
    })
    setItemDialogOpen(true)
  }

  const openEditItem = (item: BomItemWithExpand) => {
    setEditingItem(item)
    itemForm.reset({
      bom: item.bom,
      product: item.product,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
    })
    setItemDialogOpen(true)
  }

  const closeItemDialog = () => {
    setItemDialogOpen(false)
    setEditingItem(null)
  }

  const exportBaseName = `bom-${slugifyFilename(bom?.name ?? 'export')}`

  const handleExportCsv = () => {
    downloadCsv(toExportRows(bomItems), `${exportBaseName}.csv`, CSV_COLUMNS)
    toast.success('CSV exported')
  }

  const handleExportJson = () => {
    downloadJson(
      {
        name: bom?.name,
        version: bom?.version,
        status: bom?.status,
        project: bom?.expand?.project?.name ?? null,
        notes: stripHtml(bom?.notes),
        items: bomItems.map((item) => ({
          product: item.expand?.product?.name ?? item.product,
          sku: item.expand?.product?.sku ?? '',
          asset_tag: item.expand?.product?.asset_tag ?? '',
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
        })),
      },
      `${exportBaseName}.json`,
    )
    toast.success('JSON exported')
  }

  const handlePrintPdf = () => {
    if (!bom) return
    try {
      printBom({ bom, items: bomItems, settings })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to print BOM')
    }
  }

  const itemColumns: ColumnDef<BomItemWithExpand>[] = [
    {
      id: 'product',
      accessorFn: (row) => row.expand?.product?.name ?? row.product,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    },
    {
      id: 'sku',
      accessorFn: (row) => row.expand?.product?.sku ?? '',
      header: 'SKU',
      cell: ({ row }) => row.original.expand?.product?.sku || '—',
    },
    { accessorKey: 'quantity', header: 'Quantity' },
    { accessorKey: 'unit_of_measure', header: 'UOM' },
    ...(writable && bom?.status !== 'approved'
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: BomItemWithExpand } }) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditItem(row.original)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteItemTarget(row.original)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
          } as ColumnDef<BomItemWithExpand>,
        ]
      : []),
  ]

  if (bomLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!bom) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/bom">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to BOMs
          </Link>
        </Button>
        <p className="text-muted-foreground">BOM not found.</p>
      </div>
    )
  }

  const canEditItems = writable && bom.status !== 'approved'

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link to="/bom">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to BOMs
        </Link>
      </Button>

      <PageHeader
        title={bom.name}
        description="Add components and quantities for this bill of materials."
        breadcrumbs={[
          { label: 'BOM', href: '/bom' },
          { label: bom.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCsv}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJson}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Export JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handlePrintPdf}>
              <Printer className="mr-2 h-4 w-4" />
              Print PDF
            </Button>
            {writable && bom.status !== 'approved' && (
              <Button
                onClick={() => setApproveOpen(true)}
                disabled={bomItems.length === 0 || !bom.project}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            {canEditItems && (
              <Button onClick={openAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Project</dt>
              <dd className="text-sm">
                {bom.expand?.project ? (
                  <Link
                    to={`/projects/${bom.expand.project.id}`}
                    className="text-primary hover:underline"
                  >
                    {bom.expand.project.name}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Version</dt>
              <dd className="text-sm">{bom.version || '—'}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd>
                <BomStatusBadge status={bom.status} />
              </dd>
            </div>
          </dl>
          {stripHtml(bom.notes) && (
            <p className="mt-4 text-sm text-muted-foreground">{stripHtml(bom.notes)}</p>
          )}
          {writable && bom.status !== 'approved' && !bom.project && (
            <p className="mt-4 text-sm text-muted-foreground">
              Link a project before approving so items can be added to Assigned Products.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent>
          {bomItems.length === 0 && !itemsLoading ? (
            <EmptyState
              icon={Plus}
              title="No items yet"
              description="Add products and quantities to build this bill of materials."
              action={
                canEditItems ? (
                  <Button onClick={openAddItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              columns={itemColumns}
              data={bomItems}
              isLoading={itemsLoading}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={itemDialogOpen} onOpenChange={(open) => !open && closeItemDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit BOM Item' : 'Add BOM Item'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the quantity or unit for this component.'
                : 'Add a component and quantity to this bill of materials.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form
              onSubmit={itemForm.handleSubmit((values) => saveItemMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={itemForm.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={Boolean(editingItem)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productOptions.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="unit_of_measure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIT_OF_MEASURES.map((uom) => (
                            <SelectItem key={uom.value} value={uom.value}>
                              {uom.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeItemDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveItemMutation.isPending}>
                  {saveItemMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve BOM"
        description="Approving this BOM assigns all components to the linked project and takes them from available stock."
        confirmLabel="Approve and assign"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
      />

      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        onOpenChange={(open) => !open && setDeleteItemTarget(null)}
        title="Remove Item"
        description="Remove this component from the BOM?"
        confirmLabel="Remove"
        destructive
        loading={deleteItemMutation.isPending}
        onConfirm={() =>
          deleteItemTarget && deleteItemMutation.mutate(deleteItemTarget.id)
        }
      />
    </div>
  )
}

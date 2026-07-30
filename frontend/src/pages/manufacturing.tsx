import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { bomItemSchema, bomSchema, type BomFormValues, type BomItemFormValues } from '@/schemas'
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from '@/services/crud'
import type { BomItemWithExpand, BomStatus, BomWithExpand } from '@/types'
import { UNIT_OF_MEASURES } from '@/utils/constants'

const BOM_LIST_OPTIONS = { expand: 'finished_product', sort: '-updated' }
const BOM_QUERY_KEY = collectionQueryKey(COLLECTIONS.BOMS, BOM_LIST_OPTIONS)

const BOM_STATUS_VARIANTS: Record<BomStatus, 'outline' | 'success' | 'secondary'> = {
  draft: 'outline',
  active: 'success',
  archived: 'secondary',
}

function BomStatusBadge({ status }: { status: BomStatus }) {
  return (
    <Badge variant={BOM_STATUS_VARIANTS[status]} className="capitalize">
      {status}
    </Badge>
  )
}

export default function ManufacturingPage() {
  const queryClient = useQueryClient()
  const writable = canWrite()

  const [bomDialogOpen, setBomDialogOpen] = useState(false)
  const [editingBom, setEditingBom] = useState<BomWithExpand | null>(null)
  const [detailBom, setDetailBom] = useState<BomWithExpand | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BomWithExpand | null>(null)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [deleteItemTarget, setDeleteItemTarget] = useState<BomItemWithExpand | null>(null)

  useRealtimeCollection(COLLECTIONS.BOMS, BOM_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.BOM_ITEMS)

  const { data: bomsData, isLoading: bomsLoading } = useTypedCollectionQuery(
    COLLECTIONS.BOMS,
    BOM_LIST_OPTIONS,
  )

  const { data: productsData } = useTypedCollectionQuery(COLLECTIONS.PRODUCTS, {
    sort: 'name',
    perPage: 500,
  })

  const { data: bomItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['bom-items', detailBom?.id],
    queryFn: () =>
      pb.collection(COLLECTIONS.BOM_ITEMS).getFullList<BomItemWithExpand>({
        filter: `bom = "${detailBom!.id}"`,
        expand: 'product',
        sort: 'created',
      }),
    enabled: Boolean(detailBom?.id),
  })

  const bomForm = useForm<BomFormValues>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      name: '',
      finished_product: '',
      version: '1.0',
      notes: '',
      status: 'draft',
    },
  })

  const itemForm = useForm<BomItemFormValues>({
    resolver: zodResolver(bomItemSchema),
    defaultValues: {
      bom: '',
      product: '',
      quantity: 1,
      unit_of_measure: 'each',
    },
  })

  const saveBomMutation = useMutation({
    mutationFn: async (values: BomFormValues) => {
      if (editingBom) {
        return updateRecord(COLLECTIONS.BOMS, editingBom.id, values)
      }
      return createRecord(COLLECTIONS.BOMS, values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOM_QUERY_KEY })
      toast.success(editingBom ? 'BOM updated' : 'BOM created')
      closeBomDialog()
    },
    onError: () => toast.error('Failed to save BOM'),
  })

  const deleteBomMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(COLLECTIONS.BOMS, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOM_QUERY_KEY })
      toast.success('BOM deleted')
      setDeleteTarget(null)
      if (detailBom?.id === deleteTarget?.id) setDetailBom(null)
    },
    onError: () => toast.error('Failed to delete BOM'),
  })

  const saveItemMutation = useMutation({
    mutationFn: (values: BomItemFormValues) =>
      createRecord(COLLECTIONS.BOM_ITEMS, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items', detailBom?.id] })
      toast.success('Item added to BOM')
      setItemDialogOpen(false)
      itemForm.reset({
        bom: detailBom?.id ?? '',
        product: '',
        quantity: 1,
        unit_of_measure: 'each',
      })
    },
    onError: () => toast.error('Failed to add BOM item'),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(COLLECTIONS.BOM_ITEMS, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items', detailBom?.id] })
      toast.success('Item removed')
      setDeleteItemTarget(null)
    },
    onError: () => toast.error('Failed to remove item'),
  })

  const openCreateBom = () => {
    setEditingBom(null)
    bomForm.reset({
      name: '',
      finished_product: '',
      version: '1.0',
      notes: '',
      status: 'draft',
    })
    setBomDialogOpen(true)
  }

  const openEditBom = (bom: BomWithExpand) => {
    setEditingBom(bom)
    bomForm.reset({
      name: bom.name,
      finished_product: bom.finished_product,
      version: bom.version,
      notes: bom.notes ?? '',
      status: bom.status,
    })
    setBomDialogOpen(true)
  }

  const closeBomDialog = () => {
    setBomDialogOpen(false)
    setEditingBom(null)
  }

  const openAddItem = () => {
    itemForm.reset({
      bom: detailBom?.id ?? '',
      product: '',
      quantity: 1,
      unit_of_measure: 'each',
    })
    setItemDialogOpen(true)
  }

  const columns: ColumnDef<BomWithExpand>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      id: 'finished_product',
      accessorFn: (row) => row.expand?.finished_product?.name ?? row.finished_product,
      header: 'Finished Product',
    },
    { accessorKey: 'version', header: 'Version' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <BomStatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailBom(row.original)}
          >
            View
          </Button>
          {writable && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditBom(row.original)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  const itemColumns: ColumnDef<BomItemWithExpand>[] = [
    {
      id: 'product',
      accessorFn: (row) => row.expand?.product?.name ?? row.product,
      header: 'Product',
    },
    { accessorKey: 'quantity', header: 'Quantity' },
    { accessorKey: 'unit_of_measure', header: 'UOM' },
    ...(writable
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: BomItemWithExpand } }) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteItemTarget(row.original)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            ),
          } as ColumnDef<BomItemWithExpand>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM / Manufacturing"
        description="Manage bills of materials and component lists."
        actions={
          writable && (
            <Button onClick={openCreateBom}>
              <Plus className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          )
        }
      />

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Automatic stock
            consumption on production runs will be available in a future release.
            BOMs currently serve as reference documentation for manufacturing
            processes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bills of Materials</CardTitle>
          <CardDescription>All BOMs with finished product references</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={bomsData?.items ?? []}
            searchKey="name"
            isLoading={bomsLoading}
          />
        </CardContent>
      </Card>

      <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBom ? 'Edit BOM' : 'Create BOM'}</DialogTitle>
            <DialogDescription>
              Define a bill of materials for a finished product.
            </DialogDescription>
          </DialogHeader>
          <Form {...bomForm}>
            <form
              onSubmit={bomForm.handleSubmit((values) => saveBomMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={bomForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Assembly BOM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bomForm.control}
                name="finished_product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Finished Product</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productsData?.items.map((product) => (
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
                  control={bomForm.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bomForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={bomForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeBomDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveBomMutation.isPending}>
                  {saveBomMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingBom ? 'Save Changes' : 'Create BOM'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailBom)} onOpenChange={(open) => !open && setDetailBom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailBom?.name}</DialogTitle>
            <DialogDescription>
              {detailBom?.expand?.finished_product?.name ?? 'Finished product'} · v
              {detailBom?.version}{' '}
              {detailBom && <BomStatusBadge status={detailBom.status} />}
            </DialogDescription>
          </DialogHeader>

          {detailBom?.notes && (
            <p className="text-sm text-muted-foreground">{detailBom.notes}</p>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Components</h3>
            {writable && (
              <Button size="sm" onClick={openAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            )}
          </div>

          <DataTable
            columns={itemColumns}
            data={bomItems}
            isLoading={itemsLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BOM Item</DialogTitle>
            <DialogDescription>Add a component to this bill of materials.</DialogDescription>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productsData?.items.map((product) => (
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
                <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveItemMutation.isPending}>
                  {saveItemMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Item
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete BOM"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteBomMutation.isPending}
        onConfirm={() => deleteTarget && deleteBomMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        onOpenChange={(open) => !open && setDeleteItemTarget(null)}
        title="Remove Item"
        description="Remove this component from the BOM?"
        confirmLabel="Remove"
        destructive
        loading={deleteItemMutation.isPending}
        onConfirm={() => deleteItemTarget && deleteItemMutation.mutate(deleteItemTarget.id)}
      />
    </div>
  )
}

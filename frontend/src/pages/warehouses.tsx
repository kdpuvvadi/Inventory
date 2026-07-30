import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Star, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { RecordModel } from 'pocketbase'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { warehouseSchema, type WarehouseFormValues } from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, deleteRecord, listRecords, updateRecord } from '@/services/crud'
import type { Warehouse } from '@/types'

const defaultValues: WarehouseFormValues = {
  name: '',
  code: '',
  address: '',
  is_default: false,
}

export default function WarehousesPage() {
  const writeAccess = canWrite()
  const listOptions = useMemo(() => ({ sort: '-is_default,name', perPage: 100 }), [])
  const queryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.WAREHOUSES, listOptions),
    [listOptions],
  )

  const { data, isLoading } = useTypedCollectionQuery('warehouses', listOptions)
  useRealtimeCollection(COLLECTIONS.WAREHOUSES, queryKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Warehouse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!dialogOpen) return
    if (editingRecord) {
      form.reset({
        name: editingRecord.name ?? '',
        code: editingRecord.code ?? '',
        address: editingRecord.address ?? '',
        is_default: Boolean(editingRecord.is_default),
      })
    } else {
      const noWarehouses = (data?.items.length ?? 0) === 0
      form.reset({ ...defaultValues, is_default: noWarehouses })
    }
  }, [dialogOpen, editingRecord, form, data?.items.length])

  const openCreate = useCallback(() => {
    setEditingRecord(null)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((record: Warehouse) => {
    setEditingRecord(record)
    setDialogOpen(true)
  }, [])

  const clearOtherDefaults = async (keepId?: string) => {
    const result = await listRecords<Warehouse & RecordModel>(COLLECTIONS.WAREHOUSES, {
      filter: 'is_default = true',
      perPage: 100,
    })
    await Promise.all(
      result.items
        .filter((wh) => wh.id !== keepId)
        .map((wh) =>
          updateRecord(COLLECTIONS.WAREHOUSES, wh.id, { is_default: false }),
        ),
    )
  }

  const handleSave = async (values: WarehouseFormValues) => {
    setIsSaving(true)
    try {
      if (values.is_default) {
        await clearOtherDefaults(editingRecord?.id)
      }

      if (editingRecord) {
        const updated = await updateRecord<Warehouse & RecordModel>(
          COLLECTIONS.WAREHOUSES,
          editingRecord.id,
          values,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.WAREHOUSES,
          recordId: updated.id,
          previousValue: editingRecord as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Warehouse updated')
      } else {
        const created = await createRecord<Warehouse & RecordModel>(
          COLLECTIONS.WAREHOUSES,
          values,
        )
        if (values.is_default) {
          await clearOtherDefaults(created.id)
        }
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.WAREHOUSES,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Warehouse created')
      }

      setDialogOpen(false)
      setEditingRecord(null)
    } catch {
      toast.error(
        editingRecord ? 'Failed to update warehouse' : 'Failed to create warehouse',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteRecord(COLLECTIONS.WAREHOUSES, deleteTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.WAREHOUSES,
        recordId: deleteTarget.id,
        previousValue: deleteTarget as unknown as Record<string, unknown>,
      })
      toast.success('Warehouse deleted')
      setDeleteTarget(null)
    } catch {
      toast.error(
        'Failed to delete warehouse. It may still have inventory records.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<Warehouse>[]>(() => {
    const cols: ColumnDef<Warehouse>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_default && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3" />
                Default
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'code',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Code" />
        ),
      },
      {
        accessorKey: 'address',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Address" />
        ),
        cell: ({ row }) => row.original.address || '—',
      },
    ]

    cols.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {writeAccess && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(row.original)}
                aria-label="Edit warehouse"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Delete warehouse"
                disabled={row.original.is_default}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    })

    return cols
  }, [writeAccess, openEdit])

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage storage locations used for inventory and stock movements."
        actions={
          writeAccess ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          ) : undefined
        }
      />

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses"
          description="Create a warehouse before receiving stock or running stock intake."
          action={
            writeAccess ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Warehouse
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="name"
          searchPlaceholder="Search warehouses..."
          isLoading={isLoading}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit Warehouse' : 'Add Warehouse'}
            </DialogTitle>
            <DialogDescription>
              Warehouses are used for inventory locations and stock transactions.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="MAIN" {...field} />
                    </FormControl>
                    <FormDescription>Unique short code (e.g. MAIN, WH-01)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Street, city, country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Default warehouse</FormLabel>
                      <FormDescription>
                        Used when receiving stock or assigning items if no warehouse is chosen.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRecord ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete warehouse?"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone if inventory still references it.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={isDeleting}
        destructive
      />
    </div>
  )
}

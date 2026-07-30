import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import type { RecordModel } from 'pocketbase'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { supplierSchema, type SupplierFormValues } from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import type { Supplier } from '@/types'

const defaultValues: SupplierFormValues = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  gst_vat_number: '',
  payment_terms: '',
  notes: '',
}

export default function SuppliersPage() {
  const writeAccess = canWrite()
  const listOptions = useMemo(
    () => ({ sort: 'name', perPage: 100 }),
    [],
  )
  const queryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.SUPPLIERS, listOptions),
    [listOptions],
  )

  const { data, isLoading } = useTypedCollectionQuery('suppliers', listOptions)
  useRealtimeCollection(COLLECTIONS.SUPPLIERS, queryKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!dialogOpen) return
    if (editingRecord) {
      form.reset({
        name: editingRecord.name ?? '',
        contact_person: editingRecord.contact_person ?? '',
        email: editingRecord.email ?? '',
        phone: editingRecord.phone ?? '',
        address: editingRecord.address ?? '',
        website: editingRecord.website ?? '',
        gst_vat_number: editingRecord.gst_vat_number ?? '',
        payment_terms: editingRecord.payment_terms ?? '',
        notes: editingRecord.notes ?? '',
      })
    } else {
      form.reset(defaultValues)
    }
  }, [dialogOpen, editingRecord, form])

  const openCreate = useCallback(() => {
    setEditingRecord(null)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((record: Supplier) => {
    setEditingRecord(record)
    setDialogOpen(true)
  }, [])

  const handleSave = async (values: SupplierFormValues) => {
    setIsSaving(true)
    try {
      if (editingRecord) {
        const updated = await updateRecord<Supplier & RecordModel>(
          COLLECTIONS.SUPPLIERS,
          editingRecord.id,
          values,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.SUPPLIERS,
          recordId: updated.id,
          previousValue: editingRecord as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Supplier updated')
      } else {
        const created = await createRecord<Supplier & RecordModel>(
          COLLECTIONS.SUPPLIERS,
          values,
        )
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.SUPPLIERS,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Supplier created')
      }
      setDialogOpen(false)
      setEditingRecord(null)
    } catch {
      toast.error(
        editingRecord ? 'Failed to update supplier' : 'Failed to create supplier',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteRecord(COLLECTIONS.SUPPLIERS, deleteTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.SUPPLIERS,
        recordId: deleteTarget.id,
        previousValue: deleteTarget as unknown as Record<string, unknown>,
      })
      toast.success('Supplier deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete supplier')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<Supplier>[]>(() => {
    const cols: ColumnDef<Supplier>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/suppliers/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'contact_person',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Contact Person" />
        ),
        cell: ({ row }) => row.original.contact_person || '—',
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => row.original.email || '—',
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        cell: ({ row }) => row.original.phone || '—',
      },
      {
        accessorKey: 'gst_vat_number',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="GST/VAT" />
        ),
        cell: ({ row }) => row.original.gst_vat_number || '—',
      },
      {
        accessorKey: 'website',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Website" />
        ),
        cell: ({ row }) =>
          row.original.website ? (
            <a
              href={row.original.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {row.original.website}
            </a>
          ) : (
            '—'
          ),
      },
    ]

    cols.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/suppliers/${row.original.id}`}>View</Link>
          </Button>
          {writeAccess && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(row.original)}
                aria-label="Edit supplier"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Delete supplier"
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage suppliers and vendor contact information."
        actions={
          writeAccess ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        searchKey="name"
        searchPlaceholder="Search suppliers..."
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? 'Update supplier details below.'
                : 'Enter details for the new supplier.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Supplier name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="gst_vat_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST/VAT Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Tax registration number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Net 30" {...field} />
                    </FormControl>
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
                      <Textarea placeholder="Address" rows={2} {...field} />
                    </FormControl>
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
                      <Textarea placeholder="Additional notes" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
        title="Delete supplier"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={isDeleting}
        destructive
      />
    </div>
  )
}

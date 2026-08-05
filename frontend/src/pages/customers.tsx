import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { StateSelect } from '@/components/state-select'
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
import { customerSchema, type CustomerFormValues } from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import type { Customer } from '@/types'

const defaultValues: CustomerFormValues = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  state: '',
  pincode: '',
  notes: '',
}

export default function CustomersPage() {
  const writeAccess = canWrite()
  const listOptions = useMemo(
    () => ({ sort: 'name', perPage: 100 }),
    [],
  )
  const queryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.CUSTOMERS, listOptions),
    [listOptions],
  )

  const { data, isLoading } = useTypedCollectionQuery('customers', listOptions)
  useRealtimeCollection(COLLECTIONS.CUSTOMERS, queryKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
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
        state: editingRecord.state ?? '',
        pincode: editingRecord.pincode ?? '',
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

  const openEdit = useCallback((record: Customer) => {
    setEditingRecord(record)
    setDialogOpen(true)
  }, [])

  const handleSave = async (values: CustomerFormValues) => {
    setIsSaving(true)
    try {
      if (editingRecord) {
        const updated = await updateRecord<Customer & RecordModel>(
          COLLECTIONS.CUSTOMERS,
          editingRecord.id,
          values,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.CUSTOMERS,
          recordId: updated.id,
          previousValue: editingRecord as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Customer updated')
      } else {
        const created = await createRecord<Customer & RecordModel>(
          COLLECTIONS.CUSTOMERS,
          values,
        )
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.CUSTOMERS,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Customer created')
      }
      setDialogOpen(false)
      setEditingRecord(null)
    } catch {
      toast.error(
        editingRecord ? 'Failed to update customer' : 'Failed to create customer',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteRecord(COLLECTIONS.CUSTOMERS, deleteTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.CUSTOMERS,
        recordId: deleteTarget.id,
        previousValue: deleteTarget as unknown as Record<string, unknown>,
      })
      toast.success('Customer deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete customer')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<Customer>[]>(() => {
    const cols: ColumnDef<Customer>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/customers/${row.original.id}`}
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
    ]

    cols.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/customers/${row.original.id}`}>View</Link>
          </Button>
          {writeAccess && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(row.original)}
                aria-label="Edit customer"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Delete customer"
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
        title="Customers"
        description="Manage customer accounts and contact information."
        actions={
          writeAccess ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        searchKey="name"
        searchPlaceholder="Search customers..."
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit Customer' : 'Add Customer'}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? 'Update customer details below.'
                : 'Enter details for the new customer.'}
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
                      <Input placeholder="Customer name" {...field} />
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
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Street, City" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <StateSelect
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input placeholder="Pincode" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
        title="Delete customer"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={isDeleting}
        destructive
      />
    </div>
  )
}

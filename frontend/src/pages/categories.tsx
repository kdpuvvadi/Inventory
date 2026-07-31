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
import type { RecordModel } from 'pocketbase'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { categorySchema, type CategoryFormValues } from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import type { Category, CategoryWithExpand } from '@/types'

const defaultValues: CategoryFormValues = {
  name: '',
  description: '',
  parent: '',
}

export default function CategoriesPage() {
  const writeAccess = canWrite()
  const listOptions = useMemo(
    () => ({ sort: 'name', perPage: 100, expand: 'parent' }),
    [],
  )
  const queryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.CATEGORIES, listOptions),
    [listOptions],
  )

  const { data, isLoading } = useTypedCollectionQuery('categories', listOptions)

  const { data: allCategories } = useTypedCollectionQuery('categories', {
    sort: 'name',
    perPage: 200,
  })
  useRealtimeCollection(COLLECTIONS.CATEGORIES, queryKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  })

  const parentOptions = useMemo(() => {
    const items = allCategories?.items ?? []
    if (!editingRecord) return items
    return items.filter((category) => category.id !== editingRecord.id)
  }, [allCategories?.items, editingRecord])

  useEffect(() => {
    if (!dialogOpen) return
    if (editingRecord) {
      form.reset({
        name: editingRecord.name ?? '',
        description: editingRecord.description ?? '',
        parent: editingRecord.parent ?? '',
      })
    } else {
      form.reset(defaultValues)
    }
  }, [dialogOpen, editingRecord, form])

  const openCreate = useCallback(() => {
    setEditingRecord(null)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((record: Category) => {
    setEditingRecord(record)
    setDialogOpen(true)
  }, [])

  const handleSave = async (values: CategoryFormValues) => {
    setIsSaving(true)
    const payload = {
      ...values,
      parent: values.parent || '',
    }
    try {
      if (editingRecord) {
        const updated = await updateRecord<Category & RecordModel>(
          COLLECTIONS.CATEGORIES,
          editingRecord.id,
          payload,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.CATEGORIES,
          recordId: updated.id,
          previousValue: editingRecord as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Category updated')
      } else {
        const created = await createRecord<Category & RecordModel>(
          COLLECTIONS.CATEGORIES,
          payload,
        )
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.CATEGORIES,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Category created')
      }
      setDialogOpen(false)
      setEditingRecord(null)
    } catch {
      toast.error(
        editingRecord ? 'Failed to update category' : 'Failed to create category',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteRecord(COLLECTIONS.CATEGORIES, deleteTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.CATEGORIES,
        recordId: deleteTarget.id,
        previousValue: deleteTarget as unknown as Record<string, unknown>,
      })
      toast.success('Category deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete category')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<CategoryWithExpand>[]>(() => {
    const cols: ColumnDef<CategoryWithExpand>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/categories/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => row.original.description || '—',
      },
      {
        id: 'parent',
        accessorFn: (row) => row.expand?.parent?.name ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Parent" />
        ),
        cell: ({ row }) => row.original.expand?.parent?.name || '—',
      },
    ]

    cols.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/categories/${row.original.id}`}>View</Link>
          </Button>
          {writeAccess && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(row.original)}
                aria-label="Edit category"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Delete category"
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
        title="Categories"
        description="Organize products with nested categories."
        actions={
          writeAccess ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as CategoryWithExpand[]}
        searchKey="name"
        searchPlaceholder="Search categories..."
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? 'Update category details below.'
                : 'Create a new product category.'}
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
                      <Input placeholder="Category name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) =>
                        field.onChange(value === 'none' ? '' : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (top level)</SelectItem>
                        {parentOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
        title="Delete category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={isDeleting}
        destructive
      />
    </div>
  )
}

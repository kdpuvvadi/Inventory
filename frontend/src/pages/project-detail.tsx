import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Loader2, Package, Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  assignProductToProject,
  returnProductFromProject,
} from '@/services/inventory'
import type {
  Product,
  ProjectAssignmentWithExpand,
  ProjectWithExpand,
  StockTransactionWithExpand,
} from '@/types'
import { TRANSACTION_TYPES, getLabel } from '@/utils/constants'

const assignSchema = z.object({
  product: z.string().min(1, 'Product is required'),
  serialId: z.string().optional(),
  notes: z.string().optional(),
})

type AssignFormValues = z.infer<typeof assignSchema>

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assignOpen, setAssignOpen] = useState(false)
  const [returningId, setReturningId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const writable = canWrite()

  const { data: project, isLoading: projectLoading } = useRecord<ProjectWithExpand>(
    COLLECTIONS.PROJECTS,
    id,
    'customer',
  )

  const assignmentsOptions = useMemo(
    () => ({
      perPage: 200,
      filter: id ? `project = "${id}" && returned_at = ""` : undefined,
      expand: 'product,assigned_by',
      sort: '-assigned_at',
    }),
    [id],
  )

  const { data: assignmentsData, isLoading: assignmentsLoading, refetch: refetchAssignments } =
    useTypedCollectionQuery('project_assignments', assignmentsOptions)

  const historyFilter = useMemo(() => {
    if (!id) return undefined
    return `(type = "project_assignment" || type = "project_return") && reference_document != ""`
  }, [id])

  const { data: transactionsData, isLoading: historyLoading } = useTypedCollectionQuery(
    'stock_transactions',
    {
      perPage: 200,
      filter: historyFilter,
      expand: 'product,warehouse,user',
      sort: '-created',
    },
  )

  const { data: productsData } = useTypedCollectionQuery('products', {
    perPage: 500,
    filter: 'status = "in_stock"',
    sort: 'name',
  })

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { product: '', serialId: '', notes: '' },
  })

  const selectedProductId = form.watch('product')
  const selectedProduct = useMemo(
    () => (productsData?.items ?? []).find((p) => p.id === selectedProductId),
    [productsData, selectedProductId],
  )

  const availableSerialsOptions = useMemo(
    () =>
      selectedProduct?.track_serials
        ? {
            filter: `product = "${selectedProductId}" && status = "available"`,
            perPage: 500,
            sort: 'serial',
          }
        : undefined,
    [selectedProduct, selectedProductId],
  )

  const { data: availableSerialsData } = useTypedCollectionQuery(
    'product_serials',
    availableSerialsOptions ?? { filter: 'id = ""' },
  )

  const allAssignmentsOptions = useMemo(
    () => ({
      perPage: 500,
      filter: id ? `project = "${id}"` : undefined,
      expand: 'product',
      sort: '-assigned_at',
    }),
    [id],
  )

  const { data: allAssignmentsData } = useTypedCollectionQuery(
    'project_assignments',
    allAssignmentsOptions,
  )

  const historyItems = useMemo(() => {
    const transactions = transactionsData?.items ?? []
    const assignmentProductIds = new Set(
      (allAssignmentsData?.items ?? []).map((a) => a.product),
    )
    const relatedAssignmentIds = new Set(
      (allAssignmentsData?.items ?? []).map((a) => a.id),
    )

    return transactions.filter((tx) => {
      if (relatedAssignmentIds.has(tx.reference_document)) return true
      if (assignmentProductIds.has(tx.product)) return true
      return false
    })
  }, [transactionsData, allAssignmentsData])

  const handleAssign = async (values: AssignFormValues) => {
    if (!id) return

    if (selectedProduct?.track_serials && !values.serialId) {
      toast.error('Select an available serial number for this product')
      return
    }

    setIsSubmitting(true)
    try {
      await assignProductToProject({
        projectId: id,
        productId: values.product,
        notes: values.notes,
        serialId: values.serialId || undefined,
      })
      toast.success('Product assigned to project')
      setAssignOpen(false)
      form.reset()
      await refetchAssignments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReturn = async () => {
    if (!returningId) return
    setIsSubmitting(true)
    try {
      await returnProductFromProject(returningId)
      toast.success('Product returned from project')
      setReturningId(null)
      await refetchAssignments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to return product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const assignmentColumns: ColumnDef<ProjectAssignmentWithExpand>[] = [
    {
      id: 'product',
      accessorFn: (row) => row.expand?.product?.name ?? row.product,
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
      accessorKey: 'assigned_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assigned At" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('assigned_at') as string
        return date ? formatDateTime(date) : '—'
      },
    },
    {
      id: 'assigned_by',
      accessorFn: (row) => row.expand?.assigned_by?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assigned By" />
      ),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }) => row.getValue('notes') || '—',
    },
    ...(writable
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: { row: { original: ProjectAssignmentWithExpand } }) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReturningId(row.original.id)}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Return
              </Button>
            ),
          } as ColumnDef<ProjectAssignmentWithExpand>,
        ]
      : []),
  ]

  const historyColumns: ColumnDef<StockTransactionWithExpand>[] = [
    {
      accessorKey: 'created',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDateTime(row.getValue('created') as string),
    },
    {
      id: 'product',
      accessorFn: (row) => row.expand?.product?.name ?? row.product,
      header: 'Product',
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => getLabel(TRANSACTION_TYPES, row.original.type),
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
    },
  ]

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    )
  }

  const assignments = assignmentsData?.items ?? []
  const inStockProducts = productsData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          writable ? (
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Product
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{project.expand?.customer?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <StatusBadge status={project.status} type="project" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p className="font-medium">
              {project.start_date ? formatDate(project.start_date) : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">End Date</p>
            <p className="font-medium">
              {project.end_date ? formatDate(project.end_date) : '—'}
            </p>
          </div>
          {project.description && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-muted-foreground">Description</p>
              <p>{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Assigned Products</h2>
        {assignments.length === 0 && !assignmentsLoading ? (
          <EmptyState
            icon={Package}
            title="No products assigned"
            description="Assign in-stock products to this project."
            action={
              writable ? (
                <Button onClick={() => setAssignOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Assign Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={assignmentColumns}
            data={assignments}
            isLoading={assignmentsLoading}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Project History</h2>
        <DataTable
          columns={historyColumns}
          data={historyItems}
          isLoading={historyLoading}
        />
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Product</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAssign)} className="space-y-4">
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product (in stock)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        form.setValue('serialId', '')
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inStockProducts.map((product: Product) => (
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
              {selectedProduct?.track_serials && (
                <FormField
                  control={form.control}
                  name="serialId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select available serial" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(availableSerialsData?.items ?? []).map((serial) => (
                            <SelectItem key={serial.id} value={serial.id}>
                              {serial.serial}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(returningId)}
        onOpenChange={(open) => !open && setReturningId(null)}
        title="Return Product"
        description="Return this product from the project back to inventory?"
        confirmLabel="Return"
        onConfirm={handleReturn}
        loading={isSubmitting}
      />
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { FolderKanban, Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatDate } from '@/lib/utils'
import { createRecord, updateRecord } from '@/services/crud'
import { projectSchema, type ProjectFormValues } from '@/schemas'
import type { Customer, ProjectWithExpand } from '@/types'
import { PROJECT_STATUSES } from '@/utils/constants'

export default function ProjectsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectWithExpand | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const writable = canWrite()

  const filter = statusFilter !== 'all' ? `status = "${statusFilter}"` : undefined

  const listOptions = useMemo(
    () => ({
      perPage: 100,
      sort: '-updated',
      expand: 'customer',
      filter,
    }),
    [filter],
  )

  const { data, isLoading, refetch } = useTypedCollectionQuery('projects', listOptions)
  const { data: customersData } = useTypedCollectionQuery('customers', {
    perPage: 200,
    sort: 'name',
  })

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      customer: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'active',
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.reset({
      name: '',
      customer: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'active',
    })
    setDialogOpen(true)
  }

  const openEdit = (project: ProjectWithExpand) => {
    setEditing(project)
    form.reset({
      name: project.name,
      customer: project.customer ?? '',
      description: project.description ?? '',
      start_date: project.start_date?.slice(0, 10) ?? '',
      end_date: project.end_date?.slice(0, 10) ?? '',
      status: project.status,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...values,
        customer: values.customer || '',
        description: values.description ?? '',
        start_date: values.start_date || '',
        end_date: values.end_date || '',
      }
      if (editing) {
        await updateRecord(COLLECTIONS.PROJECTS, editing.id, payload)
        toast.success('Project updated')
      } else {
        await createRecord(COLLECTIONS.PROJECTS, payload)
        toast.success('Project created')
      }
      setDialogOpen(false)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save project')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<ProjectWithExpand>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/projects/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue('name')}
        </Link>
      ),
    },
    {
      id: 'customer',
      accessorFn: (row) => row.expand?.customer?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} type="project" />
      ),
    },
    {
      accessorKey: 'start_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Start Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('start_date') as string
        return date ? formatDate(date) : '—'
      },
    },
    {
      accessorKey: 'end_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="End Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('end_date') as string
        return date ? formatDate(date) : '—'
      },
    },
    ...(writable
      ? [
          {
            id: 'actions',
            cell: ({ row }: { row: { original: ProjectWithExpand } }) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(row.original)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${row.original.id}`}>View Details</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as ColumnDef<ProjectWithExpand>,
        ]
      : []),
  ]

  const items = data?.items ?? []
  const customers = customersData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track product assignments and project inventory."
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          ) : undefined
        }
      />

      {!isLoading && items.length === 0 && !filter ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to assign products and track usage."
          action={
            writable ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="name"
          searchPlaceholder="Search projects..."
          isLoading={isLoading}
          filterSlot={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value || '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {customers.map((customer: Customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
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
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
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
                        {PROJECT_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
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
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

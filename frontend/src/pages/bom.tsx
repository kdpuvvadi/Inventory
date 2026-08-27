import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
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
import { COLLECTIONS } from '@/lib/pocketbase'
import { bomSchema, type BomFormValues } from '@/schemas'
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from '@/services/crud'
import { approveBom } from '@/services/inventory'
import type { BomStatus, BomWithExpand } from '@/types'
import { BOM_STATUSES, getLabel } from '@/utils/constants'

const BOM_LIST_OPTIONS = { expand: 'project', sort: '-updated' }
const BOM_QUERY_KEY = collectionQueryKey(COLLECTIONS.BOMS, BOM_LIST_OPTIONS)

const BOM_STATUS_VARIANTS: Record<BomStatus, 'outline' | 'success' | 'secondary' | 'warning'> = {
  draft: 'outline',
  active: 'secondary',
  approved: 'success',
  archived: 'outline',
}

function BomStatusBadge({ status }: { status: BomStatus }) {
  return (
    <Badge variant={BOM_STATUS_VARIANTS[status]} className="capitalize">
      {getLabel(BOM_STATUSES, status)}
    </Badge>
  )
}

function toBomPayload(values: BomFormValues) {
  return {
    ...values,
    project: values.project || '',
  }
}

export default function BomPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const writable = canWrite()

  const [bomDialogOpen, setBomDialogOpen] = useState(false)
  const [editingBom, setEditingBom] = useState<BomWithExpand | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BomWithExpand | null>(null)

  useRealtimeCollection(COLLECTIONS.BOMS, BOM_QUERY_KEY)

  const { data: bomsData, isLoading: bomsLoading } = useTypedCollectionQuery(
    COLLECTIONS.BOMS,
    BOM_LIST_OPTIONS,
  )

  const { data: projectsData } = useTypedCollectionQuery(COLLECTIONS.PROJECTS, {
    sort: 'name',
    perPage: 500,
  })

  const bomForm = useForm<BomFormValues>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      name: '',
      version: '1.0',
      project: '',
      notes: '',
      status: 'draft',
    },
  })

  const saveBomMutation = useMutation({
    mutationFn: async (values: BomFormValues) => {
      const payload = toBomPayload(values)
      if (editingBom) {
        const shouldApprove =
          payload.status === 'approved' && editingBom.status !== 'approved'
        const saved = await updateRecord(COLLECTIONS.BOMS, editingBom.id, {
          ...payload,
          status: shouldApprove ? editingBom.status : payload.status,
        })
        if (shouldApprove) {
          return approveBom(editingBom.id)
        }
        return saved
      }
      return createRecord(COLLECTIONS.BOMS, {
        ...payload,
        status: payload.status === 'approved' ? 'draft' : payload.status,
      })
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.BOMS] })
      toast.success(editingBom ? 'BOM updated' : 'BOM created')
      closeBomDialog()
      if (!editingBom) {
        navigate(`/bom/${record.id}`)
      }
    },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Failed to save BOM'),
  })

  const deleteBomMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(COLLECTIONS.BOMS, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.BOMS] })
      toast.success('BOM deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete BOM'),
  })

  const openCreateBom = () => {
    setEditingBom(null)
    bomForm.reset({
      name: '',
      version: '1.0',
      project: '',
      notes: '',
      status: 'draft',
    })
    setBomDialogOpen(true)
  }

  const openEditBom = (bom: BomWithExpand) => {
    setEditingBom(bom)
    bomForm.reset({
      name: bom.name,
      version: bom.version,
      project: bom.project ?? '',
      notes: bom.notes ?? '',
      status: bom.status,
    })
    setBomDialogOpen(true)
  }

  const closeBomDialog = () => {
    setBomDialogOpen(false)
    setEditingBom(null)
  }

  const columns: ColumnDef<BomWithExpand>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <Link
          to={`/bom/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: 'version', header: 'Version' },
    {
      id: 'project',
      accessorFn: (row) => row.expand?.project?.name ?? '—',
      header: 'Project',
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <BomStatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/bom/${row.original.id}`}>Open</Link>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM"
        description="Create a BOM, add items, then approve it to assign them to the project."
        actions={
          writable && (
            <Button onClick={openCreateBom}>
              <Plus className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Bills of Materials</CardTitle>
          <CardDescription>Open a BOM to add components, export, or print</CardDescription>
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
              {editingBom
                ? 'Update BOM details. Items are managed on the BOM page.'
                : 'Create the BOM now. You can add items and quantities after it is created.'}
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
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project (optional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === 'none' ? '' : value)
                      }
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projectsData?.items.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
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
                          {BOM_STATUSES.filter(
                            (status) => editingBom || status.value !== 'approved',
                          ).map((status) => (
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
    </div>
  )
}

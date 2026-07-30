import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Briefcase, Package } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'

import { CompanyContactsPanel } from '@/components/company-contacts-panel'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatDate, formatDateTime } from '@/lib/utils'
import type {
  Customer,
  ProjectAssignmentWithExpand,
  ProjectWithExpand,
} from '@/types'

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  )
}

function buildProjectFilter(projectIds: string[]): string | undefined {
  if (projectIds.length === 0) return undefined
  return projectIds.map((pid) => `project = "${pid}"`).join(' || ')
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: customer, isLoading } = useRecord<Customer & RecordModel>(
    COLLECTIONS.CUSTOMERS,
    id,
  )

  const currentProjectsOptions = useMemo(
    () => ({
      filter: id
        ? `customer = "${id}" && (status = "active" || status = "on_hold")`
        : undefined,
      sort: '-start_date',
      perPage: 100,
    }),
    [id],
  )

  const pastProjectsOptions = useMemo(
    () => ({
      filter: id
        ? `customer = "${id}" && (status = "completed" || status = "cancelled")`
        : undefined,
      sort: '-end_date',
      perPage: 100,
    }),
    [id],
  )

  const { data: currentProjectsData, isLoading: currentProjectsLoading } =
    useTypedCollectionQuery('projects', currentProjectsOptions)

  const { data: pastProjectsData, isLoading: pastProjectsLoading } =
    useTypedCollectionQuery('projects', pastProjectsOptions)

  const allProjectIds = useMemo(() => {
    const current = currentProjectsData?.items ?? []
    const past = pastProjectsData?.items ?? []
    return [...current, ...past].map((p) => p.id)
  }, [currentProjectsData, pastProjectsData])

  const currentAssignmentsOptions = useMemo(() => {
    const projectFilter = buildProjectFilter(allProjectIds)
    return {
      filter: projectFilter
        ? `(${projectFilter}) && returned_at = ""`
        : 'id = ""',
      sort: '-assigned_at',
      perPage: 500,
      expand: 'product,project',
    }
  }, [allProjectIds])

  const pastAssignmentsOptions = useMemo(() => {
    const projectFilter = buildProjectFilter(allProjectIds)
    return {
      filter: projectFilter
        ? `(${projectFilter}) && returned_at != ""`
        : 'id = ""',
      sort: '-returned_at',
      perPage: 500,
      expand: 'product,project',
    }
  }, [allProjectIds])

  const { data: currentAssignmentsData, isLoading: currentAssignmentsLoading } =
    useTypedCollectionQuery('project_assignments', currentAssignmentsOptions)

  const { data: pastAssignmentsData, isLoading: pastAssignmentsLoading } =
    useTypedCollectionQuery('project_assignments', pastAssignmentsOptions)

  const projectColumns: ColumnDef<ProjectWithExpand>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/projects/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
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
  ]

  const currentAssignmentColumns: ColumnDef<ProjectAssignmentWithExpand>[] = [
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
      id: 'project',
      accessorFn: (row) => row.expand?.project?.name ?? row.project,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        const project = row.original.expand?.project
        if (!project) return row.original.project
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
      id: 'status',
      header: 'Status',
      cell: () => <Badge variant="success">Active</Badge>,
    },
  ]

  const pastAssignmentColumns: ColumnDef<ProjectAssignmentWithExpand>[] = [
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
      id: 'project',
      accessorFn: (row) => row.expand?.project?.name ?? row.project,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        const project = row.original.expand?.project
        if (!project) return row.original.project
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
      accessorKey: 'returned_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Returned At" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('returned_at') as string
        return date ? formatDateTime(date) : '—'
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => <Badge variant="secondary">Returned</Badge>,
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/customers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Link>
        </Button>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    )
  }

  const currentProjects = currentProjectsData?.items ?? []
  const pastProjects = pastProjectsData?.items ?? []
  const currentAssignments = currentAssignmentsData?.items ?? []
  const pastAssignments = pastAssignmentsData?.items ?? []
  const projectsLoading = currentProjectsLoading || pastProjectsLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        breadcrumbs={[
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/customers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>Legacy primary contact summary</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Contact Person" value={customer.contact_person} />
            <DetailField label="Email" value={customer.email} />
            <DetailField label="Phone" value={customer.phone} />
            <DetailField label="Address" value={customer.address} />
            <DetailField label="Notes" value={customer.notes} />
          </dl>
        </CardContent>
      </Card>

      <CompanyContactsPanel entityType="customer" entityId={id!} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Current Projects</h2>
        {currentProjects.length === 0 && !currentProjectsLoading ? (
          <EmptyState
            icon={Briefcase}
            title="No active projects"
            description="This customer has no active or on-hold projects."
          />
        ) : (
          <DataTable
            columns={projectColumns}
            data={currentProjects}
            isLoading={currentProjectsLoading}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Past Projects</h2>
        {pastProjects.length === 0 && !pastProjectsLoading ? (
          <EmptyState
            icon={Briefcase}
            title="No past projects"
            description="This customer has no completed or cancelled projects."
          />
        ) : (
          <DataTable
            columns={projectColumns}
            data={pastProjects}
            isLoading={pastProjectsLoading}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Currently Assigned Products</h2>
        {currentAssignments.length === 0 &&
        !currentAssignmentsLoading &&
        !projectsLoading ? (
          <EmptyState
            icon={Package}
            title="No assigned products"
            description="No products are currently assigned to this customer's projects."
          />
        ) : (
          <DataTable
            columns={currentAssignmentColumns}
            data={currentAssignments}
            isLoading={currentAssignmentsLoading}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Previously Assigned / Returned Products</h2>
        {pastAssignments.length === 0 &&
        !pastAssignmentsLoading &&
        !projectsLoading ? (
          <EmptyState
            icon={Package}
            title="No returned products"
            description="No products have been returned from this customer's projects."
          />
        ) : (
          <DataTable
            columns={pastAssignmentColumns}
            data={pastAssignments}
            isLoading={pastAssignmentsLoading}
          />
        )}
      </div>
    </div>
  )
}

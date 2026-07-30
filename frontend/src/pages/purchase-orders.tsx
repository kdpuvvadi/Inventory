import { type ColumnDef } from '@tanstack/react-table'
import { FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import type { PurchaseOrderWithExpand } from '@/types'
import { PO_STATUSES } from '@/utils/constants'

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const writable = canWrite()

  const filter = statusFilter !== 'all' ? `status = "${statusFilter}"` : undefined

  const listOptions = useMemo(
    () => ({
      perPage: 100,
      sort: '-purchase_date',
      expand: 'supplier',
      filter,
    }),
    [filter],
  )

  const { data, isLoading } = useTypedCollectionQuery('purchase_orders', listOptions)

  const columns: ColumnDef<PurchaseOrderWithExpand>[] = [
    {
      accessorKey: 'po_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="PO Number" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/purchase-orders/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue('po_number')}
        </Link>
      ),
    },
    {
      id: 'supplier',
      accessorFn: (row) => row.expand?.supplier?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Supplier" />
      ),
    },
    {
      accessorKey: 'purchase_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Purchase Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('purchase_date') as string
        return date ? formatDate(date) : '—'
      },
    },
    {
      accessorKey: 'expected_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Expected Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('expected_date') as string
        return date ? formatDate(date) : '—'
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} type="purchase_order" />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/purchase-orders/${row.original.id}`}>View</Link>
        </Button>
      ),
    },
  ]

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Manage procurement and receiving."
        actions={
          writable ? (
            <Button asChild>
              <Link to="/purchase-orders/new">
                <Plus className="mr-2 h-4 w-4" />
                New Purchase Order
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!isLoading && items.length === 0 && !filter ? (
        <EmptyState
          icon={FileText}
          title="No purchase orders"
          description="Create a purchase order to track procurement."
          action={
            writable ? (
              <Button asChild>
                <Link to="/purchase-orders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Purchase Order
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="po_number"
          searchPlaceholder="Search PO number..."
          isLoading={isLoading}
          filterSlot={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PO_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}
    </div>
  )
}

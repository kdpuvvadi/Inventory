import { type ColumnDef } from '@tanstack/react-table'
import { FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

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
import { useSettings } from '@/contexts/settings-context'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SalesDocumentWithExpand } from '@/types'
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  getLabel,
} from '@/utils/constants'
import { resolveDocumentCurrency } from '@/utils/documents'

export default function DocumentsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const writable = canWrite()
  const { settings, currency: settingsCurrency } = useSettings()

  const filter = useMemo(() => {
    const parts: string[] = []
    if (typeFilter !== 'all') parts.push(`type = "${typeFilter}"`)
    if (statusFilter !== 'all') parts.push(`status = "${statusFilter}"`)
    return parts.length > 0 ? parts.join(' && ') : undefined
  }, [typeFilter, statusFilter])

  const listOptions = useMemo(
    () => ({
      perPage: 100,
      sort: '-issue_date,-created',
      expand: 'customer',
      filter,
    }),
    [filter],
  )

  const { data, isLoading } = useTypedCollectionQuery('documents', listOptions)

  const columns: ColumnDef<SalesDocumentWithExpand>[] = [
    {
      accessorKey: 'document_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Number" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/documents/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue('document_number')}
        </Link>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => getLabel(DOCUMENT_TYPES, row.original.type),
    },
    {
      id: 'customer',
      accessorFn: (row) => row.expand?.customer?.name ?? '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
    },
    {
      accessorKey: 'issue_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Issue Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('issue_date') as string
        return date ? formatDate(date) : '—'
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => {
        const code = resolveDocumentCurrency(
          row.original.currency,
          settings,
          settingsCurrency,
        )
        return formatCurrency(Number(row.original.total) || 0, code)
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} type="document" />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const editable =
          writable &&
          row.original.status !== 'cancelled' &&
          row.original.status !== 'converted'
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/documents/${row.original.id}`}>View</Link>
            </Button>
            {editable && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/documents/${row.original.id}/edit`}>Edit</Link>
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Create quotations, invoices, and proforma invoices."
        actions={
          writable ? (
            <Button asChild>
              <Link to="/documents/new">
                <Plus className="mr-2 h-4 w-4" />
                New Document
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOCUMENT_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {DOCUMENT_STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Create a quotation, invoice, or proforma invoice to get started."
          action={
            writable ? (
              <Button asChild>
                <Link to="/documents/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Document
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={items} isLoading={isLoading} />
      )}
    </div>
  )
}

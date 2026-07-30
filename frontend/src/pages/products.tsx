import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import type { ProductWithExpand } from '@/types'
import { PRODUCT_STATUSES } from '@/utils/constants'

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export default function ProductsPage() {
  const writeAccess = canWrite()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const searchQuery = searchParams.get('q') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const categoryFilter = searchParams.get('category') ?? ''
  const debouncedSearch = useDebounce(searchQuery, 300)

  const listOptions = useMemo(() => {
    const filterParts: string[] = []
    if (statusFilter) {
      filterParts.push(`status = "${statusFilter}"`)
    }
    if (categoryFilter) {
      filterParts.push(`category = "${categoryFilter}"`)
    }
    if (debouncedSearch) {
      const term = escapeFilterValue(debouncedSearch)
      filterParts.push(
        `(name ~ "${term}" || asset_tag ~ "${term}" || sku ~ "${term}")`,
      )
    }
    return {
      sort: '-created',
      perPage: 100,
      expand: 'manufacturer,supplier,category',
      filter: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
    }
  }, [statusFilter, categoryFilter, debouncedSearch])

  const queryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.PRODUCTS, listOptions),
    [listOptions],
  )

  const { data, isLoading } = useTypedCollectionQuery('products', listOptions)
  useRealtimeCollection(COLLECTIONS.PRODUCTS, queryKey)

  const { data: categories } = useTypedCollectionQuery('categories', {
    sort: 'name',
    perPage: 200,
  })

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        return next
      })
    },
    [setSearchParams],
  )

  const columns = useMemo<ColumnDef<ProductWithExpand>[]>(() => {
    const cols: ColumnDef<ProductWithExpand>[] = [
      {
        accessorKey: 'asset_tag',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Asset Tag" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/products/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.asset_tag}
          </Link>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/products/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'sku',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="SKU" />
        ),
        cell: ({ row }) =>
          row.original.sku ? (
            <Link
              to={`/products/${row.original.id}`}
              className="text-primary hover:underline"
            >
              {row.original.sku}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} type="product" />
        ),
      },
      {
        id: 'manufacturer',
        accessorFn: (row) => row.expand?.manufacturer?.name ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Manufacturer" />
        ),
        cell: ({ row }) => row.original.expand?.manufacturer?.name || '—',
      },
      {
        id: 'category',
        accessorFn: (row) => row.expand?.category?.name ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => row.original.expand?.category?.name || '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link
                to={`/products/${row.original.id}`}
                aria-label="View product"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {writeAccess && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  navigate(`/products/${row.original.id}?edit=1`)
                }
                aria-label="Edit product"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    ]

    return cols
  }, [writeAccess, navigate])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse and manage inventory products."
        actions={
          writeAccess ? (
            <Button asChild>
              <Link to="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={(data?.items ?? []) as ProductWithExpand[]}
        isLoading={isLoading}
        filterSlot={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(event) => updateParam('q', event.target.value)}
              className="max-w-sm"
            />
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) =>
                updateParam('status', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PRODUCT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter || 'all'}
              onValueChange={(value) =>
                updateParam('category', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories?.items ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  )
}

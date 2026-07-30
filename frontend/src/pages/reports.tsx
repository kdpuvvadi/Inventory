import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRealtimeCollection } from '@/hooks/use-collection'
import { useFormatMoney } from '@/contexts/settings-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { formatDate } from '@/lib/utils'
import type {
  InventoryWithExpand,
  ProjectAssignmentWithExpand,
  PurchaseOrderItemWithExpand,
  PurchaseOrderWithExpand,
} from '@/types'

const REPORTS_QUERY_KEY = ['reports']

interface InventoryReportRow {
  id: string
  product: string
  sku: string
  warehouse: string
  quantity: number
  available: number
  reserved: number
  damaged: number
  unitCost: number
  valuation: number
}

interface SupplierPurchaseRow {
  supplier: string
  orderCount: number
  totalValue: number
}

interface ProjectInventoryRow {
  project: string
  product: string
  assignedAt: string
  notes: string
}

async function fetchReportData() {
  const [inventory, purchaseOrders, poItems, assignments] = await Promise.all([
    pb.collection(COLLECTIONS.INVENTORY).getFullList<InventoryWithExpand>({
      expand: 'product,warehouse',
      sort: 'product',
    }),
    pb.collection(COLLECTIONS.PURCHASE_ORDERS).getFullList<PurchaseOrderWithExpand>({
      expand: 'supplier',
      sort: '-created',
    }),
    pb.collection(COLLECTIONS.PURCHASE_ORDER_ITEMS).getFullList<PurchaseOrderItemWithExpand>({
      expand: 'product,purchase_order',
    }),
    pb.collection(COLLECTIONS.PROJECT_ASSIGNMENTS).getFullList<ProjectAssignmentWithExpand>({
      expand: 'project,product',
      sort: '-assigned_at',
    }),
  ])

  return { inventory, purchaseOrders, poItems, assignments }
}

export default function ReportsPage() {
  const formatMoney = useFormatMoney()
  useRealtimeCollection(COLLECTIONS.INVENTORY, REPORTS_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.PURCHASE_ORDERS, REPORTS_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.PROJECT_ASSIGNMENTS, REPORTS_QUERY_KEY)

  const { data, isLoading } = useQuery({
    queryKey: REPORTS_QUERY_KEY,
    queryFn: fetchReportData,
  })

  const currentInventory = useMemo<InventoryReportRow[]>(() => {
    if (!data) return []
    return data.inventory.map((inv) => {
      const unitCost = inv.expand?.product?.unit_cost ?? 0
      return {
        id: inv.id,
        product: inv.expand?.product?.name ?? inv.product,
        sku: inv.expand?.product?.sku ?? '—',
        warehouse: inv.expand?.warehouse?.name ?? inv.warehouse,
        quantity: inv.quantity,
        available: inv.available,
        reserved: inv.reserved,
        damaged: inv.damaged,
        unitCost,
        valuation: inv.quantity * unitCost,
      }
    })
  }, [data])

  const lowStock = useMemo(() => {
    if (!data) return []
    return data.inventory
      .filter((inv) => inv.available > 0 && inv.available <= inv.reorder_level)
      .map((inv) => {
        const unitCost = inv.expand?.product?.unit_cost ?? 0
        return {
          id: inv.id,
          product: inv.expand?.product?.name ?? inv.product,
          sku: inv.expand?.product?.sku ?? '—',
          warehouse: inv.expand?.warehouse?.name ?? inv.warehouse,
          quantity: inv.quantity,
          available: inv.available,
          reserved: inv.reserved,
          damaged: inv.damaged,
          unitCost,
          valuation: inv.quantity * unitCost,
        }
      })
  }, [data])

  const damagedStock = useMemo(
    () => currentInventory.filter((row) => row.damaged > 0),
    [currentInventory],
  )

  const valuationTotal = useMemo(
    () => currentInventory.reduce((sum, row) => sum + row.valuation, 0),
    [currentInventory],
  )

  const purchasesBySupplier = useMemo<SupplierPurchaseRow[]>(() => {
    if (!data) return []
    const supplierMap = new Map<string, { orderCount: number; totalValue: number }>()

    for (const po of data.purchaseOrders) {
      const supplierName = po.expand?.supplier?.name ?? 'Unknown'
      const existing = supplierMap.get(supplierName) ?? { orderCount: 0, totalValue: 0 }
      existing.orderCount += 1

      const items = data.poItems.filter((item) => item.purchase_order === po.id)
      for (const item of items) {
        existing.totalValue += item.quantity * item.unit_cost
      }
      supplierMap.set(supplierName, existing)
    }

    return Array.from(supplierMap.entries())
      .map(([supplier, stats]) => ({ supplier, ...stats }))
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [data])

  const outstandingPOs = useMemo(() => {
    if (!data) return []
    return data.purchaseOrders.filter(
      (po) => po.status === 'ordered' || po.status === 'partially_received',
    )
  }, [data])

  const projectInventory = useMemo<ProjectInventoryRow[]>(() => {
    if (!data) return []
    return data.assignments
      .filter((a) => !a.returned_at)
      .map((a) => ({
        project: a.expand?.project?.name ?? a.project,
        product: a.expand?.product?.name ?? a.product,
        assignedAt: a.assigned_at,
        notes: a.notes || '—',
      }))
  }, [data])

  const returnedMaterials = useMemo<ProjectInventoryRow[]>(() => {
    if (!data) return []
    return data.assignments
      .filter((a) => Boolean(a.returned_at))
      .map((a) => ({
        project: a.expand?.project?.name ?? a.project,
        product: a.expand?.product?.name ?? a.product,
        assignedAt: a.returned_at,
        notes: a.notes || '—',
      }))
  }, [data])

  const inventoryColumns: ColumnDef<InventoryReportRow>[] = [
    {
      accessorKey: 'product',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    },
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'warehouse', header: 'Warehouse' },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" />,
    },
    { accessorKey: 'available', header: 'Available' },
    { accessorKey: 'reserved', header: 'Reserved' },
    { accessorKey: 'damaged', header: 'Damaged' },
    {
      accessorKey: 'unitCost',
      header: 'Unit Cost',
      cell: ({ row }) => formatMoney(row.original.unitCost),
    },
    {
      accessorKey: 'valuation',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valuation" />,
      cell: ({ row }) => formatMoney(row.original.valuation),
    },
  ]

  const supplierColumns: ColumnDef<SupplierPurchaseRow>[] = [
    {
      accessorKey: 'supplier',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
    },
    { accessorKey: 'orderCount', header: 'Orders' },
    {
      accessorKey: 'totalValue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total Value" />,
      cell: ({ row }) => formatMoney(row.original.totalValue),
    },
  ]

  const poColumns: ColumnDef<PurchaseOrderWithExpand>[] = [
    { accessorKey: 'po_number', header: 'PO Number' },
    {
      id: 'supplier',
      accessorFn: (row) => row.expand?.supplier?.name ?? row.supplier,
      header: 'Supplier',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'purchase_date',
      header: 'Purchase Date',
      cell: ({ row }) => formatDate(row.original.purchase_date),
    },
    {
      accessorKey: 'expected_date',
      header: 'Expected',
      cell: ({ row }) =>
        row.original.expected_date ? formatDate(row.original.expected_date) : '—',
    },
  ]

  const projectColumns: ColumnDef<ProjectInventoryRow>[] = [
    {
      accessorKey: 'project',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
    },
    { accessorKey: 'product', header: 'Product' },
    {
      accessorKey: 'assignedAt',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.assignedAt),
    },
    { accessorKey: 'notes', header: 'Notes' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Inventory, purchase, and project reporting with export support."
      />

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Tabs defaultValue="current">
            <TabsList>
              <TabsTrigger value="current">Current Inventory</TabsTrigger>
              <TabsTrigger value="low">Low Stock</TabsTrigger>
              <TabsTrigger value="damaged">Damaged</TabsTrigger>
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Inventory</CardTitle>
                  <CardDescription>All inventory records with valuation</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={inventoryColumns}
                    data={currentInventory}
                    searchKey="product"
                    searchPlaceholder="Search products..."
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="low" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Low Stock Items</CardTitle>
                  <CardDescription>Items at or below reorder level</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={inventoryColumns}
                    data={lowStock}
                    searchKey="product"
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="damaged" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Damaged Stock</CardTitle>
                  <CardDescription>Items with damaged quantities</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={inventoryColumns}
                    data={damagedStock}
                    searchKey="product"
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="valuation" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Valuation</CardTitle>
                  <CardDescription>
                    Total valuation:{' '}
                    <span className="font-semibold text-foreground">
                      {formatMoney(valuationTotal)}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={inventoryColumns}
                    data={[...currentInventory].sort((a, b) => b.valuation - a.valuation)}
                    searchKey="product"
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchases by Supplier</CardTitle>
              <CardDescription>Aggregated purchase order values</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={supplierColumns}
                data={purchasesBySupplier}
                searchKey="supplier"
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outstanding Purchase Orders</CardTitle>
              <CardDescription>Orders awaiting full receipt</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={poColumns}
                data={outstandingPOs}
                searchKey="po_number"
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory by Project</CardTitle>
              <CardDescription>Active material assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={projectColumns}
                data={projectInventory}
                searchKey="project"
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Returned Materials</CardTitle>
              <CardDescription>Materials returned from projects</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={projectColumns}
                data={returnedMaterials}
                searchKey="project"
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

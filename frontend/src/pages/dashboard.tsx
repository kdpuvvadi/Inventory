import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  Box,
  DollarSign,
  Factory,
  Package,
  PackageCheck,
  PackageX,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeCollection } from '@/hooks/use-collection'
import { useFormatMoney } from '@/contexts/settings-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { formatDateTime } from '@/lib/utils'
import { getDashboardStats } from '@/services/dashboard'
import type {
  Category,
  Inventory,
  Manufacturer,
  Product,
  StockTransactionWithExpand,
} from '@/types'
import { getLabel, TRANSACTION_TYPES } from '@/utils/constants'

const DASHBOARD_QUERY_KEY = ['dashboard-stats']
const CHART_COLORS = [
  'hsl(221.2 83.2% 53.3%)',
  'hsl(212 95% 68%)',
  'hsl(216 92% 60%)',
  'hsl(210 98% 78%)',
  'hsl(199 89% 48%)',
  'hsl(204 94% 94%)',
]

interface InventoryTotals {
  available: number
  reserved: number
  damaged: number
}

interface DashboardChartData {
  stockMovement: { type: string; label: string; count: number }[]
  byCategory: { name: string; value: number }[]
  byManufacturer: { name: string; quantity: number }[]
  monthlyPurchases: { month: string; amount: number }[]
}

async function fetchInventoryTotals(): Promise<InventoryTotals> {
  const records = await pb.collection(COLLECTIONS.INVENTORY).getFullList<Inventory>({
    fields: 'available,reserved,damaged',
  })
  return records.reduce(
    (acc, item) => ({
      available: acc.available + (item.available ?? 0),
      reserved: acc.reserved + (item.reserved ?? 0),
      damaged: acc.damaged + (item.damaged ?? 0),
    }),
    { available: 0, reserved: 0, damaged: 0 },
  )
}

async function fetchRecentTransactions(): Promise<StockTransactionWithExpand[]> {
  return pb.collection(COLLECTIONS.STOCK_TRANSACTIONS).getList<StockTransactionWithExpand>(1, 10, {
    sort: '-created',
    expand: 'product,warehouse,user',
  }).then((r) => r.items)
}

async function fetchChartData(): Promise<DashboardChartData> {
  const [transactions, inventoryRecords, products, categories, manufacturers] =
    await Promise.all([
      pb.collection(COLLECTIONS.STOCK_TRANSACTIONS).getFullList({
        sort: '-created',
        fields: 'type,quantity,created,product',
      }),
      pb.collection(COLLECTIONS.INVENTORY).getFullList<Inventory>({
        fields: 'product,quantity,available',
      }),
      pb.collection(COLLECTIONS.PRODUCTS).getFullList<Product>({
        fields: 'id,category,manufacturer,unit_cost',
      }),
      pb.collection(COLLECTIONS.CATEGORIES).getFullList<Category>({
        fields: 'id,name',
      }),
      pb.collection(COLLECTIONS.MANUFACTURERS).getFullList<Manufacturer>({
        fields: 'id,name',
      }),
    ])

  const typeCounts = new Map<string, number>()
  for (const tx of transactions) {
    const type = tx.type as string
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }
  const stockMovement = Array.from(typeCounts.entries())
    .map(([type, count]) => ({
      type,
      label: getLabel(TRANSACTION_TYPES, type as (typeof TRANSACTION_TYPES)[number]['value']),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const manufacturerMap = new Map(manufacturers.map((m) => [m.id, m.name]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  const categoryTotals = new Map<string, number>()
  const manufacturerTotals = new Map<string, number>()

  for (const inv of inventoryRecords) {
    const product = productMap.get(inv.product)
    if (!product) continue

    const qty = inv.available ?? inv.quantity ?? 0

    const catName = product.category
      ? categoryMap.get(product.category) ?? 'Uncategorized'
      : 'Uncategorized'
    categoryTotals.set(catName, (categoryTotals.get(catName) ?? 0) + qty)

    const mfgName = product.manufacturer
      ? manufacturerMap.get(product.manufacturer) ?? 'Unknown'
      : 'Unknown'
    manufacturerTotals.set(mfgName, (manufacturerTotals.get(mfgName) ?? 0) + qty)
  }

  const byCategory = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const byManufacturer = Array.from(manufacturerTotals.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)

  const monthBuckets = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    monthBuckets.set(format(monthStart, 'MMM yyyy'), 0)
  }

  for (const tx of transactions) {
    if (tx.type !== 'purchase') continue
    const monthKey = format(new Date(tx.created), 'MMM yyyy')
    if (!monthBuckets.has(monthKey)) continue
    const product = productMap.get(tx.product as string)
    const unitCost = product?.unit_cost ?? 0
    const amount = Math.abs(tx.quantity as number) * unitCost
    monthBuckets.set(monthKey, (monthBuckets.get(monthKey) ?? 0) + amount)
  }

  const monthlyPurchases = Array.from(monthBuckets.entries()).map(([month, amount]) => ({
    month,
    amount,
  }))

  return { stockMovement, byCategory, byManufacturer, monthlyPurchases }
}

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  description?: string
  variant?: 'default' | 'warning' | 'danger'
  loading?: boolean
}

function StatCard({
  title,
  value,
  icon,
  description,
  variant = 'default',
  loading,
}: StatCardProps) {
  const accentClass =
    variant === 'warning'
      ? 'border-amber-500/30 bg-amber-500/5'
      : variant === 'danger'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-border bg-card'

  return (
    <Card className={accentClass}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-[280px] w-full rounded-lg" />
}

const transactionColumns: ColumnDef<StockTransactionWithExpand>[] = [
  {
    accessorKey: 'created',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => formatDateTime(row.original.created),
  },
  {
    id: 'product',
    accessorFn: (row) => row.expand?.product?.name ?? row.product,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product" />
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {getLabel(TRANSACTION_TYPES, row.original.type)}
      </Badge>
    ),
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Qty" />
    ),
    cell: ({ row }) => {
      const qty = row.original.quantity
      return (
        <span className={qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {qty > 0 ? `+${qty}` : qty}
        </span>
      )
    },
  },
  {
    id: 'warehouse',
    accessorFn: (row) => row.expand?.warehouse?.name ?? row.warehouse,
    header: 'Warehouse',
  },
  {
    accessorKey: 'reason',
    header: 'Reason',
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block" title={row.original.reason}>
        {row.original.reason || '—'}
      </span>
    ),
  },
]

export default function DashboardPage() {
  const formatMoney = useFormatMoney()
  useRealtimeCollection(COLLECTIONS.INVENTORY, DASHBOARD_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.PRODUCTS, DASHBOARD_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.STOCK_TRANSACTIONS, DASHBOARD_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.PURCHASE_ORDERS, DASHBOARD_QUERY_KEY)
  useRealtimeCollection(COLLECTIONS.PROJECTS, DASHBOARD_QUERY_KEY)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getDashboardStats,
    refetchInterval: 60_000,
  })

  const { data: inventoryTotals, isLoading: totalsLoading } = useQuery({
    queryKey: ['dashboard-inventory-totals'],
    queryFn: fetchInventoryTotals,
    refetchInterval: 60_000,
  })

  const { data: recentTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['dashboard-recent-transactions'],
    queryFn: fetchRecentTransactions,
    refetchInterval: 60_000,
  })

  const { data: chartData, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: fetchChartData,
    refetchInterval: 60_000,
  })

  const loading = statsLoading || totalsLoading

  const statCards = useMemo(
    () => [
      {
        title: 'Total Products',
        value: stats?.totalProducts ?? 0,
        icon: <Package className="h-4 w-4" />,
      },
      {
        title: 'Inventory Value',
        value: formatMoney(stats?.totalInventoryValue ?? 0),
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        title: 'Available Stock',
        value: inventoryTotals?.available ?? 0,
        icon: <PackageCheck className="h-4 w-4" />,
      },
      {
        title: 'Reserved',
        value: inventoryTotals?.reserved ?? 0,
        icon: <Box className="h-4 w-4" />,
      },
      {
        title: 'Damaged',
        value: inventoryTotals?.damaged ?? 0,
        icon: <AlertTriangle className="h-4 w-4" />,
        variant: 'warning' as const,
      },
      {
        title: 'Low Stock',
        value: stats?.lowStockCount ?? 0,
        icon: <TrendingUp className="h-4 w-4" />,
        variant: 'warning' as const,
      },
      {
        title: 'Out of Stock',
        value: stats?.outOfStockCount ?? 0,
        icon: <PackageX className="h-4 w-4" />,
        variant: 'danger' as const,
      },
      {
        title: 'Active Projects',
        value: stats?.activeProjects ?? 0,
        icon: <Factory className="h-4 w-4" />,
      },
      {
        title: 'POs Awaiting Receipt',
        value: stats?.pendingPurchaseOrders ?? 0,
        icon: <ShoppingCart className="h-4 w-4" />,
      },
    ],
    [stats, inventoryTotals, formatMoney],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of inventory, stock levels, and recent activity."
        actions={
          <Badge variant="outline" className="gap-1">
            <Warehouse className="h-3 w-3" />
            {statsLoading ? '...' : `${stats?.totalWarehouses ?? 0} warehouses`}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            variant={card.variant}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock Movement</CardTitle>
            <CardDescription>Transaction counts by type</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <ChartSkeleton />
            ) : chartData?.stockMovement.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.stockMovement}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No transaction data available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>Available quantity distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <ChartSkeleton />
            ) : chartData?.byCategory.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartData.byCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {chartData.byCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No category data available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory by Manufacturer</CardTitle>
            <CardDescription>Top manufacturers by stock quantity</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <ChartSkeleton />
            ) : chartData?.byManufacturer.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.byManufacturer} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="quantity" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No manufacturer data available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Purchases</CardTitle>
            <CardDescription>Purchase value over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <ChartSkeleton />
            ) : chartData?.monthlyPurchases.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData.monthlyPurchases}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) =>
                      formatMoney(Number(v)).replace(/\.00$/, '')
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatMoney(Number(value ?? 0))
                    }
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[0], r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No purchase data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Last 10 stock movements</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={transactionColumns}
            data={recentTransactions}
            isLoading={txLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}

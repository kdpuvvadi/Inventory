import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type { DashboardStats, Inventory, Product } from '@/types'

function daysAgoIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().replace('T', ' ')
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const recentCutoff = daysAgoIso(7)

  const [
    productsResult,
    inventoryRecords,
    recentTransactionsResult,
    activeProjectsResult,
    pendingOrdersResult,
    warehousesResult,
  ] = await Promise.all([
    pb.collection(COLLECTIONS.PRODUCTS).getList(1, 1),
    pb.collection(COLLECTIONS.INVENTORY).getFullList<Inventory>({
      fields: 'quantity,available,reorder_level,product',
    }),
    pb.collection(COLLECTIONS.STOCK_TRANSACTIONS).getList(1, 1, {
      filter: `created >= "${recentCutoff}"`,
    }),
    pb.collection(COLLECTIONS.PROJECTS).getList(1, 1, {
      filter: 'status = "active"',
    }),
    pb.collection(COLLECTIONS.PURCHASE_ORDERS).getList(1, 1, {
      filter: 'status = "ordered" || status = "partially_received"',
    }),
    pb.collection(COLLECTIONS.WAREHOUSES).getList(1, 1),
  ])

  const productIds = [...new Set(inventoryRecords.map((item) => item.product).filter(Boolean))]
  const productCostMap = new Map<string, number>()

  if (productIds.length > 0) {
    const filter = productIds.map((id) => `id = "${id}"`).join(' || ')
    const products = await pb.collection(COLLECTIONS.PRODUCTS).getFullList<Product>({
      filter,
      fields: 'id,unit_cost',
    })
    for (const product of products) {
      productCostMap.set(product.id, product.unit_cost ?? 0)
    }
  }

  let totalInventoryValue = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  for (const item of inventoryRecords) {
    const unitCost = productCostMap.get(item.product) ?? 0
    totalInventoryValue += item.quantity * unitCost

    if (item.available <= 0) {
      outOfStockCount += 1
    } else if (item.available <= item.reorder_level) {
      lowStockCount += 1
    }
  }

  return {
    totalProducts: productsResult.totalItems,
    totalInventoryValue,
    lowStockCount,
    outOfStockCount,
    activeProjects: activeProjectsResult.totalItems,
    pendingPurchaseOrders: pendingOrdersResult.totalItems,
    recentTransactions: recentTransactionsResult.totalItems,
    totalWarehouses: warehousesResult.totalItems,
  }
}

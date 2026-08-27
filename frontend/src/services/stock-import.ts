import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { ingestOpeningStock } from '@/services/inventory'
import type {
  Category,
  Manufacturer,
  Product,
  Supplier,
  Warehouse,
} from '@/types'
import { generateAssetTag } from '@/utils/barcode'
import type { StockImportDraft } from '@/utils/stock-import'

export interface StockImportRowResult {
  rowNumber: number
  ok: boolean
  message: string
  productName?: string
}

function findByName<T extends { id: string; name: string }>(
  items: T[],
  value: string,
): T | undefined {
  const needle = value.trim().toLowerCase()
  if (!needle) return undefined
  return items.find((item) => item.name.trim().toLowerCase() === needle)
}

export async function importStockRows(
  rows: StockImportDraft[],
): Promise<StockImportRowResult[]> {
  const validRows = rows.filter((row) => row.errors.length === 0)
  const [
    products,
    warehouses,
    manufacturers,
    suppliers,
    categories,
  ] = await Promise.all([
    pb.collection(COLLECTIONS.PRODUCTS).getFullList<Product>({ sort: 'name' }),
    pb.collection(COLLECTIONS.WAREHOUSES).getFullList<Warehouse>({ sort: 'name' }),
    pb.collection(COLLECTIONS.MANUFACTURERS).getFullList<Manufacturer>({ sort: 'name' }),
    pb.collection(COLLECTIONS.SUPPLIERS).getFullList<Supplier>({ sort: 'name' }),
    pb.collection(COLLECTIONS.CATEGORIES).getFullList<Category>({ sort: 'name' }),
  ])

  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.is_default) ?? warehouses[0]

  const results: StockImportRowResult[] = []

  for (const row of validRows) {
    try {
      const warehouse = row.warehouse
        ? warehouses.find(
            (item) =>
              item.name.trim().toLowerCase() === row.warehouse.toLowerCase() ||
              item.code.trim().toLowerCase() === row.warehouse.toLowerCase(),
          )
        : defaultWarehouse

      if (!warehouse) {
        throw new Error('No warehouse found. Add a warehouse or set warehouse in the file.')
      }

      const skuKey = row.sku.toLowerCase()
      const assetKey = row.asset_tag.toLowerCase()
      let product = products.find((item) => {
        if (skuKey && item.sku?.trim().toLowerCase() === skuKey) return true
        if (assetKey && item.asset_tag?.trim().toLowerCase() === assetKey) return true
        return false
      })

      const manufacturer = findByName(manufacturers, row.manufacturer)
      const supplier = findByName(suppliers, row.supplier)
      const category = findByName(categories, row.category)

      const result = await ingestOpeningStock({
        productId: product?.id,
        product: product
          ? undefined
          : {
              name: row.name || row.sku || row.asset_tag,
              asset_tag: row.asset_tag || generateAssetTag(),
              sku: row.sku,
              manufacturer: manufacturer?.id ?? '',
              supplier: supplier?.id ?? '',
              category: category?.id ?? '',
              unit_of_measure: row.unit_of_measure,
              unit_cost: row.unit_cost ?? 0,
              status: 'in_stock',
              track_serials: row.track_serials,
            },
        warehouseId: warehouse.id,
        location: row.location,
        quantity: row.quantity ?? 0,
        unit_cost: row.unit_cost ?? undefined,
        min_stock: row.min_stock ?? undefined,
        max_stock: row.max_stock ?? undefined,
        reorder_level: row.reorder_level ?? undefined,
        reason: row.reason,
        remarks: row.remarks,
        track_serials: row.track_serials,
        serials: row.serials.length > 0 ? row.serials : undefined,
      })

      if (!product) {
        products.push(result.product)
        product = result.product
      }

      results.push({
        rowNumber: row.rowNumber,
        ok: true,
        message: `Imported ${row.quantity} into ${warehouse.name}`,
        productName: product.name,
      })
    } catch (error) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        message: error instanceof Error ? error.message : 'Import failed',
        productName: row.name || row.sku || row.asset_tag,
      })
    }
  }

  return results
}

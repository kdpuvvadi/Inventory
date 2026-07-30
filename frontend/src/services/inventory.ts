import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type {
  Inventory,
  Product,
  ProductStatus,
  ProjectAssignment,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  StockTransaction,
  TransactionType,
  Warehouse,
} from '@/types'
import { generateBarcodeValue } from '@/utils/barcode'

import { logAudit } from './audit'
import {
  createSerialsForIntake,
  markSerialsStatus,
  validateSerialCount,
} from './serials'

function getCurrentUserId(): string {
  const record = pb.authStore.record as { id?: string } | null
  return record?.id ?? ''
}

async function getDefaultWarehouse(): Promise<Warehouse> {
  const defaultWarehouses = await pb
    .collection(COLLECTIONS.WAREHOUSES)
    .getFullList<Warehouse>({
      filter: 'is_default = true',
      sort: '-created',
    })

  if (defaultWarehouses.length > 0) {
    return defaultWarehouses[0]
  }

  const fallback = await pb.collection(COLLECTIONS.WAREHOUSES).getList<Warehouse>(1, 1)
  if (fallback.items.length === 0) {
    throw new Error('No warehouse configured')
  }
  return fallback.items[0]
}

async function findInventory(
  productId: string,
  warehouseId: string,
): Promise<Inventory | null> {
  const records = await pb.collection(COLLECTIONS.INVENTORY).getFullList<Inventory>({
    filter: `product = "${productId}" && warehouse = "${warehouseId}"`,
  })
  return records[0] ?? null
}

function applyQuantityDelta(
  inventory: Inventory,
  quantityDelta: number,
  type: TransactionType,
): Pick<Inventory, 'quantity' | 'available' | 'reserved' | 'damaged'> {
  const quantity = inventory.quantity + quantityDelta
  let available = inventory.available
  let reserved = inventory.reserved
  let damaged = inventory.damaged

  switch (type) {
    case 'purchase':
    case 'return':
    case 'production':
    case 'adjustment':
    case 'transfer':
      available += quantityDelta
      break
    case 'sale':
    case 'consumption':
      available += quantityDelta
      break
    case 'scrap':
      available += quantityDelta
      if (quantityDelta < 0) {
        damaged += Math.abs(quantityDelta)
      }
      break
    case 'project_assignment':
      const assignQty = Math.abs(quantityDelta)
      reserved += assignQty
      available -= assignQty
      break
    case 'project_return':
      const returnQty = Math.abs(quantityDelta)
      reserved -= returnQty
      available += returnQty
      break
  }

  return { quantity, available, reserved, damaged }
}

export function productRequiresSerials(product: Product): boolean {
  return Boolean(product.track_serials)
}

function outboundSerialStatus(type: TransactionType): 'scrap' | 'sold' | 'damaged' {
  if (type === 'scrap') return 'scrap'
  if (type === 'sale') return 'sold'
  return 'damaged'
}

export interface AdjustStockParams {
  productId: string
  warehouseId: string
  quantityDelta: number
  type: TransactionType
  reason: string
  location?: string
  referenceDocument?: string
  remarks?: string
  serials?: string[]
  serialIds?: string[]
}

export async function adjustStock(params: AdjustStockParams): Promise<{
  inventory: Inventory
  transaction: StockTransaction
}> {
  const product = await pb.collection(COLLECTIONS.PRODUCTS).getOne<Product>(params.productId)
  const requiresSerials = productRequiresSerials(product)
  const absDelta = Math.abs(params.quantityDelta)

  if (params.quantityDelta > 0) {
    if (requiresSerials || params.serials) {
      if (!params.serials) {
        throw new Error('Serial numbers are required for this product')
      }
      validateSerialCount(params.serials, absDelta)
    }
  } else if (params.quantityDelta < 0) {
    if (requiresSerials) {
      if (!params.serialIds || params.serialIds.length === 0) {
        throw new Error(
          'Select available serial numbers equal to the quantity being removed',
        )
      }
      if (params.serialIds.length !== absDelta) {
        throw new Error(
          `Select exactly ${absDelta} serial number(s) for this adjustment`,
        )
      }
    }
  }

  const inventory = await findInventory(params.productId, params.warehouseId)
  if (!inventory) {
    throw new Error('Inventory record not found for product in warehouse')
  }

  const beforeQuantity = inventory.quantity
  const afterQuantity = beforeQuantity + params.quantityDelta
  const updatedFields = applyQuantityDelta(inventory, params.quantityDelta, params.type)

  const transaction = await pb.collection(COLLECTIONS.STOCK_TRANSACTIONS).create<StockTransaction>({
    product: params.productId,
    quantity: params.quantityDelta,
    before_quantity: beforeQuantity,
    after_quantity: afterQuantity,
    warehouse: params.warehouseId,
    location: params.location ?? inventory.location,
    type: params.type,
    reason: params.reason,
    reference_document: params.referenceDocument ?? '',
    remarks: params.remarks ?? '',
    user: getCurrentUserId(),
  })

  const updatedInventory = await pb.collection(COLLECTIONS.INVENTORY).update<Inventory>(
    inventory.id,
    {
      quantity: updatedFields.quantity,
      available: updatedFields.available,
      reserved: updatedFields.reserved,
      damaged: updatedFields.damaged,
      ...(params.location ? { location: params.location } : {}),
    },
  )

  await logAudit({
    action: 'stock_adjustment',
    collection: COLLECTIONS.INVENTORY,
    recordId: inventory.id,
    previousValue: {
      quantity: inventory.quantity,
      available: inventory.available,
      reserved: inventory.reserved,
      damaged: inventory.damaged,
    },
    newValue: {
      quantity: updatedInventory.quantity,
      available: updatedInventory.available,
      reserved: updatedInventory.reserved,
      damaged: updatedInventory.damaged,
    },
  })

  if (params.quantityDelta > 0 && (requiresSerials || params.serials)) {
    await createSerialsForIntake({
      productId: params.productId,
      warehouseId: params.warehouseId,
      serials: params.serials!,
      notes: params.remarks,
    })
  } else if (params.quantityDelta < 0 && requiresSerials && params.serialIds) {
    await markSerialsStatus(params.serialIds, outboundSerialStatus(params.type))
  }

  return { inventory: updatedInventory, transaction }
}

export interface AssignProductToProjectParams {
  projectId: string
  productId: string
  notes?: string
  serialId?: string
}

export async function assignProductToProject(
  params: AssignProductToProjectParams,
): Promise<{
  assignment: ProjectAssignment
  transaction: StockTransaction
}> {
  const product = await pb.collection(COLLECTIONS.PRODUCTS).getOne<Product>(params.productId)
  const warehouse = await getDefaultWarehouse()
  const inventory = await findInventory(params.productId, warehouse.id)

  if (!inventory || inventory.available < 1) {
    throw new Error('Product is not available for assignment')
  }

  if (productRequiresSerials(product)) {
    if (!params.serialId) {
      throw new Error('Select an available serial number for this product')
    }
    await markSerialsStatus([params.serialId], 'assigned', {
      project: params.projectId,
    })
  }

  const assignment = await pb
    .collection(COLLECTIONS.PROJECT_ASSIGNMENTS)
    .create<ProjectAssignment>({
      project: params.projectId,
      product: params.productId,
      assigned_at: new Date().toISOString(),
      assigned_by: getCurrentUserId(),
      notes: params.notes ?? '',
      returned_at: '',
    })

  const previousProduct = { ...product }
  const updatedProduct = await pb.collection(COLLECTIONS.PRODUCTS).update<Product>(product.id, {
    status: 'assigned',
  })

  const { transaction } = await adjustStock({
    productId: params.productId,
    warehouseId: warehouse.id,
    quantityDelta: -1,
    type: 'project_assignment',
    reason: 'Assigned to project',
    referenceDocument: assignment.id,
    remarks: params.notes,
  })

  await logAudit({
    action: 'project_assignment',
    collection: COLLECTIONS.PROJECT_ASSIGNMENTS,
    recordId: assignment.id,
    previousValue: { productStatus: previousProduct.status },
    newValue: { productStatus: updatedProduct.status, projectId: params.projectId },
  })

  return { assignment, transaction }
}

export async function returnProductFromProject(assignmentId: string): Promise<{
  assignment: ProjectAssignment
  transaction: StockTransaction
}> {
  const assignment = await pb
    .collection(COLLECTIONS.PROJECT_ASSIGNMENTS)
    .getOne<ProjectAssignment>(assignmentId)

  if (assignment.returned_at) {
    throw new Error('Product has already been returned from this assignment')
  }

  const product = await pb.collection(COLLECTIONS.PRODUCTS).getOne<Product>(assignment.product)
  const warehouse = await getDefaultWarehouse()

  const updatedAssignment = await pb
    .collection(COLLECTIONS.PROJECT_ASSIGNMENTS)
    .update<ProjectAssignment>(assignment.id, {
      returned_at: new Date().toISOString(),
    })

  const previousProduct = { ...product }
  const updatedProduct = await pb.collection(COLLECTIONS.PRODUCTS).update<Product>(product.id, {
    status: 'in_stock',
  })

  const { transaction } = await adjustStock({
    productId: assignment.product,
    warehouseId: warehouse.id,
    quantityDelta: 1,
    type: 'project_return',
    reason: 'Returned from project',
    referenceDocument: assignment.id,
  })

  await logAudit({
    action: 'project_return',
    collection: COLLECTIONS.PROJECT_ASSIGNMENTS,
    recordId: assignment.id,
    previousValue: { productStatus: previousProduct.status, returned_at: assignment.returned_at },
    newValue: {
      productStatus: updatedProduct.status,
      returned_at: updatedAssignment.returned_at,
    },
  })

  return { assignment: updatedAssignment, transaction }
}

export interface ReceivePurchaseOrderItem {
  itemId: string
  quantity: number
}

export interface ReceivePurchaseOrderParams {
  poId: string
  items: ReceivePurchaseOrderItem[]
}

export async function receivePurchaseOrder(params: ReceivePurchaseOrderParams): Promise<{
  purchaseOrder: PurchaseOrder
  receivedItems: PurchaseOrderItem[]
}> {
  const purchaseOrder = await pb
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .getOne<PurchaseOrder>(params.poId)

  if (purchaseOrder.status === 'cancelled' || purchaseOrder.status === 'received') {
    throw new Error('Purchase order cannot receive items in its current status')
  }

  const warehouse = await getDefaultWarehouse()
  const receivedItems: PurchaseOrderItem[] = []

  for (const { itemId, quantity } of params.items) {
    if (quantity <= 0) continue

    const item = await pb
      .collection(COLLECTIONS.PURCHASE_ORDER_ITEMS)
      .getOne<PurchaseOrderItem>(itemId)

    if (item.purchase_order !== params.poId) {
      throw new Error('Purchase order item does not belong to this purchase order')
    }

    const remaining = item.quantity - item.received_quantity
    if (quantity > remaining) {
      throw new Error(`Cannot receive more than remaining quantity for item ${itemId}`)
    }

    let inventory = await findInventory(item.product, warehouse.id)
    if (!inventory) {
      inventory = await pb.collection(COLLECTIONS.INVENTORY).create<Inventory>({
        product: item.product,
        warehouse: warehouse.id,
        location: '',
        quantity: 0,
        available: 0,
        reserved: 0,
        damaged: 0,
        min_stock: 0,
        max_stock: 0,
        reorder_level: 0,
      })
    }

    await adjustStock({
      productId: item.product,
      warehouseId: warehouse.id,
      quantityDelta: quantity,
      type: 'purchase',
      reason: 'Purchase order receipt',
      referenceDocument: params.poId,
    })

    const product = await pb.collection(COLLECTIONS.PRODUCTS).getOne<Product>(item.product)
    if (product.status !== 'in_stock') {
      await pb.collection(COLLECTIONS.PRODUCTS).update(item.product, { status: 'in_stock' })
    }

    const updatedItem = await pb
      .collection(COLLECTIONS.PURCHASE_ORDER_ITEMS)
      .update<PurchaseOrderItem>(item.id, {
        received_quantity: item.received_quantity + quantity,
      })

    receivedItems.push(updatedItem)
  }

  const allItems = await pb.collection(COLLECTIONS.PURCHASE_ORDER_ITEMS).getFullList<PurchaseOrderItem>({
    filter: `purchase_order = "${params.poId}"`,
  })

  let newStatus: PurchaseOrderStatus = purchaseOrder.status
  const allReceived = allItems.every((item) => item.received_quantity >= item.quantity)
  const anyReceived = allItems.some((item) => item.received_quantity > 0)

  if (allReceived) {
    newStatus = 'received'
  } else if (anyReceived) {
    newStatus = 'partially_received'
  }

  const updatedPo = await pb.collection(COLLECTIONS.PURCHASE_ORDERS).update<PurchaseOrder>(
    params.poId,
    { status: newStatus },
  )

  await logAudit({
    action: 'purchase_order_receive',
    collection: COLLECTIONS.PURCHASE_ORDERS,
    recordId: params.poId,
    previousValue: { status: purchaseOrder.status },
    newValue: { status: updatedPo.status, receivedItems: receivedItems.length },
  })

  return { purchaseOrder: updatedPo, receivedItems }
}

export interface IngestOpeningStockParams {
  productId?: string
  product?: Partial<Product> & { name: string; asset_tag: string; status?: ProductStatus }
  warehouseId: string
  location?: string
  quantity: number
  unit_cost?: number
  min_stock?: number
  max_stock?: number
  reorder_level?: number
  reason?: string
  remarks?: string
  track_serials?: boolean
  serials?: string[]
}

export async function createInventoryWithStock(params: {
  productId: string
  warehouseId: string
  quantity: number
  location?: string
  min_stock?: number
  max_stock?: number
  reorder_level?: number
  reason?: string
  remarks?: string
}): Promise<{ inventory: Inventory; transaction: StockTransaction }> {
  const result = await ingestOpeningStock(params)
  return { inventory: result.inventory, transaction: result.transaction }
}

export async function ingestOpeningStock(params: IngestOpeningStockParams): Promise<{
  product: Product
  inventory: Inventory
  transaction: StockTransaction
}> {
  if (params.quantity <= 0) {
    throw new Error('Quantity must be greater than zero')
  }

  if (!params.productId && !params.product) {
    throw new Error('Either productId or product must be provided')
  }

  const warehouseId = params.warehouseId || (await getDefaultWarehouse()).id

  let product: Product
  if (params.productId) {
    product = await pb.collection(COLLECTIONS.PRODUCTS).getOne<Product>(params.productId)
    const productUpdates: Partial<Product> = {}
    if (params.unit_cost !== undefined) {
      productUpdates.unit_cost = params.unit_cost
    }
    if (product.status !== 'in_stock') {
      productUpdates.status = 'in_stock'
    }
    if (Object.keys(productUpdates).length > 0) {
      product = await pb.collection(COLLECTIONS.PRODUCTS).update<Product>(
        product.id,
        productUpdates,
      )
    }
  } else {
    const productData = params.product!
    const assetTag = productData.asset_tag
    product = await pb.collection(COLLECTIONS.PRODUCTS).create<Product>({
      asset_tag: assetTag,
      name: productData.name,
      description: productData.description ?? '',
      model: productData.model ?? '',
      manufacturer: productData.manufacturer ?? '',
      supplier: productData.supplier ?? '',
      manufacturer_code: productData.manufacturer_code ?? '',
      sku: productData.sku ?? '',
      serial_number: productData.serial_number ?? '',
      lot_number: productData.lot_number ?? '',
      purchase_date: productData.purchase_date ?? '',
      received_date: productData.received_date ?? '',
      unit_of_measure: productData.unit_of_measure ?? 'each',
      barcode: productData.barcode ?? generateBarcodeValue(assetTag),
      qr_code: productData.qr_code ?? assetTag,
      category: productData.category ?? '',
      sub_category: productData.sub_category ?? '',
      tags: productData.tags ?? [],
      status: productData.status ?? 'in_stock',
      unit_cost: params.unit_cost ?? productData.unit_cost ?? 0,
      track_serials: params.track_serials ?? productData.track_serials ?? false,
    })

    await logAudit({
      action: 'create',
      collection: COLLECTIONS.PRODUCTS,
      recordId: product.id,
      newValue: product as unknown as Record<string, unknown>,
    })
  }

  let inventory = await findInventory(product.id, warehouseId)
  const isNewInventory = !inventory

  if (!inventory) {
    inventory = await pb.collection(COLLECTIONS.INVENTORY).create<Inventory>({
      product: product.id,
      warehouse: warehouseId,
      location: params.location ?? '',
      quantity: 0,
      available: 0,
      reserved: 0,
      damaged: 0,
      min_stock: params.min_stock ?? 0,
      max_stock: params.max_stock ?? 0,
      reorder_level: params.reorder_level ?? 0,
    })
  }

  const reason = params.reason ?? 'Opening stock intake'

  const requiresSerials = productRequiresSerials(product) || Boolean(params.serials)
  if (requiresSerials) {
    if (!params.serials) {
      throw new Error('Serial numbers are required for this product')
    }
    validateSerialCount(params.serials, params.quantity)
  }

  const { inventory: updatedInventory, transaction } = await adjustStock({
    productId: product.id,
    warehouseId,
    quantityDelta: params.quantity,
    type: 'adjustment',
    reason,
    location: params.location,
    referenceDocument: 'OPENING-STOCK',
    remarks: params.remarks,
    serials: params.serials,
  })

  await logAudit({
    action: 'opening_stock_intake',
    collection: COLLECTIONS.INVENTORY,
    recordId: updatedInventory.id,
    previousValue: isNewInventory ? null : { quantity: 0 },
    newValue: {
      productId: product.id,
      warehouseId,
      quantityAdded: params.quantity,
      transactionId: transaction.id,
    },
  })

  return { product, inventory: updatedInventory, transaction }
}

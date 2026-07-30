import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type { ProductSerial, SerialStatus } from '@/types'

export function parseSerialList(text: string): string[] {
  const parts = text.split(/[\n,]+/)
  const seen = new Set<string>()
  const result: string[] = []

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

export function validateSerialCount(serials: string[], quantity: number): void {
  if (serials.length !== quantity) {
    throw new Error(
      `Expected ${quantity} serial number(s), but ${serials.length} provided`,
    )
  }

  const seen = new Set<string>()
  for (const serial of serials) {
    const key = serial.toLowerCase()
    if (seen.has(key)) {
      throw new Error(`Duplicate serial number: ${serial}`)
    }
    seen.add(key)
  }
}

export async function createSerialsForIntake(params: {
  productId: string
  warehouseId: string
  serials: string[]
  notes?: string
}): Promise<ProductSerial[]> {
  const existing = await pb.collection(COLLECTIONS.PRODUCT_SERIALS).getFullList<ProductSerial>({
    filter: `product = "${params.productId}"`,
  })

  const existingSerials = new Set(existing.map((s) => s.serial.toLowerCase()))
  const duplicates = params.serials.filter((s) => existingSerials.has(s.toLowerCase()))
  if (duplicates.length > 0) {
    throw new Error(
      `Serial number(s) already exist for this product: ${duplicates.join(', ')}`,
    )
  }

  const receivedAt = new Date().toISOString()
  const created: ProductSerial[] = []

  for (const serial of params.serials) {
    const record = await pb.collection(COLLECTIONS.PRODUCT_SERIALS).create<ProductSerial>({
      product: params.productId,
      serial,
      warehouse: params.warehouseId,
      status: 'available',
      project: '',
      notes: params.notes ?? '',
      received_at: receivedAt,
    })
    created.push(record)
  }

  return created
}

export async function listProductSerials(productId: string): Promise<ProductSerial[]> {
  return pb.collection(COLLECTIONS.PRODUCT_SERIALS).getFullList<ProductSerial>({
    filter: `product = "${productId}"`,
    sort: '-created',
    expand: 'warehouse,project',
  })
}

export async function markSerialsStatus(
  serialIds: string[],
  status: SerialStatus,
  extra?: { project?: string },
): Promise<ProductSerial[]> {
  const updated: ProductSerial[] = []

  for (const id of serialIds) {
    const updates: Partial<ProductSerial> = { status }
    if (extra?.project !== undefined) {
      updates.project = extra.project
    }
    const record = await pb
      .collection(COLLECTIONS.PRODUCT_SERIALS)
      .update<ProductSerial>(id, updates)
    updated.push(record)
  }

  return updated
}

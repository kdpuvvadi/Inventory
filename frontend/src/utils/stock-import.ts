import * as XLSX from 'xlsx'

export const STOCK_IMPORT_COLUMNS = [
  'sku',
  'asset_tag',
  'name',
  'quantity',
  'warehouse',
  'location',
  'unit_of_measure',
  'unit_cost',
  'min_stock',
  'max_stock',
  'reorder_level',
  'manufacturer',
  'supplier',
  'category',
  'track_serials',
  'serials',
  'reason',
  'remarks',
] as const

export type StockImportColumn = (typeof STOCK_IMPORT_COLUMNS)[number]

export interface StockImportDraft {
  rowNumber: number
  sku: string
  asset_tag: string
  name: string
  quantity: number | null
  warehouse: string
  location: string
  unit_of_measure: string
  unit_cost: number | null
  min_stock: number | null
  max_stock: number | null
  reorder_level: number | null
  manufacturer: string
  supplier: string
  category: string
  track_serials: boolean
  serials: string[]
  reason: string
  remarks: string
  errors: string[]
}

const HEADER_ALIASES: Record<string, StockImportColumn> = {
  sku: 'sku',
  product_sku: 'sku',
  asset_tag: 'asset_tag',
  asset: 'asset_tag',
  assettag: 'asset_tag',
  name: 'name',
  product: 'name',
  product_name: 'name',
  quantity: 'quantity',
  qty: 'quantity',
  warehouse: 'warehouse',
  warehouse_name: 'warehouse',
  warehouse_code: 'warehouse',
  location: 'location',
  bin: 'location',
  unit_of_measure: 'unit_of_measure',
  uom: 'unit_of_measure',
  unit: 'unit_of_measure',
  unit_cost: 'unit_cost',
  cost: 'unit_cost',
  min_stock: 'min_stock',
  max_stock: 'max_stock',
  reorder_level: 'reorder_level',
  manufacturer: 'manufacturer',
  supplier: 'supplier',
  category: 'category',
  track_serials: 'track_serials',
  track_serial: 'track_serials',
  serials: 'serials',
  serial_numbers: 'serials',
  serial: 'serials',
  reason: 'reason',
  remarks: 'remarks',
  notes: 'remarks',
}

export const STOCK_IMPORT_SAMPLE_ROWS: Record<StockImportColumn, string>[] = [
  {
    sku: 'CAB-UTP-305',
    asset_tag: '',
    name: '',
    quantity: '50',
    warehouse: 'Main',
    location: 'Aisle A / Rack 1',
    unit_of_measure: 'box',
    unit_cost: '42.50',
    min_stock: '10',
    max_stock: '200',
    reorder_level: '20',
    manufacturer: '',
    supplier: '',
    category: '',
    track_serials: 'false',
    serials: '',
    reason: 'Opening stock',
    remarks: 'Existing product matched by SKU',
  },
  {
    sku: '',
    asset_tag: 'AST-20260827-0101',
    name: 'Network Switch 24-Port',
    quantity: '8',
    warehouse: 'Main',
    location: 'Cage 2',
    unit_of_measure: 'each',
    unit_cost: '185',
    min_stock: '2',
    max_stock: '40',
    reorder_level: '5',
    manufacturer: '',
    supplier: '',
    category: 'Networking',
    track_serials: 'false',
    serials: '',
    reason: 'Opening stock',
    remarks: 'Creates a new product if asset tag and SKU are new',
  },
  {
    sku: 'SW-CORE-01',
    asset_tag: '',
    name: 'Core Switch',
    quantity: '2',
    warehouse: 'Main',
    location: 'Rack 01',
    unit_of_measure: 'each',
    unit_cost: '2400',
    min_stock: '1',
    max_stock: '10',
    reorder_level: '2',
    manufacturer: '',
    supplier: '',
    category: '',
    track_serials: 'true',
    serials: 'SN-CORE-1001|SN-CORE-1002',
    reason: 'Opening stock',
    remarks: 'Serial-tracked: list serials separated by |',
  },
]

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function asString(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function asNumber(value: unknown): number | null {
  const text = asString(value)
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : NaN
}

function asBoolean(value: unknown): boolean {
  const text = asString(value).toLowerCase()
  return text === 'true' || text === 'yes' || text === 'y' || text === '1'
}

function parseSerials(value: unknown): string[] {
  const text = asString(value)
  if (!text) return []
  return text
    .split(/[|;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => asString(value) === '')
}

export function parseStockImportFile(data: ArrayBuffer): StockImportDraft[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  return rawRows
    .filter((row) => !isEmptyRow(row))
    .map((row, index) => {
      const mapped: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        const column = HEADER_ALIASES[normalizeHeader(key)]
        if (column) mapped[column] = value
      }

      const quantity = asNumber(mapped.quantity)
      const unitCost = asNumber(mapped.unit_cost)
      const minStock = asNumber(mapped.min_stock)
      const maxStock = asNumber(mapped.max_stock)
      const reorderLevel = asNumber(mapped.reorder_level)
      const sku = asString(mapped.sku)
      const assetTag = asString(mapped.asset_tag)
      const name = asString(mapped.name)
      const serials = parseSerials(mapped.serials)
      const trackSerials = asBoolean(mapped.track_serials) || serials.length > 0
      const errors: string[] = []

      if (!sku && !assetTag && !name) {
        errors.push('Provide sku, asset_tag, or name')
      }
      if (quantity == null) {
        errors.push('Quantity is required')
      } else if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push('Quantity must be a number greater than zero')
      }
      if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        errors.push('Unit cost must be a number 0 or greater')
      }
      for (const [label, value] of [
        ['min_stock', minStock],
        ['max_stock', maxStock],
        ['reorder_level', reorderLevel],
      ] as const) {
        if (value != null && (!Number.isFinite(value) || value < 0)) {
          errors.push(`${label} must be a number 0 or greater`)
        }
      }
      if (trackSerials && serials.length === 0) {
        errors.push('Serial-tracked rows need serials (separate with | )')
      }
      if (
        trackSerials &&
        quantity != null &&
        Number.isFinite(quantity) &&
        serials.length > 0 &&
        serials.length !== quantity
      ) {
        errors.push(`Expected ${quantity} serials, found ${serials.length}`)
      }

      return {
        rowNumber: index + 2,
        sku,
        asset_tag: assetTag,
        name,
        quantity: Number.isFinite(quantity) ? quantity : null,
        warehouse: asString(mapped.warehouse),
        location: asString(mapped.location),
        unit_of_measure: asString(mapped.unit_of_measure) || 'each',
        unit_cost: Number.isFinite(unitCost) ? unitCost : null,
        min_stock: Number.isFinite(minStock) ? minStock : null,
        max_stock: Number.isFinite(maxStock) ? maxStock : null,
        reorder_level: Number.isFinite(reorderLevel) ? reorderLevel : null,
        manufacturer: asString(mapped.manufacturer),
        supplier: asString(mapped.supplier),
        category: asString(mapped.category),
        track_serials: trackSerials,
        serials,
        reason: asString(mapped.reason) || 'Bulk stock import',
        remarks: asString(mapped.remarks),
        errors,
      }
    })
}

function sampleAoa(): (string | number)[][] {
  return [
    [...STOCK_IMPORT_COLUMNS],
    ...STOCK_IMPORT_SAMPLE_ROWS.map((row) =>
      STOCK_IMPORT_COLUMNS.map((column) => row[column]),
    ),
  ]
}

export function downloadStockImportSample(format: 'csv' | 'xlsx'): void {
  const sheet = XLSX.utils.aoa_to_sheet(sampleAoa())
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Stock Import')
  XLSX.writeFile(workbook, `stock-import-sample.${format}`)
}

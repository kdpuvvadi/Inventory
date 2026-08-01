import type { AppSettings, DocumentType } from '@/types'
import { normalizeCurrencyCode } from '@/lib/utils'
import { getLabel, DOCUMENT_TYPES } from '@/utils/constants'

export interface LineCalcInput {
  quantity: number
  unit_price: number
  discount_percent?: number
  tax_percent?: number
}

export interface LineCalcResult {
  gross: number
  discountAmount: number
  taxable: number
  taxAmount: number
  lineTotal: number
}

export interface DocumentTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export function calcLineTotals(item: LineCalcInput): LineCalcResult {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const discountPct = Number(item.discount_percent) || 0
  const taxPct = Number(item.tax_percent) || 0

  const gross = qty * price
  const discountAmount = (gross * discountPct) / 100
  const taxable = gross - discountAmount
  const taxAmount = (taxable * taxPct) / 100
  const lineTotal = taxable + taxAmount

  return { gross, discountAmount, taxable, taxAmount, lineTotal }
}

export function calcDocumentTotals(
  items: LineCalcInput[],
  documentDiscountPercent = 0,
): DocumentTotals {
  const lines = items.map(calcLineTotals)
  const subtotal = lines.reduce((sum, line) => sum + line.gross, 0)
  const lineDiscounts = lines.reduce((sum, line) => sum + line.discountAmount, 0)
  const afterLineDiscount = lines.reduce((sum, line) => sum + line.taxable, 0)
  const docDiscount = (afterLineDiscount * (Number(documentDiscountPercent) || 0)) / 100
  const taxable = afterLineDiscount - docDiscount
  const taxRatio =
    afterLineDiscount > 0
      ? lines.reduce((sum, line) => sum + line.taxAmount, 0) / afterLineDiscount
      : 0
  const taxAmount = taxable * taxRatio
  const total = taxable + taxAmount

  return {
    subtotal,
    discountAmount: lineDiscounts + docDiscount,
    taxAmount,
    total,
  }
}

export function getDocumentTypeLabel(type: DocumentType): string {
  return getLabel(DOCUMENT_TYPES, type)
}

export function getDocumentPrefix(
  type: DocumentType,
  settings: AppSettings | null | undefined,
): string {
  if (type === 'quotation') return settings?.quotation_prefix || 'QT-'
  if (type === 'invoice') return settings?.invoice_prefix || 'INV-'
  return settings?.proforma_prefix || 'PI-'
}

export function generateDocumentNumber(
  type: DocumentType,
  settings: AppSettings | null | undefined,
): string {
  const prefix = getDocumentPrefix(type, settings)
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const seq = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
  return `${prefix}${y}${m}${d}-${seq}`
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function getSiteDisplayName(settings: AppSettings | null | undefined): string {
  const site = settings?.site_name?.trim()
  if (site) return site
  const company = settings?.company_name?.trim()
  if (company) return company
  return 'Inventory'
}

export function resolveDocumentCurrency(
  documentCurrency: string | null | undefined,
  settings: AppSettings | null | undefined,
  fallback = 'USD',
): string {
  // App has a single selected currency in settings — prefer that for display.
  // Fall back to the document's stored currency for older records / overrides.
  const fromSettings = settings?.currency?.trim()
  if (fromSettings) return normalizeCurrencyCode(fromSettings)
  const fromDoc = documentCurrency?.trim()
  if (fromDoc) return normalizeCurrencyCode(fromDoc)
  return normalizeCurrencyCode(fallback)
}

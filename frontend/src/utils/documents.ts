import type { AppSettings, DocumentType, GstType } from '@/types'
import { normalizeCurrencyCode } from '@/lib/utils'
import { getLabel, DOCUMENT_TYPES } from '@/utils/constants'

export interface LineCalcInput {
  quantity: number
  unit_price: number
  discount_percent?: number
}

export interface LineCalcResult {
  gross: number
  discountAmount: number
  taxable: number
  lineTotal: number
}

export interface DocumentTotals {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  taxAmount: number
  total: number
}

export interface GstBreakdown {
  gstType: GstType
  cgst: number
  sgst: number
  igst: number
}

export function calcLineTotals(item: LineCalcInput): LineCalcResult {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const discountPct = Number(item.discount_percent) || 0

  const gross = qty * price
  const discountAmount = (gross * discountPct) / 100
  const taxable = gross - discountAmount
  // Line total is pre-tax; document-level tax is applied after all lines.
  const lineTotal = taxable

  return { gross, discountAmount, taxable, lineTotal }
}

export function calcDocumentTotals(
  items: LineCalcInput[],
  documentDiscountPercent = 0,
  documentTaxPercent = 0,
): DocumentTotals {
  const lines = items.map(calcLineTotals)
  // Subtotal is the sum of line amounts (after any per-line discounts).
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  // Totals "Discount" is document-level only; line discounts already reduce line amounts.
  const discountAmount =
    (subtotal * (Number(documentDiscountPercent) || 0)) / 100
  const taxableAmount = subtotal - discountAmount
  const taxAmount = (taxableAmount * (Number(documentTaxPercent) || 0)) / 100
  const total = taxableAmount + taxAmount

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    total,
  }
}

export function resolveGstType(
  companyState: string | null | undefined,
  billingState: string | null | undefined,
): GstType {
  const company = (companyState || '').trim().toLowerCase()
  const billing = (billingState || '').trim().toLowerCase()
  if (!company || !billing) return 'cgst_sgst'
  return company === billing ? 'cgst_sgst' : 'igst'
}

export function splitGstAmount(
  taxAmount: number,
  gstType: GstType | null | undefined,
): GstBreakdown {
  const amount = Number(taxAmount) || 0
  const type: GstType = gstType === 'igst' ? 'igst' : 'cgst_sgst'
  if (type === 'igst') {
    return { gstType: type, cgst: 0, sgst: 0, igst: amount }
  }
  const half = Math.round((amount / 2) * 100) / 100
  const cgst = half
  const sgst = Math.round((amount - half) * 100) / 100
  return { gstType: type, cgst, sgst, igst: 0 }
}

export function createShareToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
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

export function formatAddressBlock(options: {
  address?: string | null
  state?: string | null
  pincode?: string | null
}): string {
  const lines: string[] = []
  const street = stripHtml(options.address)
  if (street) lines.push(street)
  const stateLine = [options.state?.trim(), options.pincode?.trim()]
    .filter(Boolean)
    .join(' - ')
  if (stateLine) lines.push(stateLine)
  return lines.join('\n')
}

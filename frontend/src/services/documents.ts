import { logAudit } from '@/services/audit'
import type { AppSettings, DocumentItem, DocumentType, SalesDocument } from '@/types'
import { COLLECTIONS } from '@/lib/pocketbase'
import { createRecord, listRecords, updateRecord } from '@/services/crud'
import {
  generateDocumentNumber,
  getDocumentTypeLabel,
  createShareToken,
  resolveDocumentCurrency,
  resolveGstType,
} from '@/utils/documents'

const CONVERSION_MAP: Partial<Record<DocumentType, DocumentType>> = {
  quotation: 'proforma_invoice',
  proforma_invoice: 'invoice',
}

export function getConversionTarget(type: DocumentType): DocumentType | null {
  return CONVERSION_MAP[type] ?? null
}

export async function convertDocument(options: {
  source: SalesDocument
  settings: AppSettings | null
}): Promise<SalesDocument> {
  const { source, settings } = options
  const targetType = getConversionTarget(source.type)

  if (!targetType) {
    throw new Error('This document type cannot be converted further')
  }

  if (source.status === 'cancelled') {
    throw new Error('Cancelled documents cannot be converted')
  }

  if (source.status === 'converted' || source.converted_to) {
    throw new Error('This document has already been converted')
  }

  const itemsResult = await listRecords<DocumentItem>(COLLECTIONS.DOCUMENT_ITEMS, {
    perPage: 500,
    filter: `document = "${source.id}"`,
    sort: 'created',
  })

  const today = new Date().toISOString().slice(0, 10)
  const sourceLabel = getDocumentTypeLabel(source.type)
  const taxPercent =
    source.type === 'quotation'
      ? settings?.default_tax_rate || 18
      : source.tax_percent || 18

  let subtotal = source.subtotal || 0
  let discountAmount = source.discount_amount || 0
  let taxAmount = source.tax_amount || 0
  let total = source.total || 0
  if (source.type === 'quotation' && taxPercent > 0) {
    const taxable = subtotal - discountAmount
    taxAmount = (taxable * taxPercent) / 100
    total = taxable + taxAmount
  }

  const created = await createRecord<SalesDocument>(COLLECTIONS.DOCUMENTS, {
    document_number: generateDocumentNumber(targetType, settings),
    type: targetType,
    status: 'draft',
    customer: source.customer || '',
    issue_date: today,
    due_date: source.due_date || '',
    currency: resolveDocumentCurrency(source.currency, settings),
    discount_percent: source.discount_percent || 0,
    tax_percent: taxPercent,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,
    billing_address: source.billing_address || '',
    billing_state: source.billing_state || '',
    billing_pincode: source.billing_pincode || '',
    gst_type:
      resolveGstType(settings?.company_state, source.billing_state) ||
      source.gst_type ||
      'cgst_sgst',
    share_token: createShareToken(),
    reference: source.reference || source.document_number,
    notes: source.notes
      ? `${source.notes}\n\nConverted from ${sourceLabel} ${source.document_number}.`
      : `Converted from ${sourceLabel} ${source.document_number}.`,
    source_document: source.id,
    converted_to: '',
  })

  for (const item of itemsResult.items) {
    await createRecord(COLLECTIONS.DOCUMENT_ITEMS, {
      document: created.id,
      product: item.product || '',
      description: item.description,
      part_number: item.part_number || '',
      hsn_code: item.hsn_code || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent || 0,
      tax_percent: 0,
      line_total: item.line_total,
    })
  }

  const updatedSource = await updateRecord<SalesDocument>(
    COLLECTIONS.DOCUMENTS,
    source.id,
    {
      status: 'converted',
      converted_to: created.id,
    },
  )

  await logAudit({
    action: 'convert',
    collection: COLLECTIONS.DOCUMENTS,
    recordId: source.id,
    previousValue: source as unknown as Record<string, unknown>,
    newValue: updatedSource as unknown as Record<string, unknown>,
  })
  await logAudit({
    action: 'create',
    collection: COLLECTIONS.DOCUMENTS,
    recordId: created.id,
    newValue: {
      ...(created as unknown as Record<string, unknown>),
      converted_from: source.document_number,
    },
  })

  return created
}

export function conversionActionLabel(type: DocumentType): string | null {
  const target = getConversionTarget(type)
  if (!target) return null
  return `Convert to ${getDocumentTypeLabel(target)}`
}

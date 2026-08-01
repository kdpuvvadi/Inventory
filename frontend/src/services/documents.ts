import type { AppSettings, DocumentItem, DocumentType, SalesDocument } from '@/types'
import { COLLECTIONS } from '@/lib/pocketbase'
import { createRecord, listRecords, updateRecord } from '@/services/crud'
import {
  generateDocumentNumber,
  getDocumentTypeLabel,
  resolveDocumentCurrency,
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

  const created = await createRecord<SalesDocument>(COLLECTIONS.DOCUMENTS, {
    document_number: generateDocumentNumber(targetType, settings),
    type: targetType,
    status: 'draft',
    customer: source.customer || '',
    issue_date: today,
    due_date: source.due_date || '',
    currency: resolveDocumentCurrency(source.currency, settings),
    discount_percent: source.discount_percent || 0,
    tax_percent: source.tax_percent || 0,
    subtotal: source.subtotal || 0,
    discount_amount: source.discount_amount || 0,
    tax_amount: source.tax_amount || 0,
    total: source.total || 0,
    billing_address: source.billing_address || '',
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
      tax_percent: item.tax_percent || 0,
      line_total: item.line_total,
    })
  }

  await updateRecord(COLLECTIONS.DOCUMENTS, source.id, {
    status: 'converted',
    converted_to: created.id,
  })

  return created
}

export function conversionActionLabel(type: DocumentType): string | null {
  const target = getConversionTarget(type)
  if (!target) return null
  return `Convert to ${getDocumentTypeLabel(target)}`
}

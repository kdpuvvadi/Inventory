import { formatCurrency, formatDate } from '@/lib/utils'
import type {
  AppSettings,
  Customer,
  DocumentItem,
  SalesDocument,
} from '@/types'
import {
  formatAddressBlock,
  getDocumentTypeLabel,
  resolveDocumentCurrency,
  splitGstAmount,
  stripHtml,
} from '@/utils/documents'

export interface DocumentPrintPayload {
  document: SalesDocument
  items: DocumentItem[]
  customer?: Customer | null
  settings: AppSettings | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPrintHtml(payload: DocumentPrintPayload): string {
  const { document: doc, items, customer, settings } = payload
  const currency = resolveDocumentCurrency(doc.currency, settings)
  const companyName = settings?.company_name || 'Company'
  const typeLabel = getDocumentTypeLabel(doc.type)
  const isQuotation = doc.type === 'quotation'

  const showAddress =
    settings?.header_show_address !== false && Boolean(settings?.company_address)
  const showEmail =
    settings?.header_show_email !== false && Boolean(settings?.company_email)
  const showPhone =
    settings?.header_show_phone !== false && Boolean(settings?.company_phone)
  const showGst =
    settings?.header_show_gst !== false && Boolean(settings?.gst_number)

  const companyAddress = formatAddressBlock({
    address: settings?.company_address,
    state: settings?.company_state,
    pincode: settings?.company_pincode,
  })
  const billingText = formatAddressBlock({
    address: doc.billing_address || customer?.address,
    state: doc.billing_state || customer?.state,
    pincode: doc.billing_pincode || customer?.pincode,
  })
  const notesText = stripHtml(doc.notes)
  const gst = splitGstAmount(doc.tax_amount || 0, doc.gst_type)
  const taxable = (doc.subtotal || 0) - (doc.discount_amount || 0)
  const hasLineDiscount = items.some((item) => (item.discount_percent || 0) > 0)
  const hasDocDiscount = (Number(doc.discount_percent) || 0) > 0
  const colCount = hasLineDiscount ? 6 : 5

  const rows = items
    .map((item, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div>${escapeHtml(item.description)}</div>
            ${item.part_number ? `<div class="muted">Part: ${escapeHtml(item.part_number)}</div>` : ''}
            ${item.hsn_code ? `<div class="muted">HSN: ${escapeHtml(item.hsn_code)}</div>` : ''}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(item.unit_price, currency))}</td>
          ${hasLineDiscount ? `<td class="num">${item.discount_percent || 0}%</td>` : ''}
          <td class="num">${escapeHtml(formatCurrency(item.line_total, currency))}</td>
        </tr>
      `
    })
    .join('')

  const taxRows = isQuotation
    ? ''
    : `
      <tr>
        <td>Taxable</td>
        <td class="num">${escapeHtml(formatCurrency(taxable, currency))}</td>
      </tr>
      ${
        gst.gstType === 'igst'
          ? `<tr>
              <td>IGST (${doc.tax_percent || 0}%)</td>
              <td class="num">${escapeHtml(formatCurrency(gst.igst, currency))}</td>
            </tr>`
          : `<tr>
              <td>CGST (${(doc.tax_percent || 0) / 2}%)</td>
              <td class="num">${escapeHtml(formatCurrency(gst.cgst, currency))}</td>
            </tr>
            <tr>
              <td>SGST (${(doc.tax_percent || 0) / 2}%)</td>
              <td class="num">${escapeHtml(formatCurrency(gst.sgst, currency))}</td>
            </tr>`
      }`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`${typeLabel} ${doc.document_number}`)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 32px;
      font-size: 12px;
      background: #fff;
    }
    .sheet { max-width: 900px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand h1 { margin: 0 0 6px; font-size: 20px; }
    .muted { color: #555; }
    .meta { text-align: right; }
    .meta h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: 0.04em; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      vertical-align: top;
    }
    th {
      background: #f5f5f5;
      text-align: left;
      font-weight: 600;
    }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { width: 280px; margin-left: auto; }
    .totals td { border: none; padding: 6px 0; }
    .totals tr.grand td {
      border-top: 2px solid #111;
      font-weight: 700;
      font-size: 14px;
      padding-top: 10px;
    }
    .notes { margin-top: 24px; white-space: pre-wrap; }
    .disclaimer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px dashed #bbb;
      font-size: 11px;
      color: #666;
      text-align: center;
      font-style: italic;
    }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 0 16px;
      background: #fff;
      border-bottom: 1px solid #eee;
      margin-bottom: 16px;
    }
    .toolbar button {
      font: inherit;
      padding: 8px 14px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #111;
      color: #fff;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <h1>${escapeHtml(companyName)}</h1>
        ${showAddress ? `<div class="muted">${escapeHtml(companyAddress).replace(/\n/g, '<br/>')}</div>` : ''}
        ${showEmail ? `<div class="muted">${escapeHtml(settings?.company_email || '')}</div>` : ''}
        ${showPhone ? `<div class="muted">${escapeHtml(settings?.company_phone || '')}</div>` : ''}
        ${showGst ? `<div class="muted">GST: ${escapeHtml(settings?.gst_number || '')}</div>` : ''}
      </div>
      <div class="meta">
        <h2>${escapeHtml(typeLabel.toUpperCase())}</h2>
        <div><strong>#</strong> ${escapeHtml(doc.document_number)}</div>
        <div><strong>Date:</strong> ${doc.issue_date ? escapeHtml(formatDate(doc.issue_date)) : '—'}</div>
        ${doc.due_date ? `<div><strong>Due:</strong> ${escapeHtml(formatDate(doc.due_date))}</div>` : ''}
        ${doc.reference ? `<div><strong>Ref:</strong> ${escapeHtml(doc.reference)}</div>` : ''}
      </div>
    </div>

    <div class="grid">
      <div>
        <strong>Bill To</strong>
        <div>${escapeHtml(customer?.name || '—')}</div>
        ${customer?.contact_person ? `<div class="muted">${escapeHtml(customer.contact_person)}</div>` : ''}
        ${customer?.email ? `<div class="muted">${escapeHtml(customer.email)}</div>` : ''}
        ${customer?.phone ? `<div class="muted">${escapeHtml(customer.phone)}</div>` : ''}
        ${billingText ? `<div class="muted" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(billingText)}</div>` : ''}
      </div>
      <div>
        <strong>Summary</strong>
        <div>Status: ${escapeHtml(doc.status)}</div>
        <div>Currency: ${escapeHtml(currency)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit Price</th>
          ${hasLineDiscount ? '<th class="num">Disc %</th>' : ''}
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${colCount}">No items</td></tr>`}
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Subtotal</td>
        <td class="num">${escapeHtml(formatCurrency(doc.subtotal || 0, currency))}</td>
      </tr>
      ${
        hasDocDiscount
          ? `<tr>
        <td>Discount (${Number(doc.discount_percent) || 0}%)</td>
        <td class="num">${escapeHtml(formatCurrency(doc.discount_amount || 0, currency))}</td>
      </tr>`
          : ''
      }
      ${taxRows}
      <tr class="grand">
        <td>Total</td>
        <td class="num">${escapeHtml(formatCurrency(doc.total || 0, currency))}</td>
      </tr>
    </table>

    ${notesText ? `<div class="notes"><strong>Notes</strong><div>${escapeHtml(notesText)}</div></div>` : ''}

    <div class="disclaimer">
      This is a computer-generated document. Signature is not required.
    </div>
  </div>
</body>
</html>`
}

/** Open a print-ready document view (no PDF file is generated or stored). */
export function printDocument(payload: DocumentPrintPayload): void {
  const html = buildPrintHtml(payload)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const preview = window.open(url, '_blank')

  if (!preview) {
    URL.revokeObjectURL(url)
    throw new Error('Pop-up blocked. Allow pop-ups to print this document.')
  }

  const tryPrint = () => {
    try {
      preview.focus()
      preview.print()
    } catch {
      // User can still use the Print button in the opened tab.
    }
  }

  preview.addEventListener('load', () => {
    window.setTimeout(tryPrint, 250)
  })

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

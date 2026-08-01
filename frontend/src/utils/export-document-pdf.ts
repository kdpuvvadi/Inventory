import { formatCurrency, formatDate } from '@/lib/utils'
import type {
  AppSettings,
  Customer,
  DocumentItem,
  SalesDocument,
} from '@/types'
import {
  getDocumentTypeLabel,
  stripHtml,
  resolveDocumentCurrency,
} from '@/utils/documents'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface DocumentPdfPayload {
  document: SalesDocument
  items: DocumentItem[]
  customer?: Customer | null
  settings: AppSettings | null
  logoUrl?: string | null
}

function buildDocumentBody(payload: DocumentPdfPayload): string {
  const { document: doc, items, customer, settings, logoUrl } = payload
  const currency = resolveDocumentCurrency(doc.currency, settings)
  const companyName = settings?.company_name || 'Company'
  const typeLabel = getDocumentTypeLabel(doc.type)

  const showLogo = settings?.header_show_logo !== false && Boolean(logoUrl)
  const showAddress =
    settings?.header_show_address !== false && Boolean(settings?.company_address)
  const showEmail =
    settings?.header_show_email !== false && Boolean(settings?.company_email)
  const showPhone =
    settings?.header_show_phone !== false && Boolean(settings?.company_phone)
  const showGst =
    settings?.header_show_gst !== false && Boolean(settings?.gst_number)

  const addressText = stripHtml(settings?.company_address)
  const billingText = stripHtml(doc.billing_address) || customer?.address || ''
  const notesText = stripHtml(doc.notes)

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
          <td class="num">${item.discount_percent || 0}%</td>
          <td class="num">${item.tax_percent || 0}%</td>
          <td class="num">${escapeHtml(formatCurrency(item.line_total, currency))}</td>
        </tr>
      `
    })
    .join('')

  return `
  <div class="doc-sheet">
    <div class="header">
      <div class="brand">
        ${showLogo ? `<img src="${escapeHtml(logoUrl || '')}" alt="Logo" crossorigin="anonymous" />` : ''}
        <div>
          <h1>${escapeHtml(companyName)}</h1>
          ${showAddress ? `<div class="muted">${escapeHtml(addressText).replace(/\n/g, '<br/>')}</div>` : ''}
          ${showEmail ? `<div class="muted">${escapeHtml(settings?.company_email || '')}</div>` : ''}
          ${showPhone ? `<div class="muted">${escapeHtml(settings?.company_phone || '')}</div>` : ''}
          ${showGst ? `<div class="muted">GST: ${escapeHtml(settings?.gst_number || '')}</div>` : ''}
        </div>
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
        ${billingText ? `<div class="muted" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(billingText)}</div>` : ''}
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
          <th class="num">Disc %</th>
          <th class="num">Tax %</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7">No items</td></tr>'}
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Subtotal</td>
        <td class="num">${escapeHtml(formatCurrency(doc.subtotal || 0, currency))}</td>
      </tr>
      <tr>
        <td>Discount</td>
        <td class="num">${escapeHtml(formatCurrency(doc.discount_amount || 0, currency))}</td>
      </tr>
      <tr>
        <td>Tax</td>
        <td class="num">${escapeHtml(formatCurrency(doc.tax_amount || 0, currency))}</td>
      </tr>
      <tr class="grand">
        <td>Total</td>
        <td class="num">${escapeHtml(formatCurrency(doc.total || 0, currency))}</td>
      </tr>
    </table>

    ${notesText ? `<div class="notes"><strong>Notes</strong><div>${escapeHtml(notesText)}</div></div>` : ''}

    <div class="disclaimer">
      This is a computer-generated document. Signature is not required.
    </div>
  </div>`
}

const DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #111;
    margin: 0;
    padding: 24px;
    font-size: 12px;
    background: #fff;
  }
  .doc-sheet { max-width: 900px; margin: 0 auto; }
  .header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand { display: flex; gap: 12px; align-items: flex-start; }
  .brand img { height: 56px; max-width: 140px; object-fit: contain; }
  .brand h1 { margin: 0 0 4px; font-size: 20px; color: #111; }
  .muted { color: #555; }
  .meta { text-align: right; }
  .meta h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: 0.04em; color: #111; }
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
    padding: 8px;
    vertical-align: top;
    color: #111;
  }
  th {
    background: #f5f5f5;
    text-align: left;
    font-weight: 600;
  }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 4px 0; }
  .totals tr.grand td {
    border-top: 2px solid #111;
    font-weight: 700;
    font-size: 14px;
    padding-top: 8px;
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
`

function buildStandaloneHtml(payload: DocumentPdfPayload): string {
  const typeLabel = getDocumentTypeLabel(payload.document.type)
  const title = `${typeLabel} ${payload.document.document_number}`
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  ${buildDocumentBody(payload)}
</body>
</html>`
}

const PRINT_STYLE_ID = 'document-pdf-print-style'
const PRINT_ROOT_ID = 'document-pdf-print-root'

function ensurePrintStyles(): void {
  if (document.getElementById(PRINT_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = PRINT_STYLE_ID
  style.textContent = `
    #${PRINT_ROOT_ID} { display: none; }
    #${PRINT_ROOT_ID} .doc-sheet {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111;
      font-size: 12px;
      background: #fff;
    }
    #${PRINT_ROOT_ID} .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    #${PRINT_ROOT_ID} .brand { display: flex; gap: 12px; align-items: flex-start; }
    #${PRINT_ROOT_ID} .brand img { height: 56px; max-width: 140px; object-fit: contain; }
    #${PRINT_ROOT_ID} .brand h1 { margin: 0 0 4px; font-size: 20px; color: #111; }
    #${PRINT_ROOT_ID} .muted { color: #555; }
    #${PRINT_ROOT_ID} .meta { text-align: right; }
    #${PRINT_ROOT_ID} .meta h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: 0.04em; color: #111; }
    #${PRINT_ROOT_ID} .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    #${PRINT_ROOT_ID} table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    #${PRINT_ROOT_ID} th,
    #${PRINT_ROOT_ID} td {
      border: 1px solid #ddd;
      padding: 8px;
      vertical-align: top;
      color: #111;
    }
    #${PRINT_ROOT_ID} th {
      background: #f5f5f5;
      text-align: left;
      font-weight: 600;
    }
    #${PRINT_ROOT_ID} td.num,
    #${PRINT_ROOT_ID} th.num { text-align: right; white-space: nowrap; }
    #${PRINT_ROOT_ID} .totals { width: 280px; margin-left: auto; }
    #${PRINT_ROOT_ID} .totals td { border: none; padding: 4px 0; }
    #${PRINT_ROOT_ID} .totals tr.grand td {
      border-top: 2px solid #111;
      font-weight: 700;
      font-size: 14px;
      padding-top: 8px;
    }
    #${PRINT_ROOT_ID} .notes { margin-top: 24px; white-space: pre-wrap; }
    #${PRINT_ROOT_ID} .disclaimer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px dashed #bbb;
      font-size: 11px;
      color: #666;
      text-align: center;
      font-style: italic;
    }

    @media print {
      html, body {
        background: #fff !important;
        color: #111 !important;
        height: auto !important;
        overflow: visible !important;
      }
      body > *:not(#${PRINT_ROOT_ID}) {
        display: none !important;
      }
      #${PRINT_ROOT_ID} {
        display: block !important;
        position: static !important;
        width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #111 !important;
      }
    }
  `
  document.head.appendChild(style)
}

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  if (images.length === 0) return Promise.resolve()

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  ).then(() => undefined)
}

function openStandalonePreview(payload: DocumentPdfPayload): void {
  const html = buildStandaloneHtml(payload)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // Do not use noopener — that causes blank tabs and null window refs.
  const preview = window.open(url, '_blank')
  if (!preview) {
    const link = document.createElement('a')
    link.href = url
    link.download = `${payload.document.document_number || 'document'}.html`
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function exportDocumentPdf(payload: DocumentPdfPayload): Promise<void> {
  // Primary: open a self-contained preview tab with a Print button.
  // This avoids blank Chrome print dialogs from hidden iframes / noopener popups.
  openStandalonePreview(payload)

  // Secondary: also prepare same-page print styles for browsers that support it well.
  ensurePrintStyles()
  let root = document.getElementById(PRINT_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PRINT_ROOT_ID
    document.body.appendChild(root)
  }
  root.innerHTML = buildDocumentBody(payload)
  await waitForImages(root)
}

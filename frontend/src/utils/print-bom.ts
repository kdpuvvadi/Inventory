import { formatDate } from '@/lib/utils'
import type { AppSettings, BomItemWithExpand, BomWithExpand } from '@/types'
import { stripHtml } from '@/utils/documents'

export interface BomPrintPayload {
  bom: BomWithExpand
  items: BomItemWithExpand[]
  settings: AppSettings | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPrintHtml(payload: BomPrintPayload): string {
  const { bom, items, settings } = payload
  const companyName = settings?.company_name || 'Company'
  const notesText = stripHtml(bom.notes)

  const rows = items
    .map((item, index) => {
      const product = item.expand?.product
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div>${escapeHtml(product?.name || item.product)}</div>
            ${product?.sku ? `<div class="muted">SKU: ${escapeHtml(product.sku)}</div>` : ''}
            ${product?.asset_tag ? `<div class="muted">Asset: ${escapeHtml(product.asset_tag)}</div>` : ''}
          </td>
          <td class="num">${item.quantity}</td>
          <td>${escapeHtml(item.unit_of_measure || '—')}</td>
        </tr>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`BOM ${bom.name}`)}</title>
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
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <h1>${escapeHtml(companyName)}</h1>
      </div>
      <div class="meta">
        <h2>BILL OF MATERIALS</h2>
        <div><strong>Version:</strong> ${escapeHtml(bom.version || '—')}</div>
        <div><strong>Status:</strong> ${escapeHtml(bom.status)}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatDate(bom.updated || bom.created))}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <strong>BOM</strong>
        <div>${escapeHtml(bom.name)}</div>
      </div>
      <div>
        <strong>Project</strong>
        <div>${escapeHtml(bom.expand?.project?.name || '—')}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th class="num">Quantity</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4">No items</td></tr>`}
      </tbody>
    </table>

    ${notesText ? `<div class="notes"><strong>Notes</strong><div>${escapeHtml(notesText)}</div></div>` : ''}

    <div class="disclaimer">
      This is a computer-generated bill of materials. Use Print and choose Save as PDF.
    </div>
  </div>
</body>
</html>`
}

export function printBom(payload: BomPrintPayload): void {
  const html = buildPrintHtml(payload)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const preview = window.open(url, '_blank')

  if (!preview) {
    URL.revokeObjectURL(url)
    throw new Error('Pop-up blocked. Allow pop-ups to print this BOM.')
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

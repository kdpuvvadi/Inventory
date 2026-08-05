import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type { AuditLog } from '@/types'

export interface LogAuditParams {
  action: string
  collection: string
  recordId: string
  previousValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

export interface AuditChange {
  field: string
  from: string
  to: string
}

/** System / noise fields that should never appear in audit diffs. */
const AUDIT_IGNORE_KEYS = new Set([
  'id',
  'created',
  'updated',
  'collectionId',
  'collectionName',
  'expand',
])

const FIELD_LABELS: Record<string, string> = {
  document_number: 'Document number',
  type: 'Type',
  status: 'Status',
  customer: 'Customer',
  issue_date: 'Issue date',
  due_date: 'Due date',
  currency: 'Currency',
  discount_percent: 'Discount %',
  discount_amount: 'Discount amount',
  tax_percent: 'Tax %',
  tax_amount: 'Tax amount',
  subtotal: 'Subtotal',
  total: 'Total',
  billing_address: 'Billing address',
  billing_state: 'Billing state',
  billing_pincode: 'Billing pincode',
  gst_type: 'GST type',
  reference: 'Reference',
  notes: 'Notes',
  share_token: 'Share link',
  source_document: 'Source document',
  converted_to: 'Converted to',
  pdf_file: 'PDF file',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  state: 'State',
  pincode: 'Pincode',
}

function getCurrentUserId(): string {
  const record = pb.authStore.record as { id?: string } | null
  return record?.id ?? ''
}

function parseAuditRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return { value: parsed as unknown }
    } catch {
      return { value }
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return { value }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  // Treat numeric string / number equivalents as equal for display noise reduction.
  if (
    (typeof a === 'number' || typeof b === 'number') &&
    String(a) === String(b)
  ) {
    return true
  }
  return false
}

function formatScalar(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

function sanitizeRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (AUDIT_IGNORE_KEYS.has(key)) continue
    out[key] = entry
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Build only the changed fields between two audit snapshots. */
export function buildAuditDiff(
  previousValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null,
): {
  previousValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
} {
  const previous = sanitizeRecord(previousValue)
  const next = sanitizeRecord(newValue)

  if (!previous) {
    return { previousValue: null, newValue: next }
  }
  if (!next) {
    return { previousValue: previous, newValue: null }
  }

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  const prevOut: Record<string, unknown> = {}
  const nextOut: Record<string, unknown> = {}

  for (const key of keys) {
    if (AUDIT_IGNORE_KEYS.has(key)) continue
    const from = previous[key]
    const to = next[key]
    if (valuesEqual(from, to)) continue
    if (key in previous) prevOut[key] = from
    if (key in next) nextOut[key] = to
  }

  return {
    previousValue: Object.keys(prevOut).length > 0 ? prevOut : null,
    newValue: Object.keys(nextOut).length > 0 ? nextOut : null,
  }
}

/** Human-readable field changes for the audit trail UI. */
export function getAuditChanges(
  previousValue: unknown,
  newValue: unknown,
): AuditChange[] {
  const previous = parseAuditRecord(previousValue)
  const next = parseAuditRecord(newValue)

  if (!previous && !next) return []

  if (!previous && next) {
    return Object.entries(next)
      .filter(([key]) => !AUDIT_IGNORE_KEYS.has(key))
      .filter(([, value]) => value != null && value !== '')
      .slice(0, 8)
      .map(([key, value]) => ({
        field: fieldLabel(key),
        from: '—',
        to: formatScalar(value),
      }))
  }

  if (previous && !next) {
    return Object.entries(previous)
      .filter(([key]) => !AUDIT_IGNORE_KEYS.has(key))
      .map(([key, value]) => ({
        field: fieldLabel(key),
        from: formatScalar(value),
        to: '—',
      }))
  }

  const keys = new Set([
    ...Object.keys(previous ?? {}),
    ...Object.keys(next ?? {}),
  ])
  const changes: AuditChange[] = []

  for (const key of [...keys].sort()) {
    if (AUDIT_IGNORE_KEYS.has(key)) continue
    const from = previous?.[key]
    const to = next?.[key]
    if (valuesEqual(from, to)) continue
    changes.push({
      field: fieldLabel(key),
      from: formatScalar(from),
      to: formatScalar(to),
    })
  }

  return changes
}

/** @deprecated Prefer getAuditChanges for UI rendering. */
export function formatAuditValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export async function logAudit(params: LogAuditParams): Promise<AuditLog> {
  const { previousValue, newValue } = buildAuditDiff(
    params.previousValue,
    params.newValue,
  )

  return pb.collection(COLLECTIONS.AUDIT_LOGS).create<AuditLog>({
    user: getCurrentUserId() || undefined,
    action: params.action,
    collection_name: params.collection,
    record_id: params.recordId,
    previous_value: previousValue,
    new_value: newValue,
  })
}

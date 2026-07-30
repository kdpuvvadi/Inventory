import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type { AuditLog } from '@/types'

export interface LogAuditParams {
  action: string
  collection: string
  recordId: string
  previousValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

function getCurrentUserId(): string {
  const record = pb.authStore.record as { id?: string } | null
  return record?.id ?? ''
}

function serializeValue(value: Record<string, unknown> | null | undefined): string {
  if (!value) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function logAudit(params: LogAuditParams): Promise<AuditLog> {
  return pb.collection(COLLECTIONS.AUDIT_LOGS).create<AuditLog>({
    user: getCurrentUserId(),
    action: params.action,
    collection_name: params.collection,
    record_id: params.recordId,
    previous_value: serializeValue(params.previousValue),
    new_value: serializeValue(params.newValue),
  })
}

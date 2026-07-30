import type { UserRecord, UserRole } from '@/types'

import pb from './pocketbase'

const WRITE_ROLES: UserRole[] = [
  'administrator',
  'inventory_manager',
  'purchase',
  'sales',
  'store_keeper',
]

export function getCurrentUser(): UserRecord | null {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    return null
  }
  return pb.authStore.record as unknown as UserRecord
}

export function isAuthenticated(): boolean {
  return pb.authStore.isValid
}

export function hasRole(roles: UserRole[]): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return roles.includes(user.role)
}

export function canWrite(): boolean {
  return hasRole(WRITE_ROLES)
}

export function canManageUsers(): boolean {
  return hasRole(['administrator'])
}

export function logout(): void {
  pb.authStore.clear()
}

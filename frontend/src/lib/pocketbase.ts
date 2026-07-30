import PocketBase from 'pocketbase'

function resolvePocketBaseUrl(): string {
  const envUrl = import.meta.env.VITE_POCKETBASE_URL
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim()
  }
  // Same-origin (Docker/nginx proxy) or local PocketBase default
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://127.0.0.1:8090'
}

const pb = new PocketBase(resolvePocketBaseUrl())

pb.autoCancellation(false)

export default pb

export const COLLECTIONS = {
  USERS: 'users',
  MANUFACTURERS: 'manufacturers',
  SUPPLIERS: 'suppliers',
  CUSTOMERS: 'customers',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  WAREHOUSES: 'warehouses',
  INVENTORY: 'inventory',
  PROJECTS: 'projects',
  PROJECT_ASSIGNMENTS: 'project_assignments',
  PURCHASE_ORDERS: 'purchase_orders',
  PURCHASE_ORDER_ITEMS: 'purchase_order_items',
  STOCK_TRANSACTIONS: 'stock_transactions',
  AUDIT_LOGS: 'audit_logs',
  BOMS: 'boms',
  BOM_ITEMS: 'bom_items',
  APP_SETTINGS: 'app_settings',
  DEPARTMENTS: 'departments',
  CONTACTS: 'contacts',
  PRODUCT_SERIALS: 'product_serials',
} as const

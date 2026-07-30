export type UserRole =
  | 'administrator'
  | 'inventory_manager'
  | 'purchase'
  | 'sales'
  | 'store_keeper'
  | 'read_only'

export interface BaseRecord {
  id: string
  created: string
  updated: string
  collectionId: string
  collectionName: string
}

export interface UserRecord extends BaseRecord {
  email: string
  name: string
  role: UserRole
  avatar: string
}

export interface Manufacturer extends BaseRecord {
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  website: string
  notes: string
}

export interface Supplier extends BaseRecord {
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  website: string
  gst_vat_number: string
  payment_terms?: string
  notes: string
}

export interface Customer extends BaseRecord {
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  notes: string
}

export interface Department extends BaseRecord {
  name: string
  manufacturer?: string
  supplier?: string
  customer?: string
  notes: string
}

export interface Contact extends BaseRecord {
  department: string
  name: string
  title: string
  email: string
  phone: string
  mobile: string
  notes: string
  is_primary: boolean
}

export interface Category extends BaseRecord {
  name: string
  description: string
  parent?: string
}

export type ProductStatus =
  | 'in_stock'
  | 'reserved'
  | 'assigned'
  | 'installed'
  | 'damaged'
  | 'scrap'
  | 'sold'
  | 'returned'

export type SerialStatus =
  | 'available'
  | 'reserved'
  | 'assigned'
  | 'damaged'
  | 'scrap'
  | 'sold'
  | 'installed'
  | 'returned'

export interface Product extends BaseRecord {
  asset_tag: string
  name: string
  description: string
  model: string
  manufacturer: string
  supplier: string
  manufacturer_code: string
  sku: string
  serial_number: string
  lot_number: string
  purchase_date: string
  received_date: string
  unit_of_measure: string
  barcode: string
  qr_code: string
  category: string
  sub_category: string
  tags: string[]
  status: ProductStatus
  image: string
  manuals: string[]
  certificates: string[]
  unit_cost: number
  track_serials?: boolean
}

export interface ProductSerial extends BaseRecord {
  product: string
  serial: string
  warehouse: string
  status: SerialStatus
  project: string
  notes: string
  received_at: string
}

export interface ProductSerialWithExpand extends ProductSerial {
  expand?: { product?: Product; warehouse?: Warehouse; project?: Project }
}

export interface Warehouse extends BaseRecord {
  name: string
  code: string
  address: string
  is_default: boolean
}

export interface Inventory extends BaseRecord {
  product: string
  warehouse: string
  location: string
  quantity: number
  available: number
  reserved: number
  damaged: number
  min_stock: number
  max_stock: number
  reorder_level: number
}

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface Project extends BaseRecord {
  name: string
  customer: string
  description: string
  start_date: string
  end_date: string
  status: ProjectStatus
}

export interface ProjectAssignment extends BaseRecord {
  project: string
  product: string
  assigned_at: string
  assigned_by: string
  notes: string
  returned_at: string
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export interface PurchaseOrder extends BaseRecord {
  po_number: string
  supplier: string
  purchase_date: string
  expected_date: string
  status: PurchaseOrderStatus
  notes: string
}

export interface PurchaseOrderItem extends BaseRecord {
  purchase_order: string
  product: string
  description: string
  quantity: number
  received_quantity: number
  unit_cost: number
}

export type TransactionType =
  | 'purchase'
  | 'sale'
  | 'production'
  | 'consumption'
  | 'return'
  | 'adjustment'
  | 'scrap'
  | 'transfer'
  | 'project_assignment'
  | 'project_return'

export interface StockTransaction extends BaseRecord {
  product: string
  quantity: number
  before_quantity: number
  after_quantity: number
  warehouse: string
  location: string
  type: TransactionType
  reason: string
  reference_document: string
  remarks: string
  user: string
}

export interface AuditLog extends BaseRecord {
  user: string
  action: string
  collection_name: string
  record_id: string
  previous_value: string
  new_value: string
}

export type BomStatus = 'draft' | 'active' | 'archived'

export interface Bom extends BaseRecord {
  name: string
  finished_product: string
  version: string
  notes: string
  status: BomStatus
}

export interface BomItem extends BaseRecord {
  bom: string
  product: string
  quantity: number
  unit_of_measure: string
}

export interface AppSettings extends BaseRecord {
  company_name: string
  currency: string
  low_stock_threshold: number
  theme_default: 'light' | 'dark' | 'system'
}

export interface CategoryExpand {
  parent?: Category
}

export interface ProductExpand {
  manufacturer?: Manufacturer
  supplier?: Supplier
  category?: Category
  sub_category?: Category
}

export interface InventoryExpand {
  product?: Product
  warehouse?: Warehouse
}

export interface ProjectExpand {
  customer?: Customer
}

export interface ProjectAssignmentExpand {
  project?: Project
  product?: Product
  assigned_by?: UserRecord
}

export interface PurchaseOrderExpand {
  supplier?: Supplier
}

export interface PurchaseOrderItemExpand {
  purchase_order?: PurchaseOrder
  product?: Product
}

export interface StockTransactionExpand {
  product?: Product
  warehouse?: Warehouse
  user?: UserRecord
}

export interface AuditLogExpand {
  user?: UserRecord
}

export interface BomExpand {
  finished_product?: Product
}

export interface BomItemExpand {
  bom?: Bom
  product?: Product
}

export type CategoryWithExpand = Category & { expand?: CategoryExpand }
export type ProductWithExpand = Product & { expand?: ProductExpand }
export type InventoryWithExpand = Inventory & { expand?: InventoryExpand }
export type ProjectWithExpand = Project & { expand?: ProjectExpand }
export type ProjectAssignmentWithExpand = ProjectAssignment & {
  expand?: ProjectAssignmentExpand
}
export type PurchaseOrderWithExpand = PurchaseOrder & { expand?: PurchaseOrderExpand }
export type PurchaseOrderItemWithExpand = PurchaseOrderItem & {
  expand?: PurchaseOrderItemExpand
}
export type StockTransactionWithExpand = StockTransaction & {
  expand?: StockTransactionExpand
}
export type AuditLogWithExpand = AuditLog & { expand?: AuditLogExpand }
export type BomWithExpand = Bom & { expand?: BomExpand }
export type BomItemWithExpand = BomItem & { expand?: BomItemExpand }

export interface DepartmentWithExpand extends Department {
  expand?: { manufacturer?: Manufacturer; supplier?: Supplier; customer?: Customer }
}

export interface ContactWithExpand extends Contact {
  expand?: { department?: Department }
}

export interface DashboardStats {
  totalProducts: number
  totalInventoryValue: number
  lowStockCount: number
  outOfStockCount: number
  activeProjects: number
  pendingPurchaseOrders: number
  recentTransactions: number
  totalWarehouses: number
}

export interface PaginatedResult<T> {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: T[]
}

export type CollectionName =
  | 'users'
  | 'manufacturers'
  | 'suppliers'
  | 'customers'
  | 'categories'
  | 'products'
  | 'warehouses'
  | 'inventory'
  | 'projects'
  | 'project_assignments'
  | 'purchase_orders'
  | 'purchase_order_items'
  | 'stock_transactions'
  | 'audit_logs'
  | 'boms'
  | 'bom_items'
  | 'app_settings'
  | 'departments'
  | 'contacts'
  | 'product_serials'

export type CollectionRecordMap = {
  users: UserRecord
  manufacturers: Manufacturer
  suppliers: Supplier
  customers: Customer
  categories: Category
  products: Product
  warehouses: Warehouse
  inventory: Inventory
  projects: Project
  project_assignments: ProjectAssignment
  purchase_orders: PurchaseOrder
  purchase_order_items: PurchaseOrderItem
  stock_transactions: StockTransaction
  audit_logs: AuditLog
  boms: Bom
  bom_items: BomItem
  app_settings: AppSettings
  departments: Department
  contacts: Contact
  product_serials: ProductSerial
}

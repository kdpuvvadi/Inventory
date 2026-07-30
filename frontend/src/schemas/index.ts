import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const manufacturerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  gst_vat_number: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parent: z.string().optional(),
})

export const productSchema = z.object({
  asset_tag: z.string().min(1, 'Asset tag is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  manufacturer_code: z.string().optional(),
  sku: z.string().optional(),
  serial_number: z.string().optional(),
  lot_number: z.string().optional(),
  purchase_date: z.string().optional(),
  received_date: z.string().optional(),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  barcode: z.string().optional(),
  qr_code: z.string().optional(),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum([
    'in_stock',
    'reserved',
    'assigned',
    'installed',
    'damaged',
    'scrap',
    'sold',
    'returned',
  ]),
  unit_cost: z.coerce.number().min(0, 'Unit cost must be non-negative'),
  track_serials: z.boolean().optional(),
})

export const serialSchema = z.object({
  serial: z.string().min(1, 'Serial number is required'),
  notes: z.string().optional(),
  warehouse: z.string().optional(),
  status: z.enum([
    'available',
    'reserved',
    'assigned',
    'damaged',
    'scrap',
    'sold',
    'installed',
    'returned',
  ]),
})

export const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  is_default: z.boolean(),
})

export const inventorySchema = z.object({
  product: z.string().min(1, 'Product is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  location: z.string().optional(),
  min_stock: z.coerce.number().min(0, 'Minimum stock must be non-negative'),
  max_stock: z.coerce.number().min(0, 'Maximum stock must be non-negative').optional(),
  reorder_level: z.coerce.number().min(0, 'Reorder level must be non-negative'),
})

export const projectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  customer: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'cancelled']),
})

export const purchaseOrderSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  supplier: z.string().min(1, 'Supplier is required'),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  expected_date: z.string().optional(),
  status: z.enum(['draft', 'ordered', 'partially_received', 'received', 'cancelled']),
  notes: z.string().optional(),
})

export const purchaseOrderItemSchema = z.object({
  purchase_order: z.string().min(1, 'Purchase order is required'),
  product: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  received_quantity: z.coerce.number().min(0).default(0),
  unit_cost: z.coerce.number().min(0, 'Unit cost must be non-negative'),
})

export const transactionSchema = z.object({
  product: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().refine((val) => val !== 0, 'Quantity cannot be zero'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  location: z.string().optional(),
  type: z.enum([
    'purchase',
    'sale',
    'production',
    'consumption',
    'return',
    'adjustment',
    'scrap',
    'transfer',
    'project_assignment',
    'project_return',
  ]),
  reason: z.string().min(1, 'Reason is required'),
  reference_document: z.string().optional(),
  remarks: z.string().optional(),
})

export const bomSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  finished_product: z.string().min(1, 'Finished product is required'),
  version: z.string().min(1, 'Version is required'),
  notes: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']),
})

export const bomItemSchema = z.object({
  bom: z.string().min(1, 'BOM is required'),
  product: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than zero'),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
})

export const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum([
    'administrator',
    'inventory_manager',
    'purchase',
    'sales',
    'store_keeper',
    'read_only',
  ]),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  passwordConfirm: z.string().optional(),
}).refine(
  (data) => !data.password || data.password === data.passwordConfirm,
  { message: 'Passwords do not match', path: ['passwordConfirm'] },
)

export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  notes: z.string().optional(),
})

export const contactSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  name: z.string().min(1, 'Name is required'),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  notes: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const settingsSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  currency: z.string().min(1, 'Currency is required'),
  low_stock_threshold: z.coerce.number().min(0, 'Threshold must be non-negative'),
  theme_default: z.enum(['light', 'dark', 'system']),
})

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type ManufacturerFormValues = z.infer<typeof manufacturerSchema>
export type SupplierFormValues = z.infer<typeof supplierSchema>
export type CustomerFormValues = z.infer<typeof customerSchema>
export type CategoryFormValues = z.infer<typeof categorySchema>
export type ProductFormValues = z.infer<typeof productSchema>
export type WarehouseFormValues = z.infer<typeof warehouseSchema>
export type InventoryFormValues = z.infer<typeof inventorySchema>
export type ProjectFormValues = z.infer<typeof projectSchema>
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>
export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemSchema>
export type TransactionFormValues = z.infer<typeof transactionSchema>
export type BomFormValues = z.infer<typeof bomSchema>
export type BomItemFormValues = z.infer<typeof bomItemSchema>
export type UserFormValues = z.infer<typeof userSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
export type ProfileFormValues = z.infer<typeof profileSchema>
export type DepartmentFormValues = z.infer<typeof departmentSchema>
export type ContactFormValues = z.infer<typeof contactSchema>
export type SerialFormValues = z.infer<typeof serialSchema>

import type {
  ProductStatus,
  ProjectStatus,
  PurchaseOrderStatus,
  SerialStatus,
  TransactionType,
  UserRole,
} from '@/types'

export interface LabeledOption<T extends string = string> {
  value: T
  label: string
}

export const ROLE_LABELS: LabeledOption<UserRole>[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales', label: 'Sales' },
  { value: 'store_keeper', label: 'Store Keeper' },
  { value: 'read_only', label: 'Read Only' },
]

export const SERIAL_STATUSES: LabeledOption<SerialStatus>[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'sold', label: 'Sold' },
  { value: 'installed', label: 'Installed' },
  { value: 'returned', label: 'Returned' },
]

export const PRODUCT_STATUSES: LabeledOption<ProductStatus>[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'installed', label: 'Installed' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'sold', label: 'Sold' },
  { value: 'returned', label: 'Returned' },
]

export const TRANSACTION_TYPES: LabeledOption<TransactionType>[] = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'production', label: 'Production' },
  { value: 'consumption', label: 'Consumption' },
  { value: 'return', label: 'Return' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'project_assignment', label: 'Project Assignment' },
  { value: 'project_return', label: 'Project Return' },
]

export const PROJECT_STATUSES: LabeledOption<ProjectStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PO_STATUSES: LabeledOption<PurchaseOrderStatus>[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const DEPARTMENT_PRESETS: LabeledOption[] = [
  { value: 'Sales', label: 'Sales' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Support', label: 'Support' },
  { value: 'Purchasing', label: 'Purchasing' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Other', label: 'Other' },
]

export const UNIT_OF_MEASURES: LabeledOption[] = [
  { value: 'each', label: 'Each' },
  { value: 'box', label: 'Box' },
  { value: 'case', label: 'Case' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'm', label: 'Meter (m)' },
  { value: 'cm', label: 'Centimeter (cm)' },
  { value: 'ft', label: 'Foot (ft)' },
  { value: 'in', label: 'Inch (in)' },
  { value: 'l', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'gal', label: 'Gallon (gal)' },
  { value: 'set', label: 'Set' },
  { value: 'pair', label: 'Pair' },
  { value: 'roll', label: 'Roll' },
  { value: 'sheet', label: 'Sheet' },
]

export function getLabel<T extends string>(
  options: LabeledOption<T>[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

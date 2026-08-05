import type {
  DocumentStatus,
  DocumentType,
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

export const DOCUMENT_TYPES: LabeledOption<DocumentType>[] = [
  { value: 'quotation', label: 'Quotation' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'proforma_invoice', label: 'Proforma Invoice' },
]

export const DOCUMENT_STATUSES: LabeledOption<DocumentStatus>[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'converted', label: 'Converted' },
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

/** Indian states & UTs — used for GST (CGST/SGST vs IGST) address matching. */
export const INDIAN_STATES: LabeledOption[] = [
  { value: 'Andaman and Nicobar Islands', label: 'Andaman and Nicobar Islands' },
  { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
  { value: 'Arunachal Pradesh', label: 'Arunachal Pradesh' },
  { value: 'Assam', label: 'Assam' },
  { value: 'Bihar', label: 'Bihar' },
  { value: 'Chandigarh', label: 'Chandigarh' },
  { value: 'Chhattisgarh', label: 'Chhattisgarh' },
  { value: 'Dadra and Nagar Haveli and Daman and Diu', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'Delhi', label: 'Delhi' },
  { value: 'Goa', label: 'Goa' },
  { value: 'Gujarat', label: 'Gujarat' },
  { value: 'Haryana', label: 'Haryana' },
  { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
  { value: 'Jammu and Kashmir', label: 'Jammu and Kashmir' },
  { value: 'Jharkhand', label: 'Jharkhand' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Ladakh', label: 'Ladakh' },
  { value: 'Lakshadweep', label: 'Lakshadweep' },
  { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
  { value: 'Maharashtra', label: 'Maharashtra' },
  { value: 'Manipur', label: 'Manipur' },
  { value: 'Meghalaya', label: 'Meghalaya' },
  { value: 'Mizoram', label: 'Mizoram' },
  { value: 'Nagaland', label: 'Nagaland' },
  { value: 'Odisha', label: 'Odisha' },
  { value: 'Puducherry', label: 'Puducherry' },
  { value: 'Punjab', label: 'Punjab' },
  { value: 'Rajasthan', label: 'Rajasthan' },
  { value: 'Sikkim', label: 'Sikkim' },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Telangana', label: 'Telangana' },
  { value: 'Tripura', label: 'Tripura' },
  { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
  { value: 'Uttarakhand', label: 'Uttarakhand' },
  { value: 'West Bengal', label: 'West Bengal' },
]

export function getLabel<T extends string>(
  options: LabeledOption<T>[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

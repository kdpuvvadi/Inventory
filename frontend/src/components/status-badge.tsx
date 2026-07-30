import { Badge, type BadgeProps } from '@/components/ui/badge'
import {
  PO_STATUSES,
  PRODUCT_STATUSES,
  PROJECT_STATUSES,
  getLabel,
} from '@/utils/constants'
import type {
  ProductStatus,
  ProjectStatus,
  PurchaseOrderStatus,
} from '@/types'

type StatusType = 'product' | 'project' | 'purchase_order'

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: ProductStatus | ProjectStatus | PurchaseOrderStatus
  type: StatusType
}

const PRODUCT_VARIANTS: Record<ProductStatus, BadgeProps['variant']> = {
  in_stock: 'success',
  reserved: 'warning',
  assigned: 'secondary',
  installed: 'default',
  damaged: 'destructive',
  scrap: 'destructive',
  sold: 'outline',
  returned: 'secondary',
}

const PROJECT_VARIANTS: Record<ProjectStatus, BadgeProps['variant']> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'secondary',
  cancelled: 'destructive',
}

const PO_VARIANTS: Record<PurchaseOrderStatus, BadgeProps['variant']> = {
  draft: 'outline',
  ordered: 'default',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

function getStatusLabel(type: StatusType, status: string): string {
  switch (type) {
    case 'product':
      return getLabel(PRODUCT_STATUSES, status as ProductStatus)
    case 'project':
      return getLabel(PROJECT_STATUSES, status as ProjectStatus)
    case 'purchase_order':
      return getLabel(PO_STATUSES, status as PurchaseOrderStatus)
    default:
      return status
  }
}

function getVariant(type: StatusType, status: string): BadgeProps['variant'] {
  switch (type) {
    case 'product':
      return PRODUCT_VARIANTS[status as ProductStatus] ?? 'outline'
    case 'project':
      return PROJECT_VARIANTS[status as ProjectStatus] ?? 'outline'
    case 'purchase_order':
      return PO_VARIANTS[status as PurchaseOrderStatus] ?? 'outline'
    default:
      return 'outline'
  }
}

export function StatusBadge({ status, type, className, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={getVariant(type, status)} className={className} {...props}>
      {getStatusLabel(type, status)}
    </Badge>
  )
}

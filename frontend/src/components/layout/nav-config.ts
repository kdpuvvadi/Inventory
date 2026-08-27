import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  Factory,
  FileText,
  FolderKanban,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'

import type { UserRole } from '@/types'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  roles?: UserRole[]
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { title: 'Products', href: '/products', icon: Package },
      { title: 'Categories', href: '/categories', icon: FolderTree },
      { title: 'Manufacturers', href: '/manufacturers', icon: Factory },
      { title: 'Suppliers', href: '/suppliers', icon: Truck },
      { title: 'Customers', href: '/customers', icon: Users },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Inventory', href: '/inventory', icon: Warehouse },
      { title: 'Warehouses', href: '/warehouses', icon: Building2 },
      { title: 'Projects', href: '/projects', icon: FolderKanban },
      { title: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
      { title: 'Documents', href: '/documents', icon: FileText },
      { title: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'BOM',
    items: [
      { title: 'BOM', href: '/manufacturing', icon: Wrench },
    ],
  },
  {
    label: 'Insights',
    items: [{ title: 'Reports', href: '/reports', icon: BarChart3 }],
  },
  {
    label: 'Admin',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: UserCircle,
        roles: ['administrator'],
      },
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

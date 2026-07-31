import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useAuth } from '@/contexts/auth-context'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { navGroups, type NavItem } from './nav-config'

interface NavLinksProps {
  collapsed?: boolean
  onNavigate?: () => void
  role?: UserRole
}

function isItemVisible(item: NavItem, userRole?: UserRole) {
  if (!item.roles) return true
  if (!userRole) return false
  return item.roles.includes(userRole)
}

function NavLinkItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.href}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          collapsed && 'justify-center px-2',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.title}</span>}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

export function NavLinks({ collapsed, onNavigate, role }: NavLinksProps) {
  const { user } = useAuth()
  const userRole = role ?? user?.role

  return (
    <nav className="space-y-6">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter((item) =>
          isItemVisible(item, userRole),
        )

        if (visibleItems.length === 0) return null

        return (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <NavLinkItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

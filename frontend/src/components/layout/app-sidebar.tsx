import { Package } from 'lucide-react'

import { useSettings } from '@/contexts/settings-context'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import { NavLinks } from './nav-links'

interface AppSidebarProps {
  collapsed?: boolean
  className?: string
}

export function AppSidebar({ collapsed = false, className }: AppSidebarProps) {
  const { siteName, logoUrl } = useSettings()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={siteName}
            className="h-7 w-7 shrink-0 rounded object-contain"
          />
        ) : (
          <Package className="h-6 w-6 shrink-0 text-primary" />
        )}
        {!collapsed && (
          <span className="ml-2 truncate text-lg font-semibold tracking-tight">
            {siteName}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <NavLinks collapsed={collapsed} />
      </ScrollArea>

      <Separator />
      <div className={cn('p-4', collapsed && 'p-2')}>
        {!collapsed && (
          <p className="truncate text-xs text-muted-foreground">{siteName}</p>
        )}
      </div>
    </aside>
  )
}

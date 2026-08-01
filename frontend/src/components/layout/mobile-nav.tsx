import { Package } from 'lucide-react'

import { useSettings } from '@/contexts/settings-context'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

import { NavLinks } from './nav-links'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const { siteName, logoUrl } = useSettings()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-14 flex-row items-center border-b px-4 text-left">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName}
              className="h-6 w-6 rounded object-contain"
            />
          ) : (
            <Package className="h-6 w-6 text-primary" />
          )}
          <SheetTitle className="ml-2 truncate">{siteName}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-3.5rem)] px-2 py-4">
          <NavLinks onNavigate={() => onOpenChange(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

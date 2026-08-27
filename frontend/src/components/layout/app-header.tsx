import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

const BREADCRUMB_LABELS: Record<string, string> = {
  products: 'Products',
  categories: 'Categories',
  manufacturers: 'Manufacturers',
  suppliers: 'Suppliers',
  customers: 'Customers',
  inventory: 'Inventory',
  intake: 'Stock Intake',
  import: 'Bulk Import',
  projects: 'Projects',
  'purchase-orders': 'Purchase Orders',
  documents: 'Documents',
  edit: 'Edit',
  transactions: 'Transactions',
  reports: 'Reports',
  bom: 'BOM',
  users: 'Users',
  profile: 'Profile',
  settings: 'Settings',
  new: 'New',
}

function useBreadcrumbs() {
  const { pathname } = useLocation()

  return useMemo(() => {
    if (pathname === '/') {
      return [{ label: 'Dashboard', href: '/', isLast: true }]
    }

    const segments = pathname.split('/').filter(Boolean)

    return segments.map((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/')
      const isRecordId = /^[a-z0-9]{15}$/i.test(segment)
      const label =
        BREADCRUMB_LABELS[segment] ??
        (isRecordId
          ? 'Details'
          : segment.length > 20
            ? `${segment.slice(0, 8)}...`
            : segment)

      return {
        label,
        href,
        isLast: index === segments.length - 1,
      }
    })
  }, [pathname])
}

function getInitials(name?: string, email?: string) {
  if (name) {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? 'U'
}

interface AppHeaderProps {
  onMenuClick: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const breadcrumbs = useBreadcrumbs()
  const [search, setSearch] = useState('')

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    if (query) {
      navigate(`/products?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Breadcrumb className="hidden min-w-0 flex-1 sm:block">
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="contents">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <form
        onSubmit={handleSearch}
        className="ml-auto flex w-full max-w-sm items-center gap-2"
      >
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
          />
        </div>
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Toggle theme">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) =>
              setTheme(value as 'light' | 'dark' | 'system')
            }
          >
            <DropdownMenuRadioItem value="light">
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn('relative h-9 w-9 rounded-full')}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

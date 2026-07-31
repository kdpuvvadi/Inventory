import { Outlet } from 'react-router'
import { Package } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 flex items-center gap-2">
          <Package className="h-8 w-8 text-primary" />
          <span className="text-2xl font-semibold tracking-tight">
            Inventory Management
          </span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

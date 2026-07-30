import { Navigate, useLocation } from 'react-router-dom'

import { LoadingScreen } from '@/components/layout/loading-screen'
import { useAuth } from '@/contexts/auth-context'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
}

export default function ProtectedRoute({
  children,
  roles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

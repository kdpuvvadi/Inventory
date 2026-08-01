import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/contexts/auth-context'
import { SettingsProvider } from '@/contexts/settings-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from '@/routes'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

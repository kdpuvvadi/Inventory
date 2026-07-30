import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

import { useAuth } from '@/contexts/auth-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { formatCurrency, normalizeCurrencyCode } from '@/lib/utils'
import type { AppSettings } from '@/types'

export const SETTINGS_QUERY_KEY = ['app-settings'] as const

const DEFAULT_CURRENCY = 'USD'

interface SettingsContextValue {
  settings: AppSettings | null
  currency: string
  isLoading: boolean
  formatMoney: (amount: number) => string
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

async function fetchSettings(): Promise<AppSettings | null> {
  const result = await pb.collection(COLLECTIONS.APP_SETTINGS).getList<AppSettings>(1, 1)
  return result.items[0] ?? null
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: settings = null, isLoading } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const currency = normalizeCurrencyCode(settings?.currency || DEFAULT_CURRENCY)

  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  )

  const refreshSettings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
  }, [queryClient])

  const value = useMemo(
    () => ({
      settings,
      currency,
      isLoading,
      formatMoney,
      refreshSettings,
    }),
    [settings, currency, isLoading, formatMoney, refreshSettings],
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export function useFormatMoney() {
  return useSettings().formatMoney
}

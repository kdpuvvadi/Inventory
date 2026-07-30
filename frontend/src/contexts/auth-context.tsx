import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import pb, { COLLECTIONS } from '@/lib/pocketbase'
import type { UserRecord } from '@/types'

interface AuthContextValue {
  user: UserRecord | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapAuthRecord(): UserRecord | null {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    return null
  }
  return pb.authStore.record as unknown as UserRecord
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(mapAuthRecord())
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid) {
      setUser(null)
      return
    }

    try {
      await pb.collection(COLLECTIONS.USERS).authRefresh()
      setUser(mapAuthRecord())
    } catch {
      pb.authStore.clear()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection(COLLECTIONS.USERS).authRefresh()
        } catch {
          pb.authStore.clear()
        }
      }

      if (!cancelled) {
        setUser(mapAuthRecord())
        setIsLoading(false)
      }
    }

    init()

    const unsubscribe = pb.authStore.onChange(() => {
      setUser(mapAuthRecord())
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection(COLLECTIONS.USERS).authWithPassword(email, password)
    setUser(mapAuthRecord())
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

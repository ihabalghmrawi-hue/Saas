'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserScope } from './operational-scopes'
import type { Permission } from './permissions'
import { hasPermission } from './permissions'
import { getEffectiveScope } from './operational-scopes'

interface AuthState {
  user: User | null
  scope: UserScope | null
  loading: boolean
  isAuthenticated: boolean
  checkPermission: (permission: Permission) => boolean
  checkAnyPermission: (permissions: Permission[]) => boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  scope: null,
  loading: true,
  isAuthenticated: false,
  checkPermission: () => false,
  checkAnyPermission: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [scope, setScope] = useState<UserScope | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const role = (currentUser.user_metadata?.role as string) ?? 'operator'
        const branch = currentUser.user_metadata?.branch as string
        const department = currentUser.user_metadata?.department as string
        const permissions = (currentUser.user_metadata?.permissions as string[]) ?? []
        setScope({
          userId: currentUser.id,
          userName: currentUser.user_metadata?.name ?? currentUser.email ?? '',
          role,
          permissions,
          scope: getEffectiveScope(role, branch, department),
          isSuperAdmin: role === 'super_admin',
        })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const role = (currentUser.user_metadata?.role as string) ?? 'operator'
        const permissions = (currentUser.user_metadata?.permissions as string[]) ?? []
        setScope({
          userId: currentUser.id,
          userName: currentUser.user_metadata?.name ?? currentUser.email ?? '',
          role,
          permissions,
          scope: getEffectiveScope(role, currentUser.user_metadata?.branch, currentUser.user_metadata?.department),
          isSuperAdmin: role === 'super_admin',
        })
      } else {
        setScope(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkPermission = (permission: Permission) => {
    if (!scope) return false
    return hasPermission(scope.permissions, permission)
  }

  const checkAnyPermission = (permissions: Permission[]) => {
    if (!scope) return false
    return permissions.some(p => hasPermission(scope.permissions, p))
  }

  return (
    <AuthContext.Provider value={{ user, scope, loading, isAuthenticated: !!user, checkPermission, checkAnyPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

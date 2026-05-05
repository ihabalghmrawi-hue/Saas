'use client'

/**
 * SaaSProvider — loads once on app start, never re-fetches.
 *
 * Provides:
 *   user        — Supabase auth user (or null)
 *   tenant      — company row (or null)
 *   subscription — current plan context
 *   role        — membership role ('owner' | 'admin' | ...)
 *   isLoading   — true only during initial load
 *   canAccess   — feature gate helper
 */

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionContext, Plan } from '@/lib/plans'
import { buildSubscriptionContext } from '@/lib/plans'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantInfo {
  id:       string
  name:     string
  name_ar:  string
  currency: string
  slug:     string
}

export interface SaaSState {
  isLoading:    boolean
  user:         User | null
  tenant:       TenantInfo | null
  subscription: SubscriptionContext | null
  role:         string
  canAccess:    (feature: string) => boolean
  refresh:      () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const SaaSContext = createContext<SaaSState>({
  isLoading:    true,
  user:         null,
  tenant:       null,
  subscription: null,
  role:         '',
  canAccess:    () => false,
  refresh:      async () => {},
})

// ── Feature gate ──────────────────────────────────────────────────────────────

function makeCanAccess(sub: SubscriptionContext | null) {
  return (feature: string): boolean => {
    if (!sub) return false
    const features = sub.features as unknown as Record<string, boolean>
    // If feature not in plan features map, allow it (not a gated feature)
    if (!(feature in features)) return true
    return features[feature] === true
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SaaSProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<SaaSState, 'canAccess' | 'refresh'>>({
    isLoading: true,
    user:      null,
    tenant:    null,
    subscription: null,
    role:      '',
  })

  const load = useCallback(async () => {
    const supabase = createClient()

    // 1. Get authenticated user (server-verified)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setState({ isLoading: false, user: null, tenant: null, subscription: null, role: '' })
      return
    }

    // 2. Get membership + company in one query
    const { data: membership } = await supabase
      .from('memberships')
      .select(`
        role,
        company_id,
        companies (
          id, name, currency, slug
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const company = (membership as any)?.companies ?? null

    const tenant: TenantInfo | null = company
      ? {
          id:       company.id,
          name:     company.name,
          name_ar:  company.name,
          currency: company.currency || 'SAR',
          slug:     company.slug    || 'default',
        }
      : null

    // 3. Get subscription
    let subscription: SubscriptionContext | null = null
    if (tenant) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', tenant.id)
        .maybeSingle()

      subscription = buildSubscriptionContext(
        sub ?? { company_id: tenant.id, plan: 'free', status: 'active' }
      )
    }

    setState({
      isLoading:    false,
      user,
      tenant,
      subscription,
      role:         membership?.role || '',
    })
  }, [])

  useEffect(() => {
    load()

    // Re-load when auth state changes (login / logout)
    const supabase = createClient()
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          load()
        }
      }
    )
    return () => authSub.unsubscribe()
  }, [load])

  const canAccess = useCallback(
    (feature: string) => makeCanAccess(state.subscription)(feature),
    [state.subscription]
  )

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }))
    await load()
  }, [load])

  return (
    <SaaSContext.Provider value={{ ...state, canAccess, refresh }}>
      {children}
    </SaaSContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSaaS(): SaaSState {
  return useContext(SaaSContext)
}

// Convenience hooks
export function useTenant()       { return useSaaS().tenant }
export function useSubscription() { return useSaaS().subscription }
export function useCanAccess()    { return useSaaS().canAccess }

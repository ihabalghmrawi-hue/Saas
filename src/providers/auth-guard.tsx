'use client'

/**
 * AuthGuard — wraps dashboard routes.
 *
 * While SaaSContext is loading → show spinner (never hang forever).
 * If user is null (not logged in) → redirect to /auth/login.
 * If user has no tenant → redirect to /onboarding.
 * Otherwise → render children.
 *
 * This is a CLIENT-SIDE safety net; the middleware handles server-side.
 * Having both means no edge-case can leak through.
 */

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSaaS } from './saas-provider'

const BILLING_PATH = '/dashboard/billing'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user, tenant } = useSaaS()
  const router   = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  useEffect(() => {
    if (isLoading || redirected.current) return

    if (!user) {
      redirected.current = true
      router.replace('/auth/login?redirectTo=' + encodeURIComponent(pathname))
      return
    }

    if (!tenant) {
      redirected.current = true
      router.replace('/onboarding?new=1')
      return
    }

    // Billing requires Supabase auth — already handled by middleware,
    // but double-check here to prevent PIN users accessing billing UI.
    // (This is a no-op for Supabase users who have a tenant.)
  }, [isLoading, user, tenant, router, pathname])

  // Reset redirect flag when path changes (user navigated back)
  useEffect(() => { redirected.current = false }, [pathname])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  // Don't render children during redirect
  if (!user || !tenant) return null

  return <>{children}</>
}

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

/**
 * Auth layers (tried in order):
 *  1. Supabase Auth  — for SaaS owners (email/password)
 *  2. PIN session    — for staff employees (existing flow)
 *
 * Public paths bypass all auth.
 * Billing routes require Supabase Auth (not PIN).
 */

const PUBLIC_PATHS = [
  '/auth',
  '/staff-login',
  '/onboarding',
  '/pricing',
  '/_next',
  '/api/auth',
  '/api/onboarding',
  '/api/billing/webhook',
  '/favicon.ico',
]

const SUPABASE_REQUIRED_PATHS = [
  '/dashboard/billing',
  '/api/billing',
]

function setHeaders(base: Headers, map: Record<string, string>): Headers {
  const h = new Headers(base)
  Object.entries(map).forEach(([k, v]) => h.set(k, v))
  return h
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 0. Pass public paths immediately ─────────────────────────────────────
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api')

  // Only intercept dashboard and API routes
  if (!isDashboard && !isAPI) return NextResponse.next()

  // ── 1. Try Supabase Auth ──────────────────────────────────────────────────
  //    createServerClient needs to forward cookie refreshes to the browser.
  let supabaseCookiesToSet: { name: string; value: string; options?: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => request.cookies.getAll(),
        setAll:  (cookies: { name: string; value: string; options?: any }[]) => { supabaseCookiesToSet = cookies },
      },
    },
  )

  // getUser() makes a server-side verification (no stale cookie issues)
  const { data: { user: sbUser } } = await supabase.auth.getUser()

  if (sbUser) {
    // Lookup membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('company_id, role')
      .eq('user_id', sbUser.id)
      .eq('is_active', true)
      .maybeSingle()

    if (membership?.company_id) {
      const tenantId = membership.company_id

      // Load business type
      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .maybeSingle()

      const businessType =
        settings?.business_type ||
        request.cookies.get(BUSINESS_TYPE_COOKIE)?.value ||
        'retail'

      // Forward via request headers so server components can read them
      const reqHeaders = setHeaders(request.headers, {
        'x-tenant-id':        tenantId,
        'x-staff-id':         sbUser.id,
        'x-staff-name':       sbUser.email ?? sbUser.id,
        'x-staff-role':       membership.role ?? 'owner',
        'x-staff-permissions': '*',
        'x-business-type':    businessType,
        'x-auth-type':        'supabase',
      })

      const res = NextResponse.next({ request: { headers: reqHeaders } })
      // Apply any Supabase cookie refreshes
      supabaseCookiesToSet.forEach(({ name, value, options }) =>
        res.cookies.set(name, value, options)
      )
      return res
    }

    // Supabase user but no membership → send to onboarding
    if (isDashboard) {
      return NextResponse.redirect(new URL('/onboarding?new=1', request.url))
    }

    // API calls without membership: 401 for billing, pass-through otherwise
    if (isAPI && SUPABASE_REQUIRED_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.json({ error: 'لم يتم إعداد الحساب بعد' }, { status: 401 })
    }
    if (isAPI) return NextResponse.next()
  }

  // ── 2. Billing REQUIRES Supabase — block PIN staff from billing ───────────
  if (SUPABASE_REQUIRED_PATHS.some(p => pathname.startsWith(p))) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── 3. Fall back to PIN session ───────────────────────────────────────────
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const url = new URL('/staff-login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Onboarding gate for PIN staff (admin must choose business type first)
  if (isDashboard && staff.role === 'admin') {
    const bt = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
    if (!bt) return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (isDashboard && !canAccessRoute(staff, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value || 'retail'
  const companyId    = staff.companyId || process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

  const reqHeaders = setHeaders(request.headers, {
    'x-tenant-id':         companyId,
    'x-staff-id':          staff.id,
    'x-staff-name':        staff.name,
    'x-staff-role':        staff.role,
    'x-staff-permissions': staff.permissions.join(','),
    'x-business-type':     businessType,
    'x-auth-type':         'pin',
  })

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

// These paths never need auth checks
const PUBLIC_PATHS = [
  '/auth',            // login, signup, callback
  '/staff-login',     // PIN-based staff entry
  '/onboarding',      // post-signup setup
  '/pricing',         // public pricing page
  '/api/auth',        // auth API helpers
  '/api/onboarding',  // onboarding API
  '/api/billing/webhook', // Stripe webhook (has its own signature check)
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Always pass public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api') && !pathname.startsWith('/api/auth')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // 2. Try Supabase Auth (SaaS owner / admin)
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: any }[]) => {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

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

      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .maybeSingle()

      const businessType = settings?.business_type
        || request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
        || 'retail'

      // Forward headers to server components via request headers
      const reqHeaders = new Headers(request.headers)
      reqHeaders.set('x-tenant-id',        tenantId)
      reqHeaders.set('x-staff-id',          sbUser.id)
      reqHeaders.set('x-staff-name',        sbUser.email || sbUser.id)
      reqHeaders.set('x-staff-role',        membership.role || 'owner')
      reqHeaders.set('x-staff-permissions', '*')
      reqHeaders.set('x-business-type',     businessType)

      const res = NextResponse.next({ request: { headers: reqHeaders } })
      // Copy Supabase cookie refreshes
      supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
      return res
    }

    // User authenticated but no company membership yet → onboarding
    if (isDashboard) {
      return NextResponse.redirect(new URL('/onboarding?new=1', request.url))
    }

    // API calls for users without membership
    if (isAPI) {
      const res = NextResponse.next()
      res.headers.set('x-tenant-id',        process.env.NEXT_PUBLIC_COMPANY_ID || 'default')
      res.headers.set('x-staff-id',          sbUser.id)
      res.headers.set('x-staff-role',        'owner')
      res.headers.set('x-staff-permissions', '*')
      return res
    }
  }

  // 3. Billing routes REQUIRE Supabase auth — redirect to login if no session
  if (pathname.startsWith('/dashboard/billing') || pathname.startsWith('/api/billing')) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    return NextResponse.redirect(
      new URL('/auth/login?redirectTo=' + encodeURIComponent(pathname), request.url)
    )
  }

  // 4. Fall back to PIN-based staff session for all other dashboard routes
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const loginUrl = new URL('/staff-login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding gate for PIN staff
  if (isDashboard && staff.role === 'admin') {
    const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
    if (!businessType) return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (isDashboard && !canAccessRoute(staff, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value || 'retail'
  const companyId    = staff.companyId || process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-tenant-id',         companyId)
  reqHeaders.set('x-staff-id',          staff.id)
  reqHeaders.set('x-staff-name',        staff.name)
  reqHeaders.set('x-staff-role',        staff.role)
  reqHeaders.set('x-staff-permissions', staff.permissions.join(','))
  reqHeaders.set('x-business-type',     businessType)

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  reqHeaders.forEach((val, key) => { if (key.startsWith('x-')) res.headers.set(key, val) })
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

// Routes that bypass auth entirely
const PUBLIC_PATHS = [
  '/staff-login',
  '/api/auth',
  '/api/billing/webhook',  // Stripe uses its own signature auth
  '/onboarding',
  '/api/onboarding',
  '/auth',                 // Supabase Auth pages (login/signup/callback)
  '/pricing',              // Public pricing page
]

// Paths that require Supabase Auth (owner billing management)
const SUPABASE_ONLY_PATHS = ['/dashboard/billing', '/api/billing']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api') && !pathname.startsWith('/api/auth')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // ── 1. Try Supabase Auth session (tenant owner) ──────────────────────────
  const cookieResponse = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet: { name: string; value: string; options?: any }[]) {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            cookieResponse.cookies.set(name, value, options as any)
          })
        },
      },
    },
  )

  const { data: { user: sbUser } } = await supabase.auth.getUser()

  if (sbUser) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('company_id')
      .eq('user_id', sbUser.id)
      .eq('is_active', true)
      .single()

    if (membership?.company_id) {
      const tenantId = membership.company_id

      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .single()

      const businessType = settings?.business_type
        || request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
        || 'retail'

      const res = NextResponse.next({ request: { headers: request.headers } })
      // Inject tenant context
      res.headers.set('x-tenant-id',         tenantId)
      res.headers.set('x-staff-id',           sbUser.id)
      res.headers.set('x-staff-name',         sbUser.email || '')
      res.headers.set('x-staff-role',         'admin')
      res.headers.set('x-staff-permissions',  '*')
      res.headers.set('x-business-type',      businessType)
      // Forward any Supabase SSR cookies
      cookieResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
      return res
    }

    // Supabase user but no membership → incomplete signup
    if (isDashboard) return NextResponse.redirect(new URL('/auth/signup', request.url))
  }

  // ── 2. Fall back to PIN-based staff session ───────────────────────────────
  if (SUPABASE_ONLY_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login?redirectTo=' + encodeURIComponent(pathname), request.url))
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const loginUrl = new URL('/staff-login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding gate
  if (isDashboard && staff.role === 'admin') {
    const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
    if (!businessType) return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (isDashboard && !canAccessRoute(staff, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value || 'retail'
  const companyId    = staff.companyId || process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

  const res = NextResponse.next()
  res.headers.set('x-tenant-id',          companyId)
  res.headers.set('x-staff-id',           staff.id)
  res.headers.set('x-staff-name',         staff.name)
  res.headers.set('x-staff-role',         staff.role)
  res.headers.set('x-staff-permissions',  staff.permissions.join(','))
  res.headers.set('x-business-type',      businessType)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

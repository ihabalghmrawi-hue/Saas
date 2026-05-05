import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

// Routes that bypass auth entirely
const PUBLIC_PATHS = [
  '/staff-login',
  '/api/auth',
  '/api/billing/webhook',
  '/onboarding',
  '/api/onboarding',
  '/auth',
  '/pricing',
  '/auth/incomplete',
]

// Paths that require Supabase Auth (owner billing management)
const SUPABASE_ONLY_PATHS = ['/dashboard/billing', '/api/billing']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass public paths through
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

  // Use getSession (no network call) for speed — getUser() verifies signature but is slower
  const { data: { session } } = await supabase.auth.getSession()
  const sbUser = session?.user ?? null

  if (sbUser) {
    // Look up membership — requires the SELECT policy on memberships table
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('company_id, role')
      .eq('user_id', sbUser.id)
      .eq('is_active', true)
      .maybeSingle()   // maybeSingle() returns null (not error) when 0 rows

    if (membership?.company_id) {
      const tenantId = membership.company_id

      // Load business type (from settings or cookie)
      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .maybeSingle()

      const businessType = settings?.business_type
        || request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
        || 'retail'

      const res = NextResponse.next({ request: { headers: request.headers } })
      res.headers.set('x-tenant-id',        tenantId)
      res.headers.set('x-staff-id',          sbUser.id)
      res.headers.set('x-staff-name',        sbUser.email || sbUser.id)
      res.headers.set('x-staff-role',        membership.role || 'admin')
      res.headers.set('x-staff-permissions', '*')
      res.headers.set('x-business-type',     businessType)
      cookieResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
      return res
    }

    // ── Supabase user exists but membership not found ─────────────────────────
    // Could be: RLS blocking, or signup didn't complete.
    // Log for debugging (non-fatal):
    if (membershipError) {
      console.warn('Membership lookup error (RLS?):', membershipError.message, 'user:', sbUser.id)
    }

    // Redirect to onboarding (not signup — user already has an account)
    if (isDashboard) {
      const url = new URL('/onboarding', request.url)
      url.searchParams.set('new', '1')
      return NextResponse.redirect(url)
    }

    // For API calls from Supabase user with no membership: still let through
    // with a generic tenant ID so non-tenant APIs still work
    if (isAPI && !SUPABASE_ONLY_PATHS.some(p => pathname.startsWith(p))) {
      const res = NextResponse.next()
      res.headers.set('x-tenant-id',        process.env.NEXT_PUBLIC_COMPANY_ID || 'default')
      res.headers.set('x-staff-id',          sbUser.id)
      res.headers.set('x-staff-name',        sbUser.email || '')
      res.headers.set('x-staff-role',        'admin')
      res.headers.set('x-staff-permissions', '*')
      res.headers.set('x-business-type',     'retail')
      return res
    }
  }

  // ── 2. Fall back to PIN-based staff session ───────────────────────────────
  if (SUPABASE_ONLY_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(
      new URL('/auth/login?redirectTo=' + encodeURIComponent(pathname), request.url)
    )
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const loginUrl = new URL('/staff-login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding gate (PIN staff only)
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
  res.headers.set('x-tenant-id',         companyId)
  res.headers.set('x-staff-id',          staff.id)
  res.headers.set('x-staff-name',        staff.name)
  res.headers.set('x-staff-role',        staff.role)
  res.headers.set('x-staff-permissions', staff.permissions.join(','))
  res.headers.set('x-business-type',     businessType)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

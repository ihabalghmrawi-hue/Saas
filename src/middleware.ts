import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

// Never touch these paths
const PUBLIC_PATHS = [
  '/auth',
  '/staff-login',
  '/onboarding',
  '/pricing',
  '/api/auth',
  '/api/onboarding',
  '/api/billing/webhook',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass public paths immediately
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // ── Try Supabase Auth ─────────────────────────────────────────────────────
  const cookiesToSet: { name: string; value: string; options?: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          cookiesToSet.push(...list)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (membership?.company_id) {
      const tenantId = membership.company_id

      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .maybeSingle()

      const businessType =
        settings?.business_type ||
        request.cookies.get(BUSINESS_TYPE_COOKIE)?.value ||
        'retail'

      const reqHeaders = new Headers(request.headers)
      reqHeaders.set('x-tenant-id',         tenantId)
      reqHeaders.set('x-staff-id',          user.id)
      reqHeaders.set('x-staff-name',        user.email ?? user.id)
      reqHeaders.set('x-staff-role',        membership.role ?? 'owner')
      reqHeaders.set('x-staff-permissions', '*')
      reqHeaders.set('x-business-type',     businessType)

      const res = NextResponse.next({ request: { headers: reqHeaders } })
      cookiesToSet.forEach(({ name, value, options }) =>
        res.cookies.set(name, value, options ?? {})
      )
      return res
    }

    // User exists but no membership → onboarding
    if (isDashboard) {
      return NextResponse.redirect(new URL('/onboarding?new=1', request.url))
    }
    if (isAPI) return NextResponse.next()
  }

  // Billing requires Supabase auth — no PIN fallback
  if (pathname.startsWith('/dashboard/billing') || pathname.startsWith('/api/billing')) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── Try PIN session ───────────────────────────────────────────────────────
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const url = new URL('/staff-login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  if (isDashboard && staff.role === 'admin') {
    const bt = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
    if (!bt) return NextResponse.redirect(new URL('/onboarding', request.url))
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

  return NextResponse.next({ request: { headers: reqHeaders } })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

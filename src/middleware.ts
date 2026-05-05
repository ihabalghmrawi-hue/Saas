import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'
import { isSuperAdmin, loadRolePermissions } from '@/lib/rbac'

const PUBLIC_PATHS = [
  '/auth',
  '/staff-login',
  '/onboarding',
  '/pricing',
  '/blocked',
  '/api/auth',
  '/api/onboarding',
  '/admin',       // admin has its own guard
]

// Admin paths only for super admin — checked inside admin layout
const ADMIN_PATHS = ['/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // ── Supabase Auth ─────────────────────────────────────────────────────────
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
    const superAdmin = isSuperAdmin(user.email)

    // Super admin bypasses tenant/subscription checks
    if (superAdmin) {
      const reqHeaders = buildHeaders(request.headers, {
        'x-tenant-id':         'super_admin',
        'x-staff-id':          user.id,
        'x-staff-name':        user.email ?? user.id,
        'x-staff-role':        'super_admin',
        'x-staff-permissions': '*',
        'x-business-type':     'retail',
        'x-is-super-admin':    'true',
      })
      const res = NextResponse.next({ request: { headers: reqHeaders } })
      cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options ?? {}))
      return res
    }

    // Regular user: get membership with role
    const { data: membership } = await supabase
      .from('memberships')
      .select('company_id, role, role_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership?.company_id) {
      if (isDashboard) return NextResponse.redirect(new URL('/onboarding?new=1', request.url))
      if (isAPI) return NextResponse.next()
    }

    if (membership?.company_id) {
      const tenantId = membership.company_id

      // ── Subscription check ──────────────────────────────────────────────
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, end_date')
        .eq('company_id', tenantId)
        .maybeSingle()

      const subExpired = sub && (
        sub.status === 'suspended' ||
        sub.status === 'expired' ||
        (sub.end_date && new Date(sub.end_date) < new Date())
      )

      if (subExpired && isDashboard) {
        return NextResponse.redirect(new URL('/blocked', request.url))
      }

      // ── Load permissions for this role ──────────────────────────────────
      let permissions: string[] = ['*'] // owner fallback
      if (membership.role_id && membership.role !== 'owner') {
        const perms = await loadRolePermissions(supabase, membership.role_id)
        permissions = perms.length > 0 ? perms : ['*']
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('business_type')
        .eq('company_id', tenantId)
        .maybeSingle()

      const businessType =
        settings?.business_type ||
        request.cookies.get(BUSINESS_TYPE_COOKIE)?.value ||
        'retail'

      const reqHeaders = buildHeaders(request.headers, {
        'x-tenant-id':         tenantId,
        'x-staff-id':          user.id,
        'x-staff-name':        user.email ?? user.id,
        'x-staff-role':        membership.role ?? 'owner',
        'x-staff-permissions': permissions.join(','),
        'x-business-type':     businessType,
        'x-is-super-admin':    'false',
      })

      const res = NextResponse.next({ request: { headers: reqHeaders } })
      cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options ?? {}))
      return res
    }
  }

  // ── PIN session fallback ──────────────────────────────────────────────────
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirectTo', pathname)
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

  const reqHeaders = buildHeaders(request.headers, {
    'x-tenant-id':         companyId,
    'x-staff-id':          staff.id,
    'x-staff-name':        staff.name,
    'x-staff-role':        staff.role,
    'x-staff-permissions': staff.permissions.join(','),
    'x-business-type':     businessType,
    'x-is-super-admin':    'false',
  })

  return NextResponse.next({ request: { headers: reqHeaders } })
}

function buildHeaders(base: Headers, map: Record<string, string>): Headers {
  const h = new Headers(base)
  Object.entries(map).forEach(([k, v]) => h.set(k, v))
  return h
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient }              from '@supabase/ssr'
import { verifySession, SESSION_COOKIE }   from '@/lib/session'
import { canAccessRoute }                  from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE }            from '@/lib/features'
import { isSuperAdmin, loadRolePermissions } from '@/lib/rbac'
import { computeLifecycle }                from '@/lib/subscription'
import { checkRateLimit, getClientIp, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { trackSessionInMiddleware }        from '@/lib/auth-tracking'

const PUBLIC_PATHS = [
  '/auth',
  '/staff-login',
  '/onboarding',
  '/pricing',
  '/blocked',
  '/api/auth',
  '/api/onboarding',
]

// Session-only cookie set on explicit login — disappears when browser closes.
const APP_SESSION_COOKIE = 'app-session-active'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Rate-limit login endpoints ────────────────────────────────────────────
  if (pathname === '/api/auth/login' || pathname === '/api/auth/pin') {
    const ip     = getClientIp(request)
    const result = checkRateLimit(`login:${ip}`, RATE_LIMITS.login)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'عدد كبير من المحاولات. حاول مرة أخرى بعد قليل.' },
        { status: 429, headers: rateLimitHeaders(result, RATE_LIMITS.login) },
      )
    }
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI       = pathname.startsWith('/api')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // ── General API rate limit ────────────────────────────────────────────────
  if (isAPI) {
    const ip     = getClientIp(request)
    const result = checkRateLimit(`api:${ip}`, RATE_LIMITS.api)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح به من الطلبات.' },
        { status: 429, headers: rateLimitHeaders(result, RATE_LIMITS.api) },
      )
    }
  }

  // ── Supabase Auth ─────────────────────────────────────────────────────────
  const cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => { cookiesToSet.push(...list) },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    trackSessionInMiddleware(request, cookiesToSet, user.id, supabase)

    const hasSessionMarker = !!request.cookies.get(APP_SESSION_COOKIE)?.value
    if (!hasSessionMarker && isDashboard) {
      const url = new URL('/auth/login', request.url)
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    const superAdmin = isSuperAdmin(user.email)

    if (superAdmin) {
      const reqHeaders = buildHeaders(request.headers, {
        'x-tenant-id':         'super_admin',
        'x-staff-id':          user.id,
        'x-staff-name':        user.user_metadata?.full_name || user.email?.split('@')[0] || user.id,
        'x-staff-role':        'super_admin',
        'x-staff-permissions': '*',
        'x-business-type':     'retail',
        'x-is-super-admin':    'true',
        'x-sub-status':        'active',
      })
      const res = NextResponse.next({ request: { headers: reqHeaders } })
      cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options ?? {}))
      return res
    }

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

      // ── Subscription lifecycle check ─────────────────────────────────────
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, company_id, plan, status, start_date, end_date, trial_ends_at, notes')
        .eq('company_id', tenantId)
        .maybeSingle()

      const lifecycle = computeLifecycle(sub as any)

      // Suspended/Cancelled → hard block
      if (lifecycle.isBlocked && isDashboard) {
        return NextResponse.redirect(new URL('/blocked', request.url))
      }

      // ── Load permissions ─────────────────────────────────────────────────
      let permissions: string[] = ['*']
      if (membership.role !== 'owner') {
        permissions = membership.role_id
          ? await loadRolePermissions(supabase, membership.role_id)
          : []
      }

      const [settingsRes, companyRes] = await Promise.all([
        supabase.from('company_settings').select('business_type').eq('company_id', tenantId).maybeSingle(),
        supabase.from('companies').select('name, currency').eq('id', tenantId).maybeSingle(),
      ])

      const businessType =
        settingsRes.data?.business_type ||
        request.cookies.get(BUSINESS_TYPE_COOKIE)?.value ||
        'retail'

      const reqHeaders = buildHeaders(request.headers, {
        'x-tenant-id':         tenantId,
        'x-staff-id':          user.id,
        'x-staff-name':        user.user_metadata?.full_name || user.email?.split('@')[0] || user.id,
        'x-staff-role':        membership.role ?? 'owner',
        'x-staff-permissions': permissions.join(','),
        'x-business-type':     businessType,
        'x-company-name':      companyRes.data?.name     ?? '',
        'x-company-currency':  companyRes.data?.currency ?? 'SAR',
        'x-is-super-admin':    'false',
        'x-sub-status':        lifecycle.status,
        'x-sub-plan':          sub?.plan ?? 'free',
        'x-sub-grace':         lifecycle.showGraceBanner ? '1' : '0',
        'x-sub-trial':         lifecycle.showTrialBanner ? '1' : '0',
        'x-sub-days-left':     lifecycle.daysLeft !== null ? String(lifecycle.daysLeft) : '',
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

  // Fetch company currency for PIN-session users
  let pinCurrency = process.env.NEXT_PUBLIC_CURRENCY_DEFAULT || 'SAR'
  try {
    const { data: co } = await createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
    ).from('companies').select('currency').eq('id', companyId).maybeSingle()
    if (co?.currency) pinCurrency = co.currency
  } catch { /* fallback */ }

  const reqHeaders = buildHeaders(request.headers, {
    'x-tenant-id':         companyId,
    'x-staff-id':          staff.id,
    'x-staff-name':        staff.name,
    'x-staff-role':        staff.role,
    'x-staff-permissions': staff.permissions.join(','),
    'x-business-type':     businessType,
    'x-company-currency':  pinCurrency,
    'x-is-super-admin':    'false',
    'x-sub-status':        'active',
    'x-sub-plan':          'free',
    'x-sub-grace':         '0',
    'x-sub-trial':         '0',
    'x-sub-days-left':     '',
  })

  return NextResponse.next({ request: { headers: reqHeaders } })
}

function buildHeaders(base: Headers, map: Record<string, string>): Headers {
  const h = new Headers(base)
  Object.entries(map).forEach(([k, v]) => h.set(k, encodeURIComponent(v)))
  return h
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

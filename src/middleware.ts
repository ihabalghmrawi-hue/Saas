import { NextResponse, type NextRequest } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

const PUBLIC_PATHS = ['/staff-login', '/api/auth', '/onboarding', '/api/onboarding']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI = pathname.startsWith('/api') && !pathname.startsWith('/api/auth')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // Auth check
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  if (!staff) {
    if (isAPI) return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    const loginUrl = new URL('/staff-login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding check (dashboard only, admin only)
  if (isDashboard && staff.role === 'admin') {
    const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value
    if (!businessType) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // Route permission check
  if (isDashboard && !canAccessRoute(staff, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const businessType = request.cookies.get(BUSINESS_TYPE_COOKIE)?.value || 'retail'

  const res = NextResponse.next()
  res.headers.set('x-staff-id', staff.id)
  res.headers.set('x-staff-name', staff.name)
  res.headers.set('x-staff-role', staff.role)
  res.headers.set('x-staff-permissions', staff.permissions.join(','))
  res.headers.set('x-business-type', businessType)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

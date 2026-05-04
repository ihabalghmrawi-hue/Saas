import { NextResponse, type NextRequest } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { canAccessRoute } from '@/lib/permissions'

const PUBLIC_PATHS = ['/staff-login', '/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets and public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Only protect /dashboard and /api routes (except auth)
  const isDashboard = pathname.startsWith('/dashboard')
  const isAPI = pathname.startsWith('/api') && !pathname.startsWith('/api/auth')

  if (!isDashboard && !isAPI) return NextResponse.next()

  // Read session cookie
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const staff = token ? await verifySession(token) : null

  // No session → redirect to login
  if (!staff) {
    if (isAPI) {
      return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
    }
    const loginUrl = new URL('/staff-login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check route-level permission
  if (isDashboard && !canAccessRoute(staff, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Inject staff info into request headers for server components
  const res = NextResponse.next()
  res.headers.set('x-staff-id', staff.id)
  res.headers.set('x-staff-name', staff.name)
  res.headers.set('x-staff-role', staff.role)
  res.headers.set('x-staff-permissions', staff.permissions.join(','))
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

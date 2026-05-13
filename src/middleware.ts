import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractRequestContext, finalizeContext, responseHeaders, TRACEPARENT_HEADER } from '@/lib/middleware/distributed-trace'

export function middleware(request: NextRequest) {
  const headers: Record<string, string | string[] | undefined> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const ctx = extractRequestContext(headers)

  const response = NextResponse.next()

  const traceHeaders = responseHeaders(ctx)
  for (const [key, value] of Object.entries(traceHeaders)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

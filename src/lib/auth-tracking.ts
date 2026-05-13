import { createServerClient } from '@supabase/ssr'
import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies'

const SESSION_TRACKED_COOKIE = 'st'
const SESSION_PING_COOKIE = 'sp'

function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function detectDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
  return 'desktop'
}

export async function trackSessionInMiddleware(
  request: { cookies: RequestCookies; headers: { get(name: string): string | null } },
  cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
  userId: string,
  supabase: ReturnType<typeof createServerClient>,
) {
  const tracked = request.cookies.get(SESSION_TRACKED_COOKIE)?.value
  if (!tracked) {
    const ip = getClientIp(request)
    const ua = request.headers.get('user-agent')
    const device = detectDeviceType(ua)

    await supabase.from('user_sessions').insert({
      user_id: userId,
      ip_address: ip,
      user_agent: ua,
      device_type: device,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).maybeSingle()

    cookiesToSet.push({
      name: SESSION_TRACKED_COOKIE,
      value: '1',
      options: { httpOnly: true, sameSite: 'lax', maxAge: 86400 * 7, path: '/' },
    })
    cookiesToSet.push({
      name: SESSION_PING_COOKIE,
      value: String(Date.now()),
      options: { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' },
    })
  } else {
    const lastPing = request.cookies.get(SESSION_PING_COOKIE)?.value
    const needsPing = !lastPing || (Date.now() - Number(lastPing)) > 300000
    if (needsPing) {
      await supabase.from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      cookiesToSet.push({
        name: SESSION_PING_COOKIE,
        value: String(Date.now()),
        options: { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' },
      })
    }
  }
}

export async function endUserSessions(supabase: ReturnType<typeof createServerClient>, userId: string) {
  await supabase.from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
}

export async function recordLoginAttempt(
  supabase: ReturnType<typeof createServerClient>,
  email: string,
  success: boolean,
  request?: { headers: { get(name: string): string | null } },
) {
  await supabase.from('login_attempts').insert({
    email,
    ip_address: request ? getClientIp(request) : null,
    user_agent: request ? request.headers.get('user-agent') : null,
    success,
  })
}

export async function createUserSession(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  request?: { headers: { get(name: string): string | null } },
) {
  const ip = request ? getClientIp(request) : null
  const ua = request ? request.headers.get('user-agent') : null
  const device = detectDeviceType(ua)

  await supabase.from('user_sessions').insert({
    user_id: userId,
    ip_address: ip,
    user_agent: ua,
    device_type: device,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  })
}

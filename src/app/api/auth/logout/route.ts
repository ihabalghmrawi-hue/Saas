import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

const APP_SESSION_COOKIE = 'app-session-active'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(SESSION_COOKIE)
  res.cookies.set(APP_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}

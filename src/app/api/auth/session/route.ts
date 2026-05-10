import { NextResponse } from 'next/server'

const COOKIE = 'app-session-active'

// Called after successful Supabase email login — marks this browser session as authenticated.
// No maxAge = session cookie = gone when browser closes.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    // intentionally no maxAge / expires — cookie is session-only
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  })
  return res
}

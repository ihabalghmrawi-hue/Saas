import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SESSION_COOKIE } from '@/lib/session'
import { cookies } from 'next/headers'

const APP_SESSION_COOKIE = 'app-session-active'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase.from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)
  }

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

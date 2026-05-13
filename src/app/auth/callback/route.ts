import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordLoginAttempt, createUserSession } from '@/lib/auth-tracking'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.user) {
      const user = data.user
      recordLoginAttempt(supabase, user.email ?? 'oauth', true, request)
      createUserSession(supabase, user.id, request)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
}

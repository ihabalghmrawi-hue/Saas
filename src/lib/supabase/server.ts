import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookies().then(c => c.getAll()).catch(() => [])
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookies().then(c => {
            cookiesToSet.forEach(({ name, value, options }) =>
              c.set(name, value, options)
            )
          }).catch(() => {
            // Ignore — can't set cookies in Server Component rendering.
            // Middleware handles cookie synchronization on the next request.
          })
        },
      },
    }
  )
}

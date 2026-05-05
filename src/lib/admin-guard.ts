/**
 * Shared guard for all /api/admin/* routes.
 * Returns the supabase client + user if super admin, else throws Response.
 */
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function requireSuperAdmin() {
  // Check header set by middleware (fast path)
  const h = headers()
  if (h.get('x-is-super-admin') === 'true') {
    const supabase = createClient()
    return supabase
  }

  // Double-check with Supabase (fallback)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    throw NextResponse.json({ error: 'غير مصرح به — سوبر ادمن فقط' }, { status: 403 })
  }
  return supabase
}

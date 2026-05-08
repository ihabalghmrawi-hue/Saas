import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { signSession, hashPin, SESSION_COOKIE } from '@/lib/session'
import { PinLoginSchema }            from '@/validators/auth'
import { ok, err, Errors, validationError } from '@/lib/api-response'
import type { PinLoginResponse }     from '@/validators/auth'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const ADMIN_PIN  = process.env.ADMIN_PIN || '1234'

export async function POST(req: NextRequest) {
  // 1. Parse & validate input
  let body: unknown
  try { body = await req.json() } catch {
    return Errors.badRequest('طلب غير صالح')
  }

  const parsed = PinLoginSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const { pin } = parsed.data
  const pinHash  = await hashPin(pin)

  // 2. Admin PIN shortcut
  const adminHash = await hashPin(ADMIN_PIN)
  if (pinHash === adminHash) {
    const session = {
      id:          'admin',
      name:        'المدير',
      role:        'admin',
      permissions: ['*'],
      companyId:   COMPANY_ID,
      loginAt:     Date.now(),
    }
    const token = await signSession(session)
    const res   = ok<PinLoginResponse>({ success: true, name: session.name, role: session.role })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge:   60 * 60 * 12,
      path:     '/',
    })
    return res
  }

  // 3. Look up staff by PIN hash
  const supabase         = createClient()
  const { data: staff }  = await supabase
    .from('staff_users')
    .select('*, staff_roles(name, name_ar, role_permissions(permission_code))')
    .eq('company_id', COMPANY_ID)
    .eq('pin_hash', pinHash)
    .eq('is_active', true)
    .single()

  if (!staff) return err('INVALID_PIN', 'رقم سري خاطئ', 401)

  const role: any         = staff.staff_roles
  const permissions: string[] = (role?.role_permissions ?? []).map((rp: any) => rp.permission_code)

  const session = {
    id:          staff.id,
    name:        staff.name,
    role:        role?.name || 'cashier',
    permissions,
    companyId:   COMPANY_ID,
    loginAt:     Date.now(),
  }

  const token = await signSession(session)

  // Update last_login (fire-and-forget — not worth blocking on)
  supabase.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', staff.id)

  const res = ok<PinLoginResponse>({ success: true, name: session.name, role: session.role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 12,
    path:     '/',
  })
  return res
}

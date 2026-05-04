import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signSession, hashPin, SESSION_COOKIE } from '@/lib/session'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const ADMIN_PIN = process.env.ADMIN_PIN || '1234'

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    if (!pin) return NextResponse.json({ error: 'أدخل الرقم السري' }, { status: 400 })

    const supabase = createClient()
    const pinHash = await hashPin(pin)

    // Check hardcoded admin PIN first
    const adminPinHash = await hashPin(ADMIN_PIN)
    if (pinHash === adminPinHash) {
      const session = {
        id: 'admin',
        name: 'المدير',
        role: 'admin',
        permissions: ['*'],
        companyId: COMPANY_ID,
        loginAt: Date.now(),
      }
      const token = await signSession(session)
      const res = NextResponse.json({ success: true, name: session.name, role: session.role })
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 12, // 12 hours
        path: '/',
      })
      return res
    }

    // Look up staff by PIN hash
    const { data: staff } = await supabase
      .from('staff_users')
      .select('*, staff_roles(name, name_ar, role_permissions(permission_code))')
      .eq('company_id', COMPANY_ID)
      .eq('pin_hash', pinHash)
      .eq('is_active', true)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'رقم سري خاطئ' }, { status: 401 })
    }

    const role = staff.staff_roles as any
    const permissions: string[] = (role?.role_permissions || []).map((rp: any) => rp.permission_code)

    const session = {
      id: staff.id,
      name: staff.name,
      role: role?.name || 'cashier',
      permissions,
      companyId: COMPANY_ID,
      loginAt: Date.now(),
    }

    const token = await signSession(session)

    // Update last_login
    await supabase.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', staff.id)

    const res = NextResponse.json({ success: true, name: session.name, role: session.role })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 12,
      path: '/',
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

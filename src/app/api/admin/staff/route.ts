import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/session'
import { logAudit } from '@/lib/audit'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function GET() {
  const supabase = createClient()
  const { data } = await supabase
    .from('staff_users')
    .select('*, staff_roles(name, name_ar)')
    .eq('company_id', COMPANY_ID)
    .order('created_at')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  try {
    const { name, pin, role_id } = await req.json()
    if (!name || !pin || !role_id) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    if (pin.length < 4) return NextResponse.json({ error: 'الرقم السري يجب أن يكون 4 أرقام على الأقل' }, { status: 400 })

    const supabase = createClient()
    const pin_hash = await hashPin(pin)

    const { data, error } = await supabase
      .from('staff_users')
      .insert({ company_id: COMPANY_ID, name, pin_hash, role_id })
      .select('*, staff_roles(name, name_ar)')
      .single()

    if (error) throw new Error(error.message)

    await logAudit({ action: 'staff.created', entityType: 'staff', entityId: data.id, newValue: { name, role_id } })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const supabase = createClient()
    await supabase.from('staff_users').update({ is_active: false }).eq('id', id).eq('company_id', COMPANY_ID)
    await logAudit({ action: 'staff.deleted', entityType: 'staff', entityId: id })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

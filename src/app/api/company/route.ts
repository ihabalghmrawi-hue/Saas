import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const companyId = await getCompanyId()
  const supabase  = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, name_ar, email, phone, address, tax_number, currency, language, timezone, fiscal_year_start, is_active, created_at, updated_at, logo_url, settings')
    .eq('id', companyId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || {})
}

export async function PATCH(req: NextRequest) {
  const companyId = await getCompanyId()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const allowed = ['name', 'name_ar', 'email', 'phone', 'address', 'tax_number', 'currency', 'language', 'timezone', 'settings']
  const update  = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'لا توجد بيانات للتحديث' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', companyId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })

  await logAudit({ action: 'settings.updated', entityType: 'company', entityId: companyId, newValue: update })

  return NextResponse.json(data)
}

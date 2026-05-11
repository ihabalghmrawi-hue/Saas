import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TYPE_COOKIE, BusinessType, BUSINESS_TYPES } from '@/lib/features'

async function getAuthCompanyId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return membership?.company_id ?? null
}

export async function GET() {
  const supabase = createClient()
  const companyId = await getAuthCompanyId(supabase)
  if (!companyId) return NextResponse.json({ business_type: null })

  const { data } = await supabase
    .from('company_settings')
    .select('business_type')
    .eq('company_id', companyId)
    .maybeSingle()
  return NextResponse.json({ business_type: data?.business_type || null })
}

export async function POST(req: NextRequest) {
  const { business_type } = await req.json()
  if (!BUSINESS_TYPES.includes(business_type as BusinessType)) {
    return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 })
  }

  const supabase  = createClient()
  const companyId = await getAuthCompanyId(supabase)
  if (!companyId) {
    return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
  }

  const { error } = await supabase.from('company_settings').upsert({
    company_id:  companyId,
    business_type,
    updated_at:  new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(BUSINESS_TYPE_COOKIE, business_type, {
    httpOnly: false,
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return res
}

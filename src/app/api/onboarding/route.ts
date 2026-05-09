import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TYPE_COOKIE, BusinessType, BUSINESS_TYPES } from '@/lib/features'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data } = await supabase
    .from('company_settings')
    .select('business_type')
    .eq('company_id', COMPANY_ID)
    .single()
  return NextResponse.json({ business_type: data?.business_type || null })
}

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const { business_type } = await req.json()
  if (!BUSINESS_TYPES.includes(business_type as BusinessType)) {
    return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 })
  }

  const supabase = createClient()
  await supabase.from('company_settings').upsert({
    company_id: COMPANY_ID,
    business_type,
    updated_at: new Date().toISOString(),
  })

  const res = NextResponse.json({ success: true })
  res.cookies.set(BUSINESS_TYPE_COOKIE, business_type, {
    httpOnly: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return res
}

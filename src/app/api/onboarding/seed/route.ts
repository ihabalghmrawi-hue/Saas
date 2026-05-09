import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TYPES, type BusinessType } from '@/lib/features'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  try {
    const { business_type, reset = false } = await req.json()

    if (!BUSINESS_TYPES.includes(business_type as BusinessType)) {
      return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 })
    }

    const supabase = createClient()

    // If reset: clear existing categories and products
    if (reset) {
      await supabase.from('products').delete().eq('company_id', COMPANY_ID)
      await supabase.from('product_categories').delete().eq('company_id', COMPANY_ID)
    }

    const { data, error } = await supabase.rpc('seed_business_template', {
      p_company_id: COMPANY_ID,
      p_business_type: business_type,
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, result: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

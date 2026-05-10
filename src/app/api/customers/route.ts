import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  try {
    const body       = await req.json()
    const COMPANY_ID = getCompanyId()
    const supabase   = createClient()

    const { data: customer, error } = await supabase.from('customers').insert({
      company_id:   COMPANY_ID,
      name:         String(body.name || ''),
      phone:        body.phone        || null,
      email:        body.email        || null,
      address:      body.address      || null,
      credit_limit: Number(body.credit_limit) || 0,
      is_active:    true,
    }).select().single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ customer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

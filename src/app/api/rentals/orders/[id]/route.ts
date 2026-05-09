import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()
  const { data, error } = await supabase.from('rental_orders')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id).eq('company_id', COMPANY_ID).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

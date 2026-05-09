import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()
  const { data, error } = await supabase.from('dresses')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id).eq('company_id', COMPANY_ID).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  // Check no active rentals
  const { data: active } = await supabase.from('rental_orders')
    .select('id').eq('dress_id', params.id).in('status', ['booked', 'active']).limit(1)
  if (active && active.length > 0)
    return NextResponse.json({ error: 'الفستان لديه حجوزات نشطة، لا يمكن الحذف' }, { status: 400 })
  await supabase.from('dresses').update({ status: 'retired' }).eq('id', params.id).eq('company_id', COMPANY_ID)
  return NextResponse.json({ success: true })
}

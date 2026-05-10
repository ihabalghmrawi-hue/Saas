import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  const allowed: Record<string, unknown> = {}
  if ('name' in body)         allowed.name         = String(body.name || '')
  if ('code' in body)         allowed.code         = body.code || null
  if ('category' in body)     allowed.category     = String(body.category)
  if ('size' in body)         allowed.size         = body.size || null
  if ('color' in body)        allowed.color        = body.color || null
  if ('description' in body)  allowed.description  = body.description || null
  if ('rental_price' in body) allowed.rental_price = Number(body.rental_price) || 0
  if ('deposit' in body)      allowed.deposit      = Number(body.deposit) || 0
  if ('status' in body)       allowed.status       = String(body.status)

  const { data, error } = await supabase.from('dresses')
    .update({ ...allowed, updated_at: new Date().toISOString() })
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

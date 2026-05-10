import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const status = req.nextUrl.searchParams.get('status')
  let q = supabase.from('rental_orders')
    .select('*, dresses(name, code, color, size, category), customers(name, phone)')
    .eq('company_id', COMPANY_ID)
    .order('start_date', { ascending: true })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  // 1. Check availability
  const { data: available } = await supabase.rpc('is_dress_available', {
    p_dress_id: body.dress_id,
    p_start: body.start_date,
    p_end: body.end_date,
  })
  if (!available) {
    return NextResponse.json({ error: 'الفستان محجوز في هذه الفترة، اختر تاريخاً آخر' }, { status: 409 })
  }

  // 2. Generate order number
  const { data: orderNum } = await supabase.rpc('generate_rental_number', { p_company_id: COMPANY_ID })

  // 3. Create order
  const { data, error } = await supabase.from('rental_orders').insert({
    company_id:    COMPANY_ID,
    order_number:  orderNum,
    dress_id:      body.dress_id,
    customer_id:   body.customer_id || null,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone || null,
    start_date:    body.start_date,
    end_date:      body.end_date,
    rental_price:  Number(body.rental_price),
    total_price:   Number(body.total_price),
    deposit:       Number(body.deposit),
    deposit_paid:  Number(body.deposit_paid) || 0,
    amount_paid:   Number(body.amount_paid)  || 0,
    notes:         body.notes || null,
    status:        'booked',
  }).select('*, dresses(name, code, color, size)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 4. Mark dress as rented if start_date is today
  const today = new Date().toISOString().slice(0, 10)
  if (body.start_date <= today) {
    await supabase.from('dresses').update({ status: 'rented' }).eq('id', body.dress_id)
    await supabase.from('rental_orders').update({ status: 'active' }).eq('id', data.id)
  }

  return NextResponse.json(data)
}

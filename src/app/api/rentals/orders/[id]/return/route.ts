import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const { condition, extra_fees, deposit_refund, notes } = await req.json()
  const supabase = createClient()

  // Get rental order
  const { data: order, error: orderErr } = await supabase
    .from('rental_orders').select('*, dresses(id)').eq('id', params.id).eq('company_id', COMPANY_ID).single()
  if (orderErr || !order) return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
  if (!['active', 'booked', 'late'].includes(order.status))
    return NextResponse.json({ error: 'لا يمكن إرجاع هذا الحجز' }, { status: 400 })

  // Create return record
  const { error: retErr } = await supabase.from('rental_returns').insert({
    company_id:     COMPANY_ID,
    rental_id:      params.id,
    condition:      String(condition || 'good'),
    extra_fees:     Number(extra_fees)     || 0,
    deposit_refund: Number(deposit_refund) || 0,
    notes:          notes || null,
  })
  if (retErr) return NextResponse.json({ error: retErr.message }, { status: 500 })

  // Update rental order to returned
  await supabase.from('rental_orders').update({ status: 'returned', updated_at: new Date().toISOString() }).eq('id', params.id)

  // Free the dress
  const dress = order.dresses as any
  if (dress?.id) {
    await supabase.from('dresses').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', dress.id)
  }

  return NextResponse.json({ success: true })
}

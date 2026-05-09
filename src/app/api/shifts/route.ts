import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('opened_at', { ascending: false })
    .limit(50)
  return NextResponse.json(data || [])
}

// Open shift
export async function POST(req: NextRequest) {
  try {
    const COMPANY_ID = getCompanyId()
    const { cashier_name, opening_cash } = await req.json()
    if (!cashier_name) return NextResponse.json({ error: 'اسم الكاشير مطلوب' }, { status: 400 })

    const supabase = createClient()

    // Check no open shift
    const { data: open } = await supabase
      .from('shifts')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'open')
      .single()

    if (open) return NextResponse.json({ error: 'هناك وردية مفتوحة بالفعل' }, { status: 400 })

    const { data: shift, error } = await supabase
      .from('shifts')
      .insert({ company_id: COMPANY_ID, cashier_name, opening_cash: opening_cash || 0 })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, shift })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Close shift
export async function PATCH(req: NextRequest) {
  try {
    const COMPANY_ID = getCompanyId()
    const { shift_id, closing_cash, notes } = await req.json()
    const supabase = createClient()

    const { data: shift } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', shift_id)
      .eq('company_id', COMPANY_ID)
      .single()

    if (!shift) return NextResponse.json({ error: 'الوردية غير موجودة' }, { status: 404 })

    // Calculate sales in this shift period
    const { data: sales } = await supabase
      .from('sales')
      .select('total, payment_status')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'completed')
      .gte('created_at', shift.opened_at)

    const totalSales = sales?.reduce((s, x) => s + x.total, 0) || 0
    const expectedCash = shift.opening_cash + totalSales
    const difference = (closing_cash || 0) - expectedCash

    await supabase.from('shifts').update({
      closing_cash: closing_cash || 0,
      expected_cash: expectedCash,
      difference,
      total_sales: totalSales,
      sales_count: sales?.length || 0,
      status: 'closed',
      closed_at: new Date().toISOString(),
      notes: notes || null,
    }).eq('id', shift_id)

    return NextResponse.json({ success: true, total_sales: totalSales, expected_cash: expectedCash, difference })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

// POST /api/customers/[id]/payment — record a debt payment
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const COMPANY_ID = await getCompanyId()

  try {
    const { amount, method, notes } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'المبلغ غير صحيح' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, balance')
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
      .single()

    if (custErr || !customer) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }

    const paid = Math.min(amount, customer.balance)
    const newBalance = Math.max(0, customer.balance - paid)

    // Update customer balance
    await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', id)

    // Record transaction
    await supabase
      .from('customer_transactions')
      .insert({
        company_id: COMPANY_ID,
        customer_id: id,
        type: 'payment',
        amount: -paid,
        balance_after: newBalance,
        notes: notes || `دفعة بـ ${method || 'نقدي'}`,
      })

    return NextResponse.json({
      success: true,
      paid,
      new_balance: newBalance,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
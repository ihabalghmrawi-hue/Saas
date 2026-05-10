import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body       = await req.json()
    const COMPANY_ID = getCompanyId()
    const supabase   = createClient()

    const allowed: Record<string, unknown> = {}
    if ('amount' in body)          allowed.amount         = Number(body.amount) || 0
    if ('description' in body)     allowed.description    = body.description || null
    if ('expense_date' in body)    allowed.expense_date   = body.expense_date || null
    if ('category_id' in body)     allowed.category_id    = body.category_id || null
    if ('payment_method' in body)  allowed.payment_method = body.payment_method || 'cash'
    if ('notes' in body)           allowed.notes          = body.notes || null

    const { data: expense, error } = await supabase.from('expenses')
      .update(allowed)
      .eq('id', params.id)
      .eq('company_id', COMPANY_ID)
      .select().single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ expense })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const COMPANY_ID = getCompanyId()
    const supabase   = createClient()
    await supabase.from('expenses').delete()
      .eq('id', params.id)
      .eq('company_id', COMPANY_ID)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

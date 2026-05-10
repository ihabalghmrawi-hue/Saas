import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  // Explicit whitelist — prevents boolean/string values reaching numeric columns
  const allowed: Record<string, unknown> = {}
  if ('status' in body)         allowed.status         = String(body.status)
  if ('customer_name' in body)  allowed.customer_name  = String(body.customer_name || '')
  if ('customer_phone' in body) allowed.customer_phone = body.customer_phone || null
  if ('start_date' in body)     allowed.start_date     = String(body.start_date)
  if ('end_date' in body)       allowed.end_date       = String(body.end_date)
  if ('rental_price' in body)   allowed.rental_price   = Number(body.rental_price) || 0
  if ('total_price' in body)    allowed.total_price    = Number(body.total_price) || 0
  if ('deposit' in body)        allowed.deposit        = Number(body.deposit) || 0
  if ('deposit_paid' in body)   allowed.deposit_paid   = Number(body.deposit_paid) || 0
  if ('amount_paid' in body)    allowed.amount_paid    = Number(body.amount_paid) || 0
  if ('notes' in body)          allowed.notes          = body.notes || null

  const { data, error } = await supabase.from('rental_orders')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', params.id).eq('company_id', COMPANY_ID).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

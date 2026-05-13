import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const COMPANY_ID = await getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  const allowed: Record<string, unknown> = {}
  if ('name' in body)          allowed.name          = String(body.name || '')
  if ('type' in body)          allowed.type          = String(body.type)
  if ('base_price' in body)    allowed.base_price    = Number(body.base_price) || 0
  if ('deposit_type' in body)  allowed.deposit_type  = String(body.deposit_type)
  if ('deposit_value' in body) allowed.deposit_value = Number(body.deposit_value) || 0
  if ('min_days' in body)      allowed.min_days      = body.min_days != null ? Number(body.min_days) : null
  if ('max_days' in body)      allowed.max_days      = body.max_days != null ? Number(body.max_days) : null
  if ('weekend' in body)       allowed.weekend       = body.weekend ?? null
  if ('active' in body)        allowed.active        = Boolean(body.active)

  const { data, error } = await supabase
    .from('rental_pricing_rules')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', COMPANY_ID)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  await supabase.from('rental_pricing_rules').delete().eq('id', id).eq('company_id', COMPANY_ID)
  return NextResponse.json({ success: true })
}

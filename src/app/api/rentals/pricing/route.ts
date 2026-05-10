import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rental_pricing_rules')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  const { data, error } = await supabase
    .from('rental_pricing_rules')
    .insert({
      company_id:    COMPANY_ID,
      name:          String(body.name || ''),
      type:          body.type          || 'per_day',
      base_price:    Number(body.base_price)    || 0,
      deposit_type:  body.deposit_type  || 'fixed',
      deposit_value: Number(body.deposit_value) || 0,
      min_days:      body.min_days  != null ? Number(body.min_days)  : null,
      max_days:      body.max_days  != null ? Number(body.max_days)  : null,
      weekend:       body.weekend   ?? null,
      active:        body.active    !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

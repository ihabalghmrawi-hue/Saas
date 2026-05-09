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
    .insert({ ...body, company_id: COMPANY_ID })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

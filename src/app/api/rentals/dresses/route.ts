import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const status = req.nextUrl.searchParams.get('status')
  let q = supabase.from('dresses').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const body = await req.json()
  const supabase = createClient()

  const { data, error } = await supabase.from('dresses').insert({
    company_id:   COMPANY_ID,
    name:         String(body.name || ''),
    code:         body.code         || null,
    category:     body.category     || 'other',
    size:         body.size         || null,
    color:        body.color        || null,
    description:  body.description  || null,
    rental_price: Number(body.rental_price) || 0,
    deposit:      Number(body.deposit)      || 0,
    status:       'available',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

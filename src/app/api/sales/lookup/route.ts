import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function GET(req: NextRequest) {
  const invoice = req.nextUrl.searchParams.get('invoice')
  if (!invoice) return NextResponse.json(null, { status: 400 })

  const supabase = createClient()

  const { data, error } = await supabase
    .from('sales')
    .select('*, customers(id, name, balance), sale_items(*, products(name, name_ar))')
    .eq('company_id', COMPANY_ID)
    .eq('invoice_number', invoice.toUpperCase())
    .neq('status', 'returned')
    .single()

  if (error || !data) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(data)
}

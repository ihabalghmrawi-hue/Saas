import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
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

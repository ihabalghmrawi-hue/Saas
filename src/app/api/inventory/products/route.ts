import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createClient()

    const { data: product, error } = await supabase
      .from('products')
      .insert(body)
      .select('*, product_categories(name, name_ar, color), units(name, name_ar, abbreviation), inventory(quantity, warehouse_id)')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

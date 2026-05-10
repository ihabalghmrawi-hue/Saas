import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  try {
    const body       = await req.json()
    const COMPANY_ID = getCompanyId()
    const supabase   = createClient()

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        company_id:      COMPANY_ID,
        name:            String(body.name || ''),
        name_ar:         body.name_ar         || null,
        sku:             body.sku             || null,
        barcode:         body.barcode         || null,
        cost_price:      Number(body.cost_price)      || 0,
        sale_price:      Number(body.sale_price)       || 0,
        wholesale_price: Number(body.wholesale_price)  || 0,
        min_stock_level: Number(body.min_stock_level)  || 0,
        tax_rate:        Number(body.tax_rate)         || 0,
        category_id:     body.category_id    || null,
        unit_id:         body.unit_id        || null,
        type:            body.type           || 'product',
        track_inventory: Boolean(body.track_inventory !== false),
        is_active:       Boolean(body.is_active !== false),
        description:     body.description    || null,
        expiry_date:     body.expiry_date    || null,
        batch_number:    body.batch_number   || null,
        min_qty:         Number(body.min_qty) || 1,
        sizes:           body.sizes          || null,
        colors:          body.colors         || null,
      })
      .select('*, product_categories(name, name_ar, color), units(name, name_ar, abbreviation), inventory(quantity, warehouse_id)')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

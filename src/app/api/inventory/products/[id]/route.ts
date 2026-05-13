import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }     = await params
    const body       = await req.json()
    const COMPANY_ID = await getCompanyId()
    const supabase   = createClient()

    const allowed: Record<string, unknown> = {}
    if ('name' in body)            allowed.name            = String(body.name || '')
    if ('name_ar' in body)         allowed.name_ar         = body.name_ar || null
    if ('sku' in body)             allowed.sku             = body.sku || null
    if ('barcode' in body)         allowed.barcode         = body.barcode || null
    if ('cost_price' in body)      allowed.cost_price      = Number(body.cost_price) || 0
    if ('sale_price' in body)      allowed.sale_price      = Number(body.sale_price) || 0
    if ('wholesale_price' in body) allowed.wholesale_price = Number(body.wholesale_price) || 0
    if ('min_stock_level' in body) allowed.min_stock_level = Number(body.min_stock_level) || 0
    if ('tax_rate' in body)        allowed.tax_rate        = Number(body.tax_rate) || 0
    if ('category_id' in body)     allowed.category_id     = body.category_id || null
    if ('unit_id' in body)         allowed.unit_id         = body.unit_id || null
    if ('type' in body)            allowed.type            = String(body.type)
    if ('track_inventory' in body) allowed.track_inventory = Boolean(body.track_inventory)
    if ('is_active' in body)       allowed.is_active       = Boolean(body.is_active)
    if ('description' in body)     allowed.description     = body.description || null
    if ('expiry_date' in body)     allowed.expiry_date     = body.expiry_date || null
    if ('batch_number' in body)    allowed.batch_number    = body.batch_number || null
    if ('min_qty' in body)         allowed.min_qty         = Number(body.min_qty) || 1
    if ('sizes' in body)           allowed.sizes           = body.sizes || null
    if ('colors' in body)          allowed.colors          = body.colors || null

    const { data: product, error } = await supabase
      .from('products')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
      .select('*, product_categories(name, name_ar, color), units(name, name_ar, abbreviation), inventory(quantity, warehouse_id)')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }     = await params
    const COMPANY_ID = await getCompanyId()
    const supabase   = createClient()
    const { error }  = await supabase.from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

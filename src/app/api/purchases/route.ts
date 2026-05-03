import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, supplier_id, warehouse_id, purchase_date, items, subtotal, total, paid_amount, due_amount, payment_status, notes } = body

    const supabase = createClient()

    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', { p_company_id: company_id, p_prefix: 'PUR' })
    const invoice_number = invoiceNumber || `PUR-${Date.now()}`

    const { data: purchase, error } = await supabase.from('purchases').insert({
      company_id,
      invoice_number,
      supplier_id: supplier_id || null,
      warehouse_id: warehouse_id || null,
      purchase_date,
      subtotal,
      total,
      paid_amount: paid_amount || 0,
      due_amount: due_amount || 0,
      payment_status: payment_status || 'paid',
      status: 'received',
      notes: notes || null,
    }).select('*, suppliers(name)').single()

    if (error) throw new Error(error.message)

    // Insert items
    const purchaseItems = items.map((item: any, idx: number) => ({
      purchase_id: purchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total: item.total,
      line_number: idx + 1,
    }))

    await supabase.from('purchase_items').insert(purchaseItems)

    // Update inventory for each item
    if (warehouse_id) {
      for (const item of items) {
        if (!item.product_id) continue
        const { data: existing } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('warehouse_id', warehouse_id)
          .is('variant_id', null)
          .single()

        if (existing) {
          await supabase.from('inventory').update({ quantity: existing.quantity + item.quantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert({ product_id: item.product_id, warehouse_id, company_id, quantity: item.quantity, reserved_quantity: 0 })
        }

        // Update product cost price
        await supabase.from('products').update({ cost_price: item.unit_cost }).eq('id', item.product_id)
      }
    }

    // Update supplier balance if unpaid
    if (supplier_id && due_amount > 0) {
      const { data: sup } = await supabase.from('suppliers').select('balance').eq('id', supplier_id).single()
      if (sup) await supabase.from('suppliers').update({ balance: (sup.balance || 0) + due_amount }).eq('id', supplier_id)
    }

    return NextResponse.json({ purchase, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

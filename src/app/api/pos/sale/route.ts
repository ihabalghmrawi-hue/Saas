import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      company_id, warehouse_id, customer_id,
      items, subtotal, discount_percent, discount_amount,
      tax_amount, total, paid_amount, payment_method, notes
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد منتجات في السلة' }, { status: 400 })
    }

    const supabase = createClient()

    // Generate invoice number
    const { data: invoiceData } = await supabase
      .rpc('generate_invoice_number', { p_company_id: company_id, p_prefix: 'INV' })

    const invoice_number = invoiceData || `INV-${Date.now()}`
    const due_amount = Math.max(0, total - paid_amount)
    const payment_status = paid_amount >= total ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid'
    const change_amount = Math.max(0, paid_amount - total)

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id,
        invoice_number,
        customer_id: customer_id || null,
        warehouse_id: warehouse_id || null,
        subtotal,
        discount_percent,
        discount_amount,
        tax_amount,
        total,
        paid_amount,
        change_amount,
        due_amount,
        payment_status,
        status: 'completed',
        notes: notes || null,
      })
      .select()
      .single()

    if (saleError) throw new Error(saleError.message)

    // Create sale items
    const saleItems = items.map((item: any, idx: number) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price: item.cost_price || 0,
      discount_percent: item.discount_percent || 0,
      discount_amount: item.discount_amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      total: item.total,
      line_number: idx + 1,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) throw new Error(itemsError.message)

    // Create payment record
    if (paid_amount > 0) {
      await supabase.from('sale_payments').insert({
        sale_id: sale.id,
        company_id,
        method: payment_method,
        amount: paid_amount,
      })
    }

    // Update inventory for each item
    if (warehouse_id) {
      for (const item of items) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('warehouse_id', warehouse_id)
          .is('variant_id', null)
          .single()

        if (existing) {
          await supabase.from('inventory')
            .update({ quantity: existing.quantity - item.quantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        }
      }
    }

    // Update customer balance if credit sale
    if (customer_id && due_amount > 0) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', customer_id).single()
      if (cust) {
        await supabase.from('customers').update({ balance: (cust.balance || 0) + due_amount }).eq('id', customer_id)
      }
    }

    return NextResponse.json({ success: true, invoice_number, sale_id: sale.id })
  } catch (error: any) {
    console.error('POS sale error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

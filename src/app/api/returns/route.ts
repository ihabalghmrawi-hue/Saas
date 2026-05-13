import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  try {
    const COMPANY_ID = await getCompanyId()
    const body = await req.json()
    const { sale_id, items, refund_method, reason, notes, warehouse_id } = body

    if (!sale_id || !items?.length) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch original sale
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('*, customers(id, balance)')
      .eq('id', sale_id)
      .eq('company_id', COMPANY_ID)
      .single()

    if (saleErr || !sale) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    const total = items.reduce((s: number, i: any) => s + i.total, 0)
    const subtotal = total

    // Generate return number
    const { data: retNum } = await supabase.rpc('generate_return_number', { p_company_id: COMPANY_ID })
    const return_number = retNum || `RET-${Date.now()}`

    // Create return record
    const { data: ret, error: retErr } = await supabase
      .from('returns')
      .insert({
        company_id: COMPANY_ID,
        return_number,
        sale_id,
        customer_id: sale.customer_id || null,
        warehouse_id: warehouse_id || sale.warehouse_id || null,
        subtotal,
        total,
        refund_method,
        refund_amount: total,
        status: 'completed',
        reason: reason || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (retErr) throw new Error(retErr.message)

    // Create return items
    await supabase.from('return_items').insert(
      items.map((i: any) => ({
        return_id: ret.id,
        sale_item_id: i.sale_item_id || null,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
        reason: i.reason || null,
      }))
    )

    // Return inventory
    const wh = warehouse_id || sale.warehouse_id
    if (wh) {
      for (const item of items) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('warehouse_id', wh)
          .single()

        if (inv) {
          await supabase.from('inventory')
            .update({ quantity: inv.quantity + item.quantity, updated_at: new Date().toISOString() })
            .eq('id', inv.id)
        } else {
          await supabase.from('inventory').insert({
            company_id: COMPANY_ID,
            product_id: item.product_id,
            warehouse_id: wh,
            quantity: item.quantity,
          })
        }

        // Log movement
        await supabase.from('inventory_movements').insert({
          company_id: COMPANY_ID,
          product_id: item.product_id,
          warehouse_id: wh,
          type: 'return_sale',
          quantity: item.quantity,
          quantity_before: inv?.quantity ?? 0,
          quantity_after: (inv?.quantity ?? 0) + item.quantity,
          unit_cost: item.unit_price,
          reference_id: ret.id,
          reference_type: 'return',
        })
      }
    }

    // Handle refund based on method
    if (refund_method === 'credit' && sale.customer_id) {
      // Reduce customer debt
      const customer = sale.customers as any
      const newBalance = Math.max(0, (customer?.balance || 0) - total)
      await supabase.from('customers').update({ balance: newBalance }).eq('id', sale.customer_id)

      await supabase.from('customer_transactions').insert({
        company_id: COMPANY_ID,
        customer_id: sale.customer_id,
        type: 'return',
        sale_id,
        amount: -total,
        balance_after: newBalance,
        notes: `مرتجع ${return_number}`,
      })
    }

    // Update original sale status
    await supabase.from('sales')
      .update({ status: 'returned', payment_status: 'refunded' })
      .eq('id', sale_id)

    await logAudit({
      action: 'return.created',
      entityType: 'return',
      entityId: ret.id,
      newValue: { return_number, sale_id, total, refund_method },
    })

    return NextResponse.json({ success: true, return_number, return_id: ret.id })
  } catch (e: any) {
    console.error('Return error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const COMPANY_ID = await getCompanyId()
    const supabase = createClient()
    const { data } = await supabase
      .from('returns')
      .select('*, sales(invoice_number), customers(name)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(100)

    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

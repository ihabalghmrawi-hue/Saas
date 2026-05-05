import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

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
    const due_amount     = Math.max(0, total - paid_amount)
    const payment_status = paid_amount >= total ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid'
    const change_amount  = Math.max(0, paid_amount - total)

    // ── 1. Create sale ────────────────────────────────────────────────────────
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id,
        invoice_number,
        customer_id:      customer_id || null,
        warehouse_id:     warehouse_id || null,
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
        notes:  notes || null,
      })
      .select()
      .single()

    if (saleError) throw new Error(saleError.message)

    // ── 2. Create sale items ──────────────────────────────────────────────────
    const saleItems = items.map((item: any, idx: number) => ({
      sale_id:          sale.id,
      product_id:       item.product_id,
      variant_id:       item.variant_id || null,
      quantity:         item.quantity,
      unit_price:       item.unit_price,
      cost_price:       item.cost_price || 0,
      discount_percent: item.discount_percent || 0,
      discount_amount:  item.discount_amount || 0,
      tax_rate:         item.tax_rate || 0,
      tax_amount:       item.tax_amount || 0,
      total:            item.total,
      line_number:      idx + 1,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) throw new Error(itemsError.message)

    // ── 3. Create payment record ──────────────────────────────────────────────
    if (paid_amount > 0) {
      await supabase.from('sale_payments').insert({
        sale_id:    sale.id,
        company_id,
        method:     payment_method,
        amount:     paid_amount,
      })
    }

    // ── 4. Update inventory ───────────────────────────────────────────────────
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

    // ── 5. Update wallet balance (cash tracking) ──────────────────────────────
    if (paid_amount > 0) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle()

      if (wallet) {
        const newBalance = Number(wallet.balance || 0) + paid_amount
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)

        // Record wallet transaction
        await supabase.from('transactions').insert({
          company_id,
          wallet_id:        wallet.id,
          type:             'income',
          amount:           paid_amount,
          description:      `مبيعات - فاتورة ${invoice_number}`,
          reference_id:     sale.id,
          reference_type:   'sale',
          payment_method,
          transaction_date: new Date().toISOString().slice(0, 10),
          status:           'completed',
        })
      }
    }

    // ── 6. Create accounting journal entry ────────────────────────────────────
    await createSaleJournalEntry(supabase, {
      company_id,
      sale_id:        sale.id,
      invoice_number,
      total,
      paid_amount,
      due_amount,
      payment_method,
    })

    // ── 7. Update customer balance ────────────────────────────────────────────
    if (customer_id) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', customer_id).single()
      if (cust) {
        const newBalance = (cust.balance || 0) + due_amount
        await supabase.from('customers').update({ balance: newBalance }).eq('id', customer_id)

        await supabase.from('customer_transactions').insert({
          company_id,
          customer_id,
          type:          'sale',
          sale_id:       sale.id,
          amount:        due_amount,
          balance_after: newBalance,
          notes:         `فاتورة ${invoice_number}`,
        })
      }
    }

    await logAudit({
      action:     'sale.created',
      entityType: 'sale',
      entityId:   sale.id,
      newValue:   { invoice_number, total, customer_id, payment_method },
    })

    return NextResponse.json({ success: true, invoice_number, sale_id: sale.id })
  } catch (error: any) {
    console.error('POS sale error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Accounting journal entry for a sale ──────────────────────────────────────
async function createSaleJournalEntry(supabase: any, opts: {
  company_id: string
  sale_id: string
  invoice_number: string
  total: number
  paid_amount: number
  due_amount: number
  payment_method: string
}) {
  try {
    const { company_id, sale_id, invoice_number, total, paid_amount, due_amount, payment_method } = opts

    // Find accounts (or skip silently if chart of accounts isn't set up)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, type')
      .eq('company_id', company_id)
      .in('code', ['1001', '1100', '4001'])  // Cash, Receivables, Revenue

    if (!accounts || accounts.length === 0) return  // Accounting not set up yet

    const cashAcc       = accounts.find((a: any) => a.code === '1001')
    const receivableAcc = accounts.find((a: any) => a.code === '1100')
    const revenueAcc    = accounts.find((a: any) => a.code === '4001')
    if (!revenueAcc) return

    // Create journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id,
        date:        new Date().toISOString().slice(0, 10),
        description: `مبيعات - فاتورة ${invoice_number}`,
        reference:   invoice_number,
        source:      'pos',
        source_id:   sale_id,
        is_posted:   true,
      })
      .select('id')
      .single()

    if (entryError || !entry) return

    const lines: any[] = []

    // Debit cash/receivables
    if (paid_amount > 0 && cashAcc) {
      lines.push({ journal_entry_id: entry.id, account_id: cashAcc.id, debit: paid_amount,  credit: 0,         description: `نقد - ${invoice_number}` })
    }
    if (due_amount > 0 && receivableAcc) {
      lines.push({ journal_entry_id: entry.id, account_id: receivableAcc.id, debit: due_amount, credit: 0, description: `ذمم مدينة - ${invoice_number}` })
    }
    // Credit revenue
    lines.push({ journal_entry_id: entry.id, account_id: revenueAcc.id, debit: 0, credit: total, description: `إيراد مبيعات - ${invoice_number}` })

    if (lines.length > 0) {
      await supabase.from('journal_entry_lines').insert(lines)
    }
  } catch (e) {
    console.error('Journal entry error (non-fatal):', e)
    // Non-fatal — don't block the sale
  }
}

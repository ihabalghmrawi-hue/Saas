import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, supplier_id, warehouse_id, purchase_date, items, subtotal, total, paid_amount, due_amount, payment_status, notes } = body

    const supabase = createClient()

    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', { p_company_id: company_id, p_prefix: 'PUR' })
    const invoice_number = invoiceNumber || `PUR-${Date.now()}`

    // ── 1. Create purchase record ─────────────────────────────────────────────
    const { data: purchase, error } = await supabase.from('purchases').insert({
      company_id,
      invoice_number,
      supplier_id:    supplier_id || null,
      warehouse_id:   warehouse_id || null,
      purchase_date,
      subtotal,
      total,
      paid_amount:    paid_amount    || 0,
      due_amount:     due_amount     || 0,
      payment_status: payment_status || 'paid',
      status:         'received',
      notes:          notes || null,
    }).select('*, suppliers(name)').single()

    if (error) throw new Error(error.message)

    // ── 2. Insert purchase items ──────────────────────────────────────────────
    const purchaseItems = items.map((item: any, idx: number) => ({
      purchase_id: purchase.id,
      product_id:  item.product_id,
      quantity:    item.quantity,
      unit_cost:   item.unit_cost,
      total:       item.total,
      line_number: idx + 1,
    }))
    await supabase.from('purchase_items').insert(purchaseItems)

    // ── 3. Update inventory ───────────────────────────────────────────────────
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

    // ── 4. Update wallet balance ──────────────────────────────────────────────
    const actualPaid = paid_amount || 0
    if (actualPaid > 0) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle()

      if (wallet) {
        const newBalance = Number(wallet.balance || 0) - actualPaid
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)

        await supabase.from('transactions').insert({
          company_id,
          wallet_id:        wallet.id,
          type:             'expense',
          amount:           actualPaid,
          description:      `مشتريات - فاتورة ${invoice_number}`,
          reference_id:     purchase.id,
          reference_type:   'purchase',
          payment_method:   'cash',
          transaction_date: new Date().toISOString().slice(0, 10),
          status:           'completed',
        })
      }
    }

    // ── 5. Create accounting journal entry ────────────────────────────────────
    await createPurchaseJournalEntry(supabase, {
      company_id,
      purchase_id:    purchase.id,
      invoice_number,
      total,
      paid_amount:    actualPaid,
      due_amount:     due_amount || 0,
    })

    // ── 6. Update supplier balance ────────────────────────────────────────────
    if (supplier_id && (due_amount || 0) > 0) {
      const { data: sup } = await supabase.from('suppliers').select('balance').eq('id', supplier_id).single()
      if (sup) await supabase.from('suppliers').update({ balance: (sup.balance || 0) + (due_amount || 0) }).eq('id', supplier_id)
    }

    return NextResponse.json({ purchase, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── Accounting journal entry for a purchase ───────────────────────────────────
async function createPurchaseJournalEntry(supabase: any, opts: {
  company_id: string
  purchase_id: string
  invoice_number: string
  total: number
  paid_amount: number
  due_amount: number
}) {
  try {
    const { company_id, purchase_id, invoice_number, total, paid_amount, due_amount } = opts

    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, type')
      .eq('company_id', company_id)
      .in('code', ['1001', '2001', '5001'])  // Cash, Payables, COGS/Inventory expense

    if (!accounts || accounts.length === 0) return

    const cashAcc      = accounts.find((a: any) => a.code === '1001')
    const payableAcc   = accounts.find((a: any) => a.code === '2001')
    const inventoryAcc = accounts.find((a: any) => a.code === '5001')
    if (!inventoryAcc) return

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id,
        date:        new Date().toISOString().slice(0, 10),
        description: `مشتريات - فاتورة ${invoice_number}`,
        reference:   invoice_number,
        source:      'purchase',
        source_id:   purchase_id,
        is_posted:   true,
      })
      .select('id')
      .single()

    if (entryError || !entry) return

    const lines: any[] = []

    // Debit inventory/COGS
    lines.push({ journal_entry_id: entry.id, account_id: inventoryAcc.id, debit: total, credit: 0, description: `بضاعة - ${invoice_number}` })

    // Credit cash (paid portion)
    if (paid_amount > 0 && cashAcc) {
      lines.push({ journal_entry_id: entry.id, account_id: cashAcc.id, debit: 0, credit: paid_amount, description: `نقد - ${invoice_number}` })
    }
    // Credit payables (unpaid portion)
    if (due_amount > 0 && payableAcc) {
      lines.push({ journal_entry_id: entry.id, account_id: payableAcc.id, debit: 0, credit: due_amount, description: `ذمم دائنة - ${invoice_number}` })
    }

    if (lines.length > 0) {
      await supabase.from('journal_entry_lines').insert(lines)
    }
  } catch (e) {
    console.error('Journal entry error (non-fatal):', e)
  }
}

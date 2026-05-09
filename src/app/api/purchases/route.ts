import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postPurchaseJournal as postPurchaseEntry, updateWallet } from '@/lib/accounting'
import { recordInventoryMovement } from '@/lib/inventory'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    const body = await req.json()
    const {
      company_id, supplier_id, warehouse_id,
      purchase_date, items, subtotal, total,
      paid_amount, due_amount, payment_status, notes, wallet_id,
    } = body

    if (!company_id) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: 'لا توجد منتجات في الفاتورة' }, { status: 400 })
    if (!total || total <= 0) return NextResponse.json({ error: 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' }, { status: 400 })

    // ── Invoice number ─────────────────────────────────────────────────────────
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', {
      p_company_id: company_id, p_prefix: 'PUR',
    })
    const invoice_number = invoiceNumber || `PUR-${Date.now()}`

    const actualPaid = paid_amount || 0
    const actualDue  = due_amount  || Math.max(0, total - actualPaid)

    // ── 1. Create purchase record ──────────────────────────────────────────────
    const { data: purchase, error } = await supabase.from('purchases').insert({
      company_id,
      invoice_number,
      supplier_id:    supplier_id    || null,
      warehouse_id:   warehouse_id   || null,
      purchase_date:  purchase_date  || new Date().toISOString().slice(0, 10),
      subtotal:       subtotal       || total,
      total,
      paid_amount:    actualPaid,
      due_amount:     actualDue,
      payment_status: payment_status || (actualPaid >= total ? 'paid' : actualPaid > 0 ? 'partial' : 'unpaid'),
      status:         'received',
      notes:          notes || null,
    }).select('*, suppliers(name)').single()

    if (error) {
      return NextResponse.json({
        error: `فشل إنشاء فاتورة الشراء: ${error.message}`,
        field: 'purchase',
      }, { status: 500 })
    }

    // ── 2. Purchase items ──────────────────────────────────────────────────────
    const purchaseItems = items.map((item: any, idx: number) => ({
      purchase_id: purchase.id,
      product_id:  item.product_id,
      quantity:    item.quantity,
      unit_cost:   item.unit_cost,
      total:       item.total,
      line_number: idx + 1,
    }))

    const { error: itemsErr } = await supabase.from('purchase_items').insert(purchaseItems)
    if (itemsErr) {
      await supabase.from('purchases').delete().eq('id', purchase.id)
      return NextResponse.json({
        error: `فشل إضافة المنتجات: ${itemsErr.message}`,
        field: 'items',
      }, { status: 500 })
    }

    // ── 3. Update inventory + record movements ────────────────────────────────
    const inventoryErrors: string[] = []
    if (warehouse_id) {
      for (const item of items) {
        if (!item.product_id) continue
        const result = await recordInventoryMovement(supabase, {
          company_id,
          product_id:     item.product_id,
          warehouse_id,
          type:           'purchase',
          quantity:       item.quantity,
          reference_id:   purchase.id,
          reference_type: 'purchase',
        })
        if (!result.ok) inventoryErrors.push(item.product_id)

        // Update product cost price to latest
        await supabase.from('products').update({ cost_price: item.unit_cost }).eq('id', item.product_id)
      }
    }

    // ── 4. Accounting: journal entry ───────────────────────────────────────────
    const admin = createAdminClient()
    const journalResult = await postPurchaseEntry(admin, {
      company_id,
      invoice_number,
      purchase_id:  purchase.id,
      total,
      paid_amount:  actualPaid,
      due_amount:   actualDue,
      wallet_id:    wallet_id || undefined,
    })
    if (!journalResult.ok) {
      console.error('Purchase journal entry failed:', journalResult.error)
      await supabase.from('audit_logs').insert({
        company_id,
        action:      'accounting.error',
        entity_type: 'purchase',
        entity_id:   purchase.id,
        new_value:   { error: journalResult.error, invoice_number },
        severity:    'warning',
      }).then(() => {})
    }

    // ── 5. Wallet update ───────────────────────────────────────────────────────
    if (actualPaid > 0) {
      const walletResult = await updateWallet(
        admin, company_id,
        -actualPaid,   // negative = outgoing cash
        `مشتريات - فاتورة ${invoice_number}`,
        purchase.id, 'purchase', 'cash', wallet_id || undefined,
      )
      if (!walletResult.ok) {
        console.error('Wallet update failed:', walletResult.error)
      }
    }

    // ── 6. Supplier balance ────────────────────────────────────────────────────
    if (supplier_id && actualDue > 0) {
      const { data: sup } = await supabase.from('suppliers').select('balance').eq('id', supplier_id).single()
      if (sup) {
        await supabase.from('suppliers').update({ balance: (sup.balance || 0) + actualDue }).eq('id', supplier_id)
      }
    }

    return NextResponse.json({
      success:            true,
      purchase,
      invoice_number,
      accounts_created:   journalResult.accounts_created,
      journal_ok:         journalResult.ok,
      journal_warning:    journalResult.ok ? undefined : journalResult.error,
      inventory_warnings: inventoryErrors.length > 0 ? `تعذّر تحديث المخزون لـ ${inventoryErrors.length} منتج` : undefined,
    })

  } catch (e: any) {
    console.error('Purchase error:', e)
    return NextResponse.json({ error: `خطأ داخلي: ${e.message}` }, { status: 500 })
  }
}

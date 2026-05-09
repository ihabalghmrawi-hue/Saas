import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { postSaleJournal as postSaleEntry, updateWallet } from '@/lib/accounting'
import { recordInventoryMovement } from '@/lib/inventory'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    const body = await req.json()
    const {
      company_id, warehouse_id, customer_id,
      items, subtotal, discount_percent, discount_amount,
      tax_amount, total, paid_amount, payment_method, notes, wallet_id,
    } = body

    if (!company_id) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: 'لا توجد منتجات في السلة' }, { status: 400 })
    if (total <= 0) return NextResponse.json({ error: 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' }, { status: 400 })

    // ── Generate invoice number ────────────────────────────────────────────────
    const { data: invoiceData } = await supabase
      .rpc('generate_invoice_number', { p_company_id: company_id, p_prefix: 'INV' })
    const invoice_number = invoiceData || `INV-${Date.now()}`

    const due_amount     = Math.max(0, total - (paid_amount || 0))
    const payment_status = (paid_amount || 0) >= total ? 'paid' : (paid_amount || 0) > 0 ? 'partial' : 'unpaid'
    const change_amount  = Math.max(0, (paid_amount || 0) - total)

    // ── 1. Create sale record ──────────────────────────────────────────────────
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id,
        invoice_number,
        customer_id:      customer_id || null,
        warehouse_id:     warehouse_id || null,
        subtotal,
        discount_percent: discount_percent || 0,
        discount_amount:  discount_amount  || 0,
        tax_amount:       tax_amount       || 0,
        total,
        paid_amount:      paid_amount || 0,
        change_amount,
        due_amount,
        payment_status,
        status: 'completed',
        notes:  notes || null,
      })
      .select()
      .single()

    if (saleError) {
      return NextResponse.json({
        error: `فشل إنشاء الفاتورة: ${saleError.message}`,
        field: 'sale',
      }, { status: 500 })
    }

    // ── 2. Create sale items ───────────────────────────────────────────────────
    const saleItems = items.map((item: any, idx: number) => ({
      sale_id:          sale.id,
      product_id:       item.product_id,
      variant_id:       item.variant_id || null,
      quantity:         item.quantity,
      unit_price:       item.unit_price,
      cost_price:       item.cost_price || 0,
      discount_percent: item.discount_percent || 0,
      discount_amount:  item.discount_amount  || 0,
      tax_rate:         item.tax_rate  || 0,
      tax_amount:       item.tax_amount || 0,
      total:            item.total,
      line_number:      idx + 1,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) {
      // Rollback sale
      await supabase.from('sales').delete().eq('id', sale.id)
      return NextResponse.json({
        error: `فشل إضافة المنتجات: ${itemsError.message}`,
        field: 'items',
      }, { status: 500 })
    }

    // ── 3. Record payment ──────────────────────────────────────────────────────
    if ((paid_amount || 0) > 0) {
      await supabase.from('sale_payments').insert({
        sale_id:    sale.id,
        company_id,
        method:     payment_method || 'cash',
        amount:     paid_amount,
      })
    }

    // ── 4. Update inventory + record movements ────────────────────────────────
    const inventoryErrors: string[] = []
    if (warehouse_id) {
      for (const item of items) {
        const result = await recordInventoryMovement(supabase, {
          company_id,
          product_id:     item.product_id,
          warehouse_id,
          type:           'sale',
          quantity:       item.quantity,
          reference_id:   sale.id,
          reference_type: 'sale',
        })
        if (!result.ok) inventoryErrors.push(item.product_id)
      }
    }

    // ── 5. Accounting: journal entry (strict — must succeed) ──────────────────
    const admin = createAdminClient()
    const journalResult = await postSaleEntry(admin, {
      company_id,
      invoice_number,
      sale_id:       sale.id,
      total,
      paid_amount:   paid_amount || 0,
      due_amount,
      tax_amount:    tax_amount || 0,
      wallet_id:     wallet_id || undefined,
      payment_method: payment_method || 'cash',
    })
    if (!journalResult.ok) {
      // Still proceed — sale is recorded — but flag it
      console.error('Journal entry failed:', journalResult.error)
      await supabase.from('audit_logs').insert({
        company_id,
        action:      'accounting.error',
        entity_type: 'sale',
        entity_id:   sale.id,
        new_value:   { error: journalResult.error, invoice_number },
        severity:    'warning',
      }).then(() => {})
    }

    // ── 6. Wallet / cash update ────────────────────────────────────────────────
    if ((paid_amount || 0) > 0) {
      const walletResult = await updateWallet(
        admin, company_id,
        paid_amount,
        `مبيعات - فاتورة ${invoice_number}`,
        sale.id, 'sale', payment_method || 'cash', wallet_id || undefined,
      )
      if (!walletResult.ok) {
        console.error('Wallet update failed:', walletResult.error)
      }
    }

    // ── 7. Customer balance ────────────────────────────────────────────────────
    if (customer_id && due_amount > 0) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', customer_id).single()
      if (cust) {
        const newBalance = (cust.balance || 0) + due_amount
        await supabase.from('customers').update({ balance: newBalance }).eq('id', customer_id)
        await supabase.from('customer_transactions').insert({
          company_id, customer_id,
          type:          'sale',
          sale_id:       sale.id,
          amount:        due_amount,
          balance_after: newBalance,
          notes:         `فاتورة ${invoice_number}`,
        })
      }
    }

    // ── 8. Audit log ──────────────────────────────────────────────────────────
    await logAudit({
      action:     'sale.created',
      entityType: 'sale',
      entityId:   sale.id,
      newValue:   { invoice_number, total, customer_id, payment_method, journal_ok: journalResult.ok },
    })

    return NextResponse.json({
      success:          true,
      invoice_number,
      sale_id:          sale.id,
      accounts_created: journalResult.accounts_created,
      journal_ok:       journalResult.ok,
      journal_warning:  journalResult.ok ? undefined : journalResult.error,
      inventory_warnings: inventoryErrors.length > 0 ? `تعذّر تحديث المخزون لـ ${inventoryErrors.length} منتج` : undefined,
    })

  } catch (error: any) {
    console.error('POS sale error:', error)
    return NextResponse.json({
      error: `خطأ داخلي: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}

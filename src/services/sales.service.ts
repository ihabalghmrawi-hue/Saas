/**
 * Sales Service — business logic layer between API routes and DB.
 * All methods enforce company_id isolation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logAudit }            from '@/lib/audit'

export interface SaleItem {
  product_id: string
  quantity:   number
  unit_price: number
  discount?:  number
}

export interface CreateSaleInput {
  company_id:     string
  customer_id?:   string
  items:          SaleItem[]
  payment_method: string
  payment_status: 'paid' | 'unpaid' | 'partial'
  amount_paid?:   number
  notes?:         string
  shift_id?:      string
  created_by?:    string
}

export interface SaleResult {
  ok:       boolean
  sale_id?: string
  error?:   string
}

export async function createSale(
  supabase:  SupabaseClient,
  input:     CreateSaleInput,
): Promise<SaleResult> {
  const {
    company_id, customer_id, items,
    payment_method, payment_status, amount_paid,
    notes, shift_id, created_by,
  } = input

  if (!items || items.length === 0) {
    return { ok: false, error: 'يجب إضافة منتج واحد على الأقل' }
  }

  // Calculate totals
  let subtotal = 0
  for (const item of items) {
    if (item.quantity <= 0)   return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر' }
    if (item.unit_price < 0) return { ok: false, error: 'السعر لا يمكن أن يكون سالباً' }
    const disc = Math.min(item.discount ?? 0, item.unit_price * item.quantity)
    subtotal += item.quantity * item.unit_price - disc
  }
  const total = Math.round(subtotal * 100) / 100

  // Check inventory availability
  for (const item of items) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('company_id', company_id)
      .eq('product_id', item.product_id)
      .maybeSingle()

    if (!inv || inv.quantity < item.quantity) {
      const { data: prod } = await supabase
        .from('products')
        .select('name')
        .eq('id', item.product_id)
        .maybeSingle()
      return { ok: false, error: `المخزون غير كافٍ للمنتج: ${prod?.name ?? item.product_id}` }
    }
  }

  // Insert sale
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      company_id,
      customer_id:    customer_id ?? null,
      subtotal,
      total,
      payment_method,
      payment_status,
      amount_paid:    amount_paid ?? (payment_status === 'paid' ? total : 0),
      amount_due:     payment_status === 'paid' ? 0 : total - (amount_paid ?? 0),
      notes:          notes ?? null,
      shift_id:       shift_id ?? null,
      created_by:     created_by ?? null,
    })
    .select('id')
    .single()

  if (saleErr || !sale) {
    return { ok: false, error: `فشل إنشاء الفاتورة: ${saleErr?.message}` }
  }

  // Insert sale items + deduct inventory
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)

    await supabase.from('sale_items').insert({
      sale_id:    sale.id,
      product_id: item.product_id,
      quantity:   item.quantity,
      unit_price: item.unit_price,
      discount:   item.discount ?? 0,
      total:      lineTotal,
    })

    // Atomic deduction via DB function
    await supabase.rpc('deduct_inventory', {
      p_company_id: company_id,
      p_product_id: item.product_id,
      p_quantity:   item.quantity,
    })
  }

  await logAudit({
    action:     'sale.created',
    entityType: 'sale',
    entityId:   sale.id,
    companyId:  company_id,
    metadata:   { total, items: items.length, payment_status },
  })

  return { ok: true, sale_id: sale.id }
}

export async function getSalesByCompany(
  supabase:   SupabaseClient,
  company_id: string,
  options: {
    page?:     number
    limit?:    number
    status?:   string
    from?:     string
    to?:       string
    search?:   string
  } = {}
) {
  const { page = 1, limit = 50, status, from, to, search } = options
  const offset = (page - 1) * limit

  let q = supabase
    .from('sales')
    .select('*, customers(name, phone), sale_items(*, products(name))', { count: 'exact' })
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) q = q.eq('payment_status', status)
  if (from)   q = q.gte('created_at', from)
  if (to)     q = q.lte('created_at', to)
  if (search) q = q.ilike('id', `%${search}%`)

  const { data, error, count } = await q
  return { data: data ?? [], error, total: count ?? 0 }
}

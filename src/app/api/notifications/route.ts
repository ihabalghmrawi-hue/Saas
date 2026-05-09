import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const supabase   = createClient()
  const company_id = getCompanyId()
  const today      = new Date().toISOString().slice(0, 10)
  const sevenDays  = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)

  const notifications: Array<{
    id: string; type: string; title: string; body: string
    severity: 'info' | 'warning' | 'error'; created_at: string; read: boolean
  }> = []

  // 1. Low-stock products (qty < 5)
  const { data: lowStock } = await supabase
    .from('inventory')
    .select('quantity, products(name)')
    .eq('company_id', company_id)
    .lt('quantity', 5)
    .gt('quantity', 0)
    .limit(5)

  for (const item of lowStock || []) {
    const name = (item.products as any)?.name || 'منتج'
    notifications.push({
      id:         `low-${name}`,
      type:       'low_stock',
      title:      'مخزون منخفض',
      body:       `${name} — ${item.quantity} وحدة متبقية`,
      severity:   'warning',
      created_at: new Date().toISOString(),
      read:       false,
    })
  }

  // 2. Out-of-stock products
  const { data: outStock } = await supabase
    .from('inventory')
    .select('products(name)')
    .eq('company_id', company_id)
    .lte('quantity', 0)
    .limit(3)

  for (const item of outStock || []) {
    const name = (item.products as any)?.name || 'منتج'
    notifications.push({
      id:         `out-${name}`,
      type:       'out_of_stock',
      title:      'نفاد المخزون',
      body:       `${name} — نفد من المخزون`,
      severity:   'error',
      created_at: new Date().toISOString(),
      read:       false,
    })
  }

  // 3. Unpaid sales (due > 0) from last 7 days
  const { data: unpaidSales, count: unpaidCount } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .eq('payment_status', 'unpaid')
    .gte('created_at', sevenDays)

  if ((unpaidCount ?? 0) > 0) {
    notifications.push({
      id:         'unpaid-sales',
      type:       'unpaid_invoices',
      title:      'فواتير غير مدفوعة',
      body:       `${unpaidCount} فاتورة بانتظار السداد هذا الأسبوع`,
      severity:   'warning',
      created_at: new Date().toISOString(),
      read:       false,
    })
  }

  // 4. Today's sales summary
  const { data: todaySales } = await supabase
    .from('sales')
    .select('total')
    .eq('company_id', company_id)
    .gte('created_at', today)

  const todayTotal = (todaySales || []).reduce((s, r) => s + (r.total || 0), 0)
  if (todaySales && todaySales.length > 0) {
    notifications.push({
      id:         'today-sales',
      type:       'daily_summary',
      title:      'ملخص اليوم',
      body:       `${todaySales.length} فاتورة · إجمالي ${todayTotal.toFixed(2)}`,
      severity:   'info',
      created_at: new Date().toISOString(),
      read:       true,
    })
  }

  // 5. Overdue customer balances
  const { data: overdueCustomers, count: overdueCount } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .gt('balance', 0)
    .eq('is_active', true)

  if ((overdueCount ?? 0) > 0) {
    notifications.push({
      id:         'overdue-customers',
      type:       'customer_debt',
      title:      'ذمم عملاء',
      body:       `${overdueCount} عميل لديهم أرصدة مستحقة`,
      severity:   'info',
      created_at: new Date().toISOString(),
      read:       true,
    })
  }

  return NextResponse.json({
    notifications,
    unread: notifications.filter(n => !n.read).length,
  })
}

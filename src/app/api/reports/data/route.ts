import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30')
  const supabase = createClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: sales },
    { data: saleItems },
    { data: customers },
    { data: products },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total_amount, discount_amount, created_at, payment_status, customer_id')
      .eq('company_id', COMPANY_ID)
      .neq('status', 'cancelled')
      .gte('created_at', since)
      .order('created_at'),

    supabase
      .from('sale_items')
      .select('product_id, quantity, unit_price, unit_cost, total_price, products(name, name_ar, category_id)')
      .eq('company_id', COMPANY_ID)
      .gte('created_at', since),

    supabase
      .from('customers')
      .select('id, name, balance')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),

    supabase
      .from('products')
      .select('id, name, name_ar, cost_price, sale_price, category_id, is_active, inventory(quantity)')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),

    supabase
      .from('expenses')
      .select('amount, created_at')
      .eq('company_id', COMPANY_ID)
      .gte('created_at', since),
  ])

  // ── Daily sales trend ──────────────────────────────────────
  const dailyMap: Record<string, { revenue: number; count: number }> = {}
  ;(sales || []).forEach(s => {
    const day = s.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { revenue: 0, count: 0 }
    dailyMap[day].revenue += Number(s.total_amount)
    dailyMap[day].count += 1
  })
  const dailySales = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day: new Date(day).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      revenue: v.revenue,
      count: v.count,
    }))

  // ── Top products ────────────────────────────────────────────
  const productMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
  ;(saleItems || []).forEach(item => {
    const p = item.products as any
    const key = item.product_id
    if (!productMap[key]) productMap[key] = { name: p?.name_ar || p?.name || '؟', qty: 0, revenue: 0, cost: 0 }
    productMap[key].qty += Number(item.quantity)
    productMap[key].revenue += Number(item.total_price)
    productMap[key].cost += Number(item.unit_cost || 0) * Number(item.quantity)
  })
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))

  // ── Dead stock (sold in period) ─────────────────────────────
  const soldProductIds = new Set(Object.keys(productMap))
  const deadStock = (products || [])
    .filter(p => {
      const stock = (p.inventory as any[])?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0
      return !soldProductIds.has(p.id) && stock > 0
    })
    .slice(0, 10)
    .map(p => ({
      name: p.name_ar || p.name,
      stock: (p.inventory as any[])?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0,
      value: ((p.inventory as any[])?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0) * Number(p.cost_price),
    }))

  // ── Low stock ───────────────────────────────────────────────
  const lowStock = (products || [])
    .map(p => {
      const stock = (p.inventory as any[])?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0
      return { name: p.name_ar || p.name, stock, cost: Number(p.cost_price), sale: Number(p.sale_price) }
    })
    .filter(p => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)

  // ── Customer metrics ────────────────────────────────────────
  const customerSalesMap: Record<string, number> = {}
  ;(sales || []).forEach(s => {
    if (s.customer_id) {
      customerSalesMap[s.customer_id] = (customerSalesMap[s.customer_id] || 0) + Number(s.total_amount)
    }
  })
  const topCustomers = (customers || [])
    .map(c => ({ name: c.name, spent: customerSalesMap[c.id] || 0, debt: Number(c.balance || 0) }))
    .filter(c => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10)

  const highDebt = (customers || [])
    .map(c => ({ name: c.name, debt: Number(c.balance || 0) }))
    .filter(c => c.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 10)

  // ── Totals ──────────────────────────────────────────────────
  const totalRevenue = (sales || []).reduce((s, sale) => s + Number(sale.total_amount), 0)
  const totalCost = Object.values(productMap).reduce((s, p) => s + p.cost, 0)
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
  const grossProfit = totalRevenue - totalCost
  const netProfit = grossProfit - totalExpenses
  const totalOrders = (sales || []).length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // ── Insights ────────────────────────────────────────────────
  const insights: { type: 'warning' | 'danger' | 'info'; message: string }[] = []

  if (deadStock.length > 0) {
    insights.push({ type: 'warning', message: `${deadStock.length} منتج لم يُباع خلال آخر ${days} يوم — راجع المخزون الراكد` })
  }
  if (lowStock.length > 0) {
    insights.push({ type: 'danger', message: `${lowStock.length} منتج على وشك النفاد — أعد الطلب قريباً` })
  }
  const losingProducts = topProducts.filter(p => p.margin < 0)
  if (losingProducts.length > 0) {
    insights.push({ type: 'danger', message: `تخسر على ${losingProducts.length} منتج — سعر البيع أقل من التكلفة` })
  }
  if (highDebt.length > 0 && highDebt[0].debt > 1000) {
    insights.push({ type: 'warning', message: `${highDebt[0].name} لديه دين ${highDebt[0].debt.toFixed(0)} — يستحق المتابعة` })
  }
  if (netProfit < 0) {
    insights.push({ type: 'danger', message: `الربح الصافي سلبي هذه الفترة — راجع المصروفات والتكاليف` })
  }
  if (grossProfit / (totalRevenue || 1) > 0.4) {
    insights.push({ type: 'info', message: `هامش الربح الإجمالي ${((grossProfit / totalRevenue) * 100).toFixed(1)}% — أداء جيد` })
  }

  return NextResponse.json({
    days,
    totals: { revenue: totalRevenue, cost: totalCost, expenses: totalExpenses, grossProfit, netProfit, orders: totalOrders, avgOrder: avgOrderValue },
    dailySales,
    topProducts,
    topCustomers,
    highDebt,
    lowStock,
    deadStock,
    insights,
  })
}

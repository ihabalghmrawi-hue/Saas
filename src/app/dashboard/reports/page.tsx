import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { getFeatures } from '@/lib/features'
import { getDefaultReportMode, getAvailableModes } from '@/lib/report-engine'
import { UnifiedReportsClient } from './unified-reports-client'
import type { SalesReportData, RentalReportData, ReportInsight } from '@/lib/report-engine'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY   = process.env.NEXT_PUBLIC_CURRENCY   || 'SAR'

// ── Sales data fetcher ────────────────────────────────────────────────────────
async function fetchSalesData(days: number): Promise<SalesReportData> {
  const supabase = createClient()
  const since    = new Date(Date.now() - days * 86400000).toISOString()
  const today    = new Date().toISOString().slice(0, 10)
  const from     = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const [
    { data: sales }, { data: saleItems },
    { data: customers }, { data: products }, { data: expenses },
  ] = await Promise.all([
    supabase.from('sales').select('id, total, created_at, customer_id').eq('company_id', COMPANY_ID).neq('status', 'cancelled').gte('created_at', since),
    supabase.from('sale_items').select('product_id, quantity, unit_price, cost_price, total, products(name, name_ar), sales!inner(company_id)').eq('sales.company_id', COMPANY_ID).gte('sales.created_at', since),
    supabase.from('customers').select('id, name, balance').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('products').select('id, name, name_ar, cost_price, inventory(quantity)').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('expenses').select('amount').eq('company_id', COMPANY_ID).gte('created_at', since),
  ])

  const dailyMap: Record<string, { revenue: number; count: number }> = {}
  ;(sales || []).forEach(s => {
    const day = s.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { revenue: 0, count: 0 }
    dailyMap[day].revenue += Number(s.total)
    dailyMap[day].count   += 1
  })
  const dailySales = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day: new Date(day).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }), ...v }))

  const productMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
  ;(saleItems || []).forEach((item: any) => {
    const p = item.products
    if (!productMap[item.product_id]) productMap[item.product_id] = { name: p?.name_ar || p?.name || '؟', qty: 0, revenue: 0, cost: 0 }
    productMap[item.product_id].qty     += Number(item.quantity)
    productMap[item.product_id].revenue += Number(item.total)
    productMap[item.product_id].cost    += Number(item.cost_price || 0) * Number(item.quantity)
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    .map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))

  const soldIds    = new Set(Object.keys(productMap))
  const deadStock  = (products || []).filter(p => {
    const s = (p.inventory as any[])?.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0) || 0
    return !soldIds.has(p.id) && s > 0
  }).slice(0, 10).map(p => ({ name: (p as any).name_ar || p.name, stock: (p.inventory as any[])?.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0) || 0, value: ((p.inventory as any[])?.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0) || 0) * Number(p.cost_price) }))

  const lowStock = (products || []).map(p => ({ name: (p as any).name_ar || p.name, stock: (p.inventory as any[])?.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0) || 0 })).filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 10)

  const custMap: Record<string, number> = {}
  ;(sales || []).forEach(s => { if (s.customer_id) custMap[s.customer_id] = (custMap[s.customer_id] || 0) + Number(s.total) })
  const topCustomers = (customers || []).map(c => ({ name: c.name, spent: custMap[c.id] || 0, debt: Number(c.balance || 0) })).filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 10)
  const highDebt     = (customers || []).map(c => ({ name: c.name, debt: Number(c.balance || 0) })).filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 10)

  const totalRevenue  = (sales || []).reduce((s, x) => s + Number(x.total), 0)
  const totalCost     = Object.values(productMap).reduce((s, p) => s + p.cost, 0)
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
  const grossProfit   = totalRevenue - totalCost
  const netProfit     = grossProfit  - totalExpenses
  const totalOrders   = (sales || []).length

  const insights: ReportInsight[] = []
  if (deadStock.length > 0)          insights.push({ type: 'warning', message: `${deadStock.length} منتج لم يُباع خلال آخر ${days} يوم` })
  if (lowStock.length > 0)           insights.push({ type: 'danger',  message: `${lowStock.length} منتج على وشك النفاد` })
  if (topProducts.some(p => p.margin < 0)) insights.push({ type: 'danger', message: `بعض المنتجات تُباع بأقل من تكلفتها` })
  if (highDebt[0]?.debt > 500)       insights.push({ type: 'warning', message: `${highDebt[0].name} لديه دين ${highDebt[0].debt.toFixed(0)}` })
  if (netProfit < 0 && totalRevenue > 0) insights.push({ type: 'danger', message: `الربح الصافي سلبي — راجع المصروفات` })
  if (totalRevenue > 0 && grossProfit / totalRevenue > 0.3) insights.push({ type: 'success', message: `هامش الربح ${((grossProfit / totalRevenue) * 100).toFixed(1)}% — أداء جيد` })

  return {
    mode: 'sales', days, period: { from, to: today },
    totals: { revenue: totalRevenue, cost: totalCost, expenses: totalExpenses, grossProfit, netProfit, orders: totalOrders, avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0 },
    dailySales, topProducts, topCustomers, highDebt, lowStock, deadStock, insights,
  }
}

// ── Rental data fetcher ───────────────────────────────────────────────────────
async function fetchRentalData(days: number): Promise<RentalReportData> {
  const res  = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reports/rental?days=${days}`, { cache: 'no-store' })
  if (!res.ok) {
    // fallback: return empty data
    const today = new Date().toISOString().slice(0, 10)
    const from  = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    return { mode: 'rental', days, period: { from, to: today }, totals: { revenue: 0, pending: 0, bookings: 0, activeNow: 0, lateCount: 0, avgBookingDays: 0, utilizationRate: 0, totalDresses: 0, availableDresses: 0 }, dailyRevenue: [], topDresses: [], lateOrders: [], upcomingEnds: [], insights: [] }
  }
  return res.json()
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ReportsPage() {
  const h           = headers()
  const features    = getFeatures(h.get('x-business-type') || 'retail')
  const defaultMode = getDefaultReportMode(features.businessType)
  const modes       = getAvailableModes(features.businessType)

  const [salesData, rentalData] = await Promise.all([
    modes.includes('sales')  ? fetchSalesData(30)  : Promise.resolve(null),
    modes.includes('rental') ? fetchRentalData(30) : Promise.resolve(null),
  ])

  return (
    <UnifiedReportsClient
      initialSalesData  = {salesData}
      initialRentalData = {rentalData}
      defaultMode       = {defaultMode}
      availableModes    = {modes}
      currency          = {CURRENCY}
      features          = {features}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { getFeatures } from '@/lib/features'
import { getDefaultReportMode, getAvailableModes } from '@/lib/report-engine'
import { UnifiedReportsClient } from './unified-reports-client'
import type { SalesReportData, RentalReportData, ReportInsight } from '@/lib/report-engine'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

// ── Sales data fetcher ────────────────────────────────────────────────────────
async function fetchSalesData(days: number): Promise<SalesReportData> {
  const COMPANY_ID = getCompanyId()
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
// Queries Supabase directly (avoids HTTP roundtrip that loses x-tenant-id header)
async function fetchRentalData(days: number): Promise<RentalReportData> {
  const COMPANY_ID = getCompanyId()
  const supabase   = createClient()
  const today      = new Date().toISOString().slice(0, 10)
  const since      = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const in7Days    = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const empty: RentalReportData = {
    mode: 'rental', days, period: { from: since, to: today },
    totals: { revenue: 0, pending: 0, bookings: 0, activeNow: 0, lateCount: 0, avgBookingDays: 0, utilizationRate: 0, totalDresses: 0, availableDresses: 0 },
    dailyRevenue: [], topDresses: [], lateOrders: [], upcomingEnds: [], insights: [],
  }

  try {
    const [
      { data: orders },
      { data: dresses },
      { data: lateRaw },
      { data: upcoming },
    ] = await Promise.all([
      supabase.from('rental_orders')
        .select('id, dress_id, customer_name, start_date, end_date, days, total_price, amount_paid, status, created_at, dresses(name, code)')
        .eq('company_id', COMPANY_ID).neq('status', 'cancelled').gte('start_date', since).order('start_date'),
      supabase.from('dresses')
        .select('id, name, code, status, rental_price')
        .eq('company_id', COMPANY_ID).neq('status', 'retired'),
      supabase.from('rental_orders')
        .select('id, customer_name, end_date, total_price, amount_paid, dresses(name)')
        .eq('company_id', COMPANY_ID).eq('status', 'active').lt('end_date', today),
      supabase.from('rental_orders')
        .select('id, customer_name, end_date, dresses(name)')
        .eq('company_id', COMPANY_ID).eq('status', 'active').gte('end_date', today).lte('end_date', in7Days).order('end_date'),
    ])

    const allOrders  = orders  || []
    const allDresses = dresses || []

    const revenue       = allOrders.reduce((s, o) => s + Number(o.total_price), 0)
    const pending       = allOrders.filter(o => ['booked', 'active'].includes(o.status)).reduce((s, o) => s + Number(o.total_price) - Number(o.amount_paid), 0)
    const activeNow     = allDresses.filter(d => d.status === 'rented').length
    const totalDresses  = allDresses.length
    const availableDresses = allDresses.filter(d => d.status === 'available').length
    const utilizationRate  = totalDresses > 0 ? Math.round((activeNow / totalDresses) * 100) : 0
    const totalDaysBooked  = allOrders.reduce((s, o) => s + Number(o.days || 1), 0)
    const avgBookingDays   = allOrders.length > 0 ? Math.round((totalDaysBooked / allOrders.length) * 10) / 10 : 0

    const dayMap: Record<string, { revenue: number; bookings: number }> = {}
    allOrders.forEach(o => {
      const day = o.start_date || o.created_at?.slice(0, 10) || ''
      if (!day) return
      if (!dayMap[day]) dayMap[day] = { revenue: 0, bookings: 0 }
      dayMap[day].revenue  += Number(o.total_price)
      dayMap[day].bookings += 1
    })
    const dailyRevenue = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day: new Date(day).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }), ...v }))

    const dressMap: Record<string, { name: string; code: string; bookings: number; revenue: number; daysBooked: number }> = {}
    allOrders.forEach(o => {
      const d = o.dresses as any
      if (!d) return
      if (!dressMap[o.dress_id]) dressMap[o.dress_id] = { name: d.name, code: d.code || '', bookings: 0, revenue: 0, daysBooked: 0 }
      dressMap[o.dress_id].bookings  += 1
      dressMap[o.dress_id].revenue   += Number(o.total_price)
      dressMap[o.dress_id].daysBooked += Number(o.days || 1)
    })
    const topDresses = Object.values(dressMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
      .map(d => ({ ...d, utilization: Math.min(100, Math.round((d.daysBooked / days) * 100)) }))

    const lateOrders = (lateRaw || []).map(o => {
      const daysLate = Math.floor((Date.now() - new Date(o.end_date).getTime()) / 86400000)
      return { customer_name: o.customer_name, dress_name: (o.dresses as any)?.name || '—', days_late: daysLate, amount_owed: Number(o.total_price) - Number(o.amount_paid) }
    }).sort((a, b) => b.days_late - a.days_late)

    const upcomingEnds = (upcoming || []).map(o => {
      const daysLeft = Math.ceil((new Date(o.end_date).getTime() - Date.now()) / 86400000)
      return { customer_name: o.customer_name, dress_name: (o.dresses as any)?.name || '—', end_date: o.end_date, days_left: daysLeft }
    })

    const insights: ReportInsight[] = []
    if (lateOrders.length > 0)        insights.push({ type: 'danger',  message: `${lateOrders.length} حجز متأخر في الإرجاع` })
    if (utilizationRate >= 80)        insights.push({ type: 'success', message: `معدل الاستخدام ${utilizationRate}% — أداء ممتاز!` })
    if (utilizationRate < 30 && totalDresses > 0) insights.push({ type: 'warning', message: `معدل الاستخدام منخفض (${utilizationRate}%)` })
    if (pending > 0)                  insights.push({ type: 'warning', message: `${pending.toFixed(0)} غير محصّل — تابع المدفوعات` })
    if (upcomingEnds.length > 0)      insights.push({ type: 'info',    message: `${upcomingEnds.length} فستان سيُرجع خلال 7 أيام` })
    if (topDresses[0])                insights.push({ type: 'info',    message: `"${topDresses[0].name}" الأكثر حجزاً` })

    return {
      mode: 'rental', days, period: { from: since, to: today },
      totals: { revenue, pending, bookings: allOrders.length, activeNow, lateCount: lateOrders.length, avgBookingDays, utilizationRate, totalDresses, availableDresses },
      dailyRevenue, topDresses, lateOrders, upcomingEnds, insights,
    }
  } catch {
    return empty
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ReportsPage() {
  const CURRENCY    = getCurrency()
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

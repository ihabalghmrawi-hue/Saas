import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RentalReportData, ReportInsight } from '@/lib/report-engine'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30')
  const supabase = createClient()

  const since   = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const today   = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const [
    { data: orders },
    { data: dresses },
    { data: lateRaw },
    { data: upcoming },
  ] = await Promise.all([
    supabase.from('rental_orders')
      .select('id, dress_id, customer_name, start_date, end_date, days, total_price, amount_paid, status, created_at, dresses(name, code)')
      .eq('company_id', COMPANY_ID)
      .neq('status', 'cancelled')
      .gte('start_date', since)
      .order('start_date'),
    supabase.from('dresses')
      .select('id, name, code, status, rental_price')
      .eq('company_id', COMPANY_ID)
      .neq('status', 'retired'),
    supabase.from('rental_orders')
      .select('id, customer_name, end_date, total_price, amount_paid, dresses(name)')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'active')
      .lt('end_date', today),
    supabase.from('rental_orders')
      .select('id, customer_name, end_date, dresses(name)')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'active')
      .gte('end_date', today)
      .lte('end_date', in7Days)
      .order('end_date'),
  ])

  const allOrders  = orders  || []
  const allDresses = dresses || []

  // ── Totals ──────────────────────────────────────────────────────────────────
  const revenue    = allOrders.reduce((s, o) => s + Number(o.total_price), 0)
  const pending    = allOrders.filter(o => ['booked','active'].includes(o.status))
    .reduce((s, o) => s + Number(o.total_price) - Number(o.amount_paid), 0)
  const activeNow  = allDresses.filter(d => d.status === 'rented').length
  const totalDresses    = allDresses.length
  const availableDresses = allDresses.filter(d => d.status === 'available').length

  const utilizationRate = totalDresses > 0 ? Math.round((activeNow / totalDresses) * 100) : 0

  const totalDaysBooked = allOrders.reduce((s, o) => s + Number(o.days || 1), 0)
  const avgBookingDays  = allOrders.length > 0 ? Math.round((totalDaysBooked / allOrders.length) * 10) / 10 : 0

  // ── Daily revenue ────────────────────────────────────────────────────────────
  const dayMap: Record<string, { revenue: number; bookings: number }> = {}
  allOrders.forEach(o => {
    const day = (o.start_date || o.created_at?.slice(0, 10) || '')
    if (!day) return
    if (!dayMap[day]) dayMap[day] = { revenue: 0, bookings: 0 }
    dayMap[day].revenue  += Number(o.total_price)
    dayMap[day].bookings += 1
  })
  const dailyRevenue = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day: new Date(day).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      ...v,
    }))

  // ── Top dresses ──────────────────────────────────────────────────────────────
  const dressMap: Record<string, { name: string; code: string; bookings: number; revenue: number; daysBooked: number }> = {}
  allOrders.forEach(o => {
    const d = o.dresses as any
    if (!d) return
    if (!dressMap[o.dress_id]) dressMap[o.dress_id] = { name: d.name, code: d.code || '', bookings: 0, revenue: 0, daysBooked: 0 }
    dressMap[o.dress_id].bookings  += 1
    dressMap[o.dress_id].revenue   += Number(o.total_price)
    dressMap[o.dress_id].daysBooked += Number(o.days || 1)
  })
  const topDresses = Object.values(dressMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(d => ({
      ...d,
      utilization: Math.min(100, Math.round((d.daysBooked / days) * 100)),
    }))

  // ── Late orders ──────────────────────────────────────────────────────────────
  const lateOrders = (lateRaw || []).map(o => {
    const daysLate = Math.floor((Date.now() - new Date(o.end_date).getTime()) / 86400000)
    return {
      customer_name: o.customer_name,
      dress_name:    (o.dresses as any)?.name || '—',
      days_late:     daysLate,
      amount_owed:   Number(o.total_price) - Number(o.amount_paid),
    }
  }).sort((a, b) => b.days_late - a.days_late)

  // ── Upcoming returns ─────────────────────────────────────────────────────────
  const upcomingEnds = (upcoming || []).map(o => {
    const daysLeft = Math.ceil((new Date(o.end_date).getTime() - Date.now()) / 86400000)
    return {
      customer_name: o.customer_name,
      dress_name:    (o.dresses as any)?.name || '—',
      end_date:      o.end_date,
      days_left:     daysLeft,
    }
  })

  // ── Insights ─────────────────────────────────────────────────────────────────
  const insights: ReportInsight[] = []
  if (lateOrders.length > 0) insights.push({ type: 'danger',  message: `${lateOrders.length} حجز متأخر في الإرجاع — تواصل مع العملاء` })
  if (utilizationRate >= 80) insights.push({ type: 'success', message: `معدل الاستخدام ${utilizationRate}% — أداء ممتاز!` })
  if (utilizationRate < 30 && totalDresses > 0) insights.push({ type: 'warning', message: `معدل الاستخدام منخفض (${utilizationRate}%) — فكّر في عروض ترويجية` })
  if (pending > 0)           insights.push({ type: 'warning', message: `${pending.toFixed(0)} غير محصّل — تابع المدفوعات المعلقة` })
  if (upcomingEnds.length > 0) insights.push({ type: 'info', message: `${upcomingEnds.length} فستان سيُرجع خلال 7 أيام — تأكد من التواصل` })
  if (topDresses[0])         insights.push({ type: 'info',    message: `"${topDresses[0].name}" الأكثر حجزاً بإيرادات ${topDresses[0].revenue.toFixed(0)}` })

  const data: RentalReportData = {
    mode: 'rental', days,
    period: { from: since, to: today },
    totals: { revenue, pending, bookings: allOrders.length, activeNow, lateCount: lateOrders.length, avgBookingDays, utilizationRate, totalDresses, availableDresses },
    dailyRevenue, topDresses, lateOrders, upcomingEnds, insights,
  }

  return NextResponse.json(data)
}

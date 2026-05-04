import { createClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export interface RawMetrics {
  sales: {
    thisWeek: number
    lastWeek: number
    thisMonth: number
    todayCount: number
    todayRevenue: number
    avgOrderValue: number
    weekChangePercent: number
  }
  topProducts: Array<{ name: string; qty: number; revenue: number; margin: number }>
  deadStock: Array<{ name: string; stock: number; daysSinceLastSale: number }>
  lowStock: Array<{ name: string; stock: number; daysLeft: number }>
  customers: {
    totalDebt: number
    highestDebt: { name: string; amount: number } | null
    topBuyer: { name: string; spent: number } | null
    newThisMonth: number
  }
  profit: {
    grossMargin: number
    netProfit: number
    lowestMarginCategory: { name: string; margin: number } | null
    totalExpenses: number
  }
  inventory: {
    totalValue: number
    lowStockCount: number
    outOfStockCount: number
  }
}

export async function computeMetrics(): Promise<RawMetrics> {
  const supabase = createClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString()
  const lastWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { data: thisWeekSales },
    { data: lastWeekSalesData },
    { data: monthSales },
    { data: saleItems30d },
    { data: customers },
    { data: products },
    { data: expenses30d },
    { data: newCustomers },
  ] = await Promise.all([
    supabase.from('sales').select('total_amount, created_at').eq('company_id', COMPANY_ID).neq('status', 'cancelled').gte('created_at', weekStart),
    supabase.from('sales').select('total_amount').eq('company_id', COMPANY_ID).neq('status', 'cancelled').gte('created_at', lastWeekStart).lt('created_at', weekStart),
    supabase.from('sales').select('total_amount').eq('company_id', COMPANY_ID).neq('status', 'cancelled').gte('created_at', monthStart),
    supabase.from('sale_items').select('product_id, quantity, total_price, unit_cost, products(name, name_ar, category_id, product_categories(name, name_ar))').eq('company_id', COMPANY_ID).gte('created_at', thirtyDaysAgo),
    supabase.from('customers').select('id, name, balance').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('products').select('id, name, name_ar, cost_price, sale_price, track_inventory, inventory(quantity)').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('expenses').select('amount').eq('company_id', COMPANY_ID).gte('created_at', thirtyDaysAgo),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).gte('created_at', monthStart),
  ])

  // Sales metrics
  const thisWeekRev = (thisWeekSales || []).reduce((s, x) => s + Number(x.total_amount), 0)
  const lastWeekRev = (lastWeekSalesData || []).reduce((s, x) => s + Number(x.total_amount), 0)
  const monthRev = (monthSales || []).reduce((s, x) => s + Number(x.total_amount), 0)
  const todaySales = (thisWeekSales || []).filter(s => s.created_at >= todayStart)
  const todayRev = todaySales.reduce((s, x) => s + Number(x.total_amount), 0)
  const weekChangePercent = lastWeekRev > 0 ? ((thisWeekRev - lastWeekRev) / lastWeekRev) * 100 : 0
  const avgOrderValue = (thisWeekSales || []).length > 0 ? thisWeekRev / (thisWeekSales || []).length : 0

  // Top products from sale_items
  const productMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
  ;(saleItems30d || []).forEach((item: any) => {
    const p = item.products
    const key = item.product_id
    if (!productMap[key]) productMap[key] = { name: p?.name_ar || p?.name || '؟', qty: 0, revenue: 0, cost: 0 }
    productMap[key].qty += Number(item.quantity)
    productMap[key].revenue += Number(item.total_price)
    productMap[key].cost += Number(item.unit_cost || 0) * Number(item.quantity)
  })
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    .map(p => ({ ...p, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))

  // Dead stock + low stock + inventory value
  const soldIds = new Set(Object.keys(productMap))
  const deadStock: RawMetrics['deadStock'] = []
  const lowStock: RawMetrics['lowStock'] = []
  let totalInventoryValue = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  const avgDailySalesMap: Record<string, number> = {}
  Object.entries(productMap).forEach(([id, p]) => { avgDailySalesMap[id] = p.qty / 30 })

  ;(products || []).forEach(p => {
    const stock = (p.inventory as any[])?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0
    totalInventoryValue += stock * Number(p.cost_price)

    if (!soldIds.has(p.id) && stock > 0) {
      deadStock.push({ name: (p as any).name_ar || p.name, stock, daysSinceLastSale: 30 })
    }
    if (stock === 0 && p.track_inventory) outOfStockCount++
    if (stock > 0 && stock <= 5 && p.track_inventory) {
      lowStockCount++
      const avgDaily = avgDailySalesMap[p.id] || 0.5
      lowStock.push({ name: (p as any).name_ar || p.name, stock, daysLeft: Math.floor(stock / avgDaily) })
    }
  })
  lowStock.sort((a, b) => a.daysLeft - b.daysLeft)

  // Customer metrics
  const custSalesMap: Record<string, number> = {}
  ;(monthSales || []).forEach(() => {})
  const sortedByDebt = [...(customers || [])].sort((a, b) => Number(b.balance) - Number(a.balance))
  const highestDebt = sortedByDebt[0]?.balance > 0 ? { name: sortedByDebt[0].name, amount: Number(sortedByDebt[0].balance) } : null
  const totalDebt = (customers || []).reduce((s, c) => s + Math.max(0, Number(c.balance)), 0)

  // Profit metrics
  const totalExpenses = (expenses30d || []).reduce((s, e) => s + Number(e.amount), 0)
  const totalRevenue = Object.values(productMap).reduce((s, p) => s + p.revenue, 0)
  const totalCost = Object.values(productMap).reduce((s, p) => s + p.cost, 0)
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0
  const netProfit = totalRevenue - totalCost - totalExpenses

  // Category margin analysis
  const catMap: Record<string, { name: string; revenue: number; cost: number }> = {}
  ;(saleItems30d || []).forEach((item: any) => {
    const p = item.products
    const cat = (p?.product_categories as any)
    const key = p?.category_id || 'none'
    const name = cat?.name_ar || cat?.name || 'غير مصنف'
    if (!catMap[key]) catMap[key] = { name, revenue: 0, cost: 0 }
    catMap[key].revenue += Number(item.total_price)
    catMap[key].cost += Number(item.unit_cost || 0) * Number(item.quantity)
  })
  const categories = Object.values(catMap).map(c => ({
    name: c.name,
    margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0,
  }))
  const lowestMarginCategory = categories.sort((a, b) => a.margin - b.margin)[0] || null

  return {
    sales: { thisWeek: thisWeekRev, lastWeek: lastWeekRev, thisMonth: monthRev, todayCount: todaySales.length, todayRevenue: todayRev, avgOrderValue, weekChangePercent },
    topProducts,
    deadStock: deadStock.slice(0, 5),
    lowStock: lowStock.slice(0, 5),
    customers: { totalDebt, highestDebt, topBuyer: null, newThisMonth: (newCustomers as any)?.count || 0 },
    profit: { grossMargin, netProfit, lowestMarginCategory, totalExpenses },
    inventory: { totalValue: totalInventoryValue, lowStockCount, outOfStockCount },
  }
}

export interface InsightItem {
  category: 'sales' | 'inventory' | 'customers' | 'profit' | 'general'
  severity: 'info' | 'success' | 'warning' | 'danger'
  title: string
  message: string
  metric?: any
}

export function generateRuleBasedInsights(m: RawMetrics): InsightItem[] {
  const insights: InsightItem[] = []
  const fmt = (n: number) => n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })

  // Sales trends
  if (m.sales.weekChangePercent <= -20) {
    insights.push({ category: 'sales', severity: 'danger', title: 'انخفاض حاد في المبيعات', message: `انخفضت مبيعات هذا الأسبوع ${Math.abs(m.sales.weekChangePercent).toFixed(0)}% مقارنة بالأسبوع الماضي. راجع العروض والتسعير.`, metric: { thisWeek: m.sales.thisWeek, lastWeek: m.sales.lastWeek } })
  } else if (m.sales.weekChangePercent >= 20) {
    insights.push({ category: 'sales', severity: 'success', title: 'نمو ممتاز في المبيعات', message: `ارتفعت المبيعات ${m.sales.weekChangePercent.toFixed(0)}% هذا الأسبوع — استمر في هذا الزخم!`, metric: { change: m.sales.weekChangePercent } })
  } else if (m.sales.weekChangePercent < 0) {
    insights.push({ category: 'sales', severity: 'warning', title: 'تراجع في المبيعات', message: `المبيعات أقل بـ ${Math.abs(m.sales.weekChangePercent).toFixed(0)}% عن الأسبوع الماضي.`, metric: { change: m.sales.weekChangePercent } })
  }

  if (m.topProducts.length > 0) {
    const best = m.topProducts[0]
    insights.push({ category: 'sales', severity: 'info', title: 'أفضل منتج مبيعاً', message: `"${best.name}" هو الأكثر مبيعاً بإيراد ${fmt(best.revenue)} وهامش ربح ${best.margin.toFixed(1)}%.`, metric: { product: best.name, revenue: best.revenue } })
  }

  // Inventory
  if (m.inventory.outOfStockCount > 0) {
    insights.push({ category: 'inventory', severity: 'danger', title: 'منتجات نفذت من المخزون', message: `${m.inventory.outOfStockCount} منتج نفذ تماماً — ستخسر مبيعات إذا لم تُعد الطلب فوراً.`, metric: { count: m.inventory.outOfStockCount } })
  }
  if (m.lowStock.length > 0) {
    const critical = m.lowStock.filter(p => p.daysLeft <= 3)
    if (critical.length > 0) {
      insights.push({ category: 'inventory', severity: 'danger', title: 'مخزون سينفد خلال 3 أيام', message: `"${critical[0].name}" سينفد خلال ${critical[0].daysLeft} يوم — اطلب الآن.`, metric: { product: critical[0].name, daysLeft: critical[0].daysLeft } })
    } else {
      insights.push({ category: 'inventory', severity: 'warning', title: 'مخزون منخفض', message: `${m.lowStock.length} منتج وصل للحد الأدنى. أعد الطلب قريباً.`, metric: { count: m.lowStock.length } })
    }
  }
  if (m.deadStock.length > 0) {
    insights.push({ category: 'inventory', severity: 'warning', title: 'مخزون راكد', message: `${m.deadStock.length} منتج لم يُباع خلال 30 يوم. فكر في عروض أو تخفيضات لتحريكه.`, metric: { count: m.deadStock.length } })
  }

  // Customers
  if (m.customers.highestDebt && m.customers.highestDebt.amount > 500) {
    insights.push({ category: 'customers', severity: 'warning', title: 'دين عميل مرتفع', message: `"${m.customers.highestDebt.name}" مدين بـ ${fmt(m.customers.highestDebt.amount)} — حان وقت التحصيل.`, metric: { customer: m.customers.highestDebt.name, amount: m.customers.highestDebt.amount } })
  }
  if (m.customers.totalDebt > 2000) {
    insights.push({ category: 'customers', severity: 'danger', title: 'إجمالي ديون مرتفع', message: `إجمالي الديون المستحقة ${fmt(m.customers.totalDebt)} — نصف منها يجب تحصيله الآن.`, metric: { total: m.customers.totalDebt } })
  }
  if (m.customers.newThisMonth > 0) {
    insights.push({ category: 'customers', severity: 'success', title: 'عملاء جدد هذا الشهر', message: `استقطبت ${m.customers.newThisMonth} عميل جديد هذا الشهر — استمر في التسويق.`, metric: { count: m.customers.newThisMonth } })
  }

  // Profit
  if (m.profit.grossMargin < 15) {
    insights.push({ category: 'profit', severity: 'danger', title: 'هامش ربح منخفض جداً', message: `هامش الربح الإجمالي ${m.profit.grossMargin.toFixed(1)}% — أقل من 15%. راجع تسعير منتجاتك.`, metric: { margin: m.profit.grossMargin } })
  } else if (m.profit.grossMargin > 35) {
    insights.push({ category: 'profit', severity: 'success', title: 'هامش ربح ممتاز', message: `هامش الربح ${m.profit.grossMargin.toFixed(1)}% — أداء تجاري قوي.`, metric: { margin: m.profit.grossMargin } })
  }
  if (m.profit.netProfit < 0) {
    insights.push({ category: 'profit', severity: 'danger', title: 'خسارة صافية', message: `الربح الصافي سلبي (-${fmt(Math.abs(m.profit.netProfit))}). المصروفات تتجاوز الأرباح — راجع التكاليف.`, metric: { netProfit: m.profit.netProfit } })
  }
  if (m.profit.lowestMarginCategory && m.profit.lowestMarginCategory.margin < 10) {
    insights.push({ category: 'profit', severity: 'warning', title: 'فئة بهامش ضعيف', message: `فئة "${m.profit.lowestMarginCategory.name}" هامش ربحها ${m.profit.lowestMarginCategory.margin.toFixed(1)}% فقط — قد تكون تخسر منها.`, metric: { category: m.profit.lowestMarginCategory } })
  }

  return insights
}

import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getFeatures } from '@/lib/features'
import {
  ShoppingCart, Package, TrendingUp, TrendingDown,
  AlertTriangle, Users, DollarSign, ArrowUpRight,
  Receipt, Zap, Calendar, Shirt, RotateCcw,
  CheckCircle, Plus, ChevronRight,
} from 'lucide-react'
import { InsightsWidget }       from '@/components/insights-widget'
import { DashboardOnboarding }  from '@/components/onboarding/dashboard-onboarding'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY   = process.env.NEXT_PUBLIC_CURRENCY   || 'SAR'

export default async function DashboardPage() {
  const supabase  = createClient()
  const h         = headers()
  const features  = getFeatures(h.get('x-business-type') || 'retail')
  const staffName = h.get('x-staff-name') || 'المدير'

  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'

  // ── Rental dashboard data ─────────────────────────────────────────────────
  if (features.hasRental) {
    const [
      { data: dresses },
      { data: orders },
      { data: lateOrders },
      { data: todayBookings },
      { data: pricingRules },
      { data: branding },
    ] = await Promise.all([
      supabase.from('dresses').select('status').eq('company_id', COMPANY_ID).neq('status', 'retired'),
      supabase.from('rental_orders').select('total_price, amount_paid, status').eq('company_id', COMPANY_ID).neq('status', 'cancelled'),
      supabase.from('rental_orders').select('id, customer_name, end_date, dresses(name)').eq('company_id', COMPANY_ID).eq('status', 'active').lt('end_date', today).order('end_date').limit(5),
      supabase.from('rental_orders').select('id, customer_name, start_date, dresses(name)').eq('company_id', COMPANY_ID).eq('status', 'booked').eq('start_date', today).limit(5),
      supabase.from('rental_pricing_rules').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('active', true),
      supabase.from('company_settings').select('logo_url').eq('company_id', COMPANY_ID).maybeSingle(),
    ])

    const available   = dresses?.filter(d => d.status === 'available').length  || 0
    const rented      = dresses?.filter(d => d.status === 'rented').length     || 0
    const maintenance = dresses?.filter(d => d.status === 'maintenance').length || 0
    const totalDresses = dresses?.length || 0
    const revenue     = orders?.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_price), 0) || 0
    const pending     = orders?.filter(o => ['booked','active'].includes(o.status)).reduce((s, o) => s + Number(o.total_price) - Number(o.amount_paid), 0) || 0
    const isEmpty     = totalDresses === 0

    return (
      <div className="space-y-6" dir="rtl">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{greeting}، {staffName} 👋</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isEmpty ? 'ابدأ بإضافة فساتينك لتشغيل النظام' : `${available} فستان متاح · ${rented} مؤجر · ${lateOrders?.length || 0} متأخر`}
            </p>
          </div>
          <Link href="/dashboard/rentals/bookings/new" data-tour="new-booking-btn"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> حجز جديد
          </Link>
        </div>

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="bg-card border-2 border-dashed border-primary/20 rounded-3xl p-10 text-center">
            <div className="text-6xl mb-4">👗</div>
            <h2 className="text-xl font-bold mb-2">لا يوجد فساتين بعد</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              ابدأ بإضافة فساتينك حتى تتمكن من استقبال الحجوزات وإدارة التأجير
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/dashboard/rentals/dresses"
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 flex items-center gap-2">
                <Plus className="w-4 h-4" /> أضف أول فستان
              </Link>
              <Link href="/dashboard/rentals/calendar"
                className="border px-6 py-3 rounded-xl font-medium text-sm hover:bg-accent flex items-center gap-2">
                <Calendar className="w-4 h-4" /> استعرض التقويم
              </Link>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        {!isEmpty && (
          <>
            <div data-tour="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'فساتين متاحة', value: available,  sub: `من ${totalDresses}`,         color: 'text-green-700',  bg: 'bg-green-50 dark:bg-green-900/20',   icon: Shirt,    href: '/dashboard/rentals/dresses' },
                { label: 'مؤجرة الآن',   value: rented,     sub: 'حجز نشط',                   color: 'text-blue-700',   bg: 'bg-blue-50 dark:bg-blue-900/20',     icon: Calendar, href: '/dashboard/rentals/bookings' },
                { label: 'إجمالي الإيرادات', value: formatCurrency(revenue, CURRENCY), sub: 'كل الوقت', color: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: TrendingUp, href: '/dashboard/rentals/bookings', isText: true },
                { label: 'مدفوعات معلقة', value: formatCurrency(pending, CURRENCY), sub: 'غير محصّلة', color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: DollarSign, href: '/dashboard/rentals/returns', isText: true },
              ].map((s, i) => {
                const Icon = s.icon
                return (
                  <Link key={i} href={s.href} className={`${s.bg} rounded-2xl p-4 hover:shadow-md transition-all group`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className={`font-bold ${s.color} ${s.isText ? 'text-lg' : 'text-3xl'}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                  </Link>
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Late returns */}
              <div className="bg-card border rounded-2xl overflow-hidden">
                <div className={`flex items-center justify-between px-5 py-3 border-b ${lateOrders?.length ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/10'}`}>
                  <h3 className={`font-semibold text-sm flex items-center gap-2 ${lateOrders?.length ? 'text-red-700' : 'text-green-700'}`}>
                    {lateOrders?.length ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    متأخرات الإرجاع {lateOrders?.length ? `(${lateOrders.length})` : ''}
                  </h3>
                  <Link href="/dashboard/rentals/returns" className="text-xs text-primary hover:underline flex items-center gap-1">
                    إدارة <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
                {!lateOrders?.length ? (
                  <div className="px-5 py-6 text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> لا توجد تأخيرات — عمل ممتاز! 🎉
                  </div>
                ) : (
                  <div className="divide-y">
                    {lateOrders.map(o => {
                      const lateDays = Math.floor((Date.now() - new Date(o.end_date).getTime()) / 86400000)
                      return (
                        <div key={o.id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm font-medium">{o.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{(o.dresses as any)?.name}</p>
                          </div>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                            {lateDays} يوم تأخير
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Today's schedule */}
              <div className="bg-card border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" /> حجوزات اليوم
                  </h3>
                  <Link href="/dashboard/rentals/bookings" className="text-xs text-primary hover:underline flex items-center gap-1">
                    الكل <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
                {!todayBookings?.length ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">لا توجد حجوزات اليوم</p>
                    <Link href="/dashboard/rentals/bookings/new"
                      className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors font-medium">
                      <Plus className="w-3.5 h-3.5" /> أنشئ حجزاً الآن
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {todayBookings.map(o => (
                      <div key={o.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium">{o.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{(o.dresses as any)?.name}</p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">اليوم</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/dashboard/rentals/dresses',       label: 'الفساتين',   icon: Shirt,     count: `${totalDresses} فستان`,   color: 'bg-pink-50 dark:bg-pink-900/10   border-pink-100' },
                { href: '/dashboard/rentals/bookings/new',  label: 'حجز سريع',  icon: Zap,       count: 'فوري',                     color: 'bg-primary/5                     border-primary/10' },
                { href: '/dashboard/rentals/calendar',      label: 'التقويم',   icon: Calendar,  count: 'رؤية كاملة',               color: 'bg-blue-50 dark:bg-blue-900/10   border-blue-100', tour: 'calendar-link' },
                { href: '/dashboard/rentals/pricing',       label: 'التسعير',   icon: DollarSign,count: 'الباقات والأسعار',         color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100' },
              ].map((link: any) => {
                const Icon = link.icon
                return (
                  <Link key={link.href} href={link.href}
                    {...(link.tour ? { 'data-tour': link.tour } : {})}
                    className={`border rounded-2xl p-4 hover:shadow-md transition-all group flex items-center gap-3 ${link.color}`}>
                    <Icon className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.count}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground mr-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )
              })}
            </div>
          </>
        )}

        <DashboardOnboarding
          businessType    = "dress_rental"
          hasProducts     = {false}
          hasDresses      = {totalDresses > 0}
          hasOrders       = {(orders?.length || 0) > 0}
          hasSales        = {false}
          hasBranding     = {!!(branding as any)?.logo_url}
          hasPricingRules = {(pricingRules as any)?.length > 0}
        />
      </div>
    )
  }

  // ── Standard ERP dashboard ────────────────────────────────────────────────
  const [
    { data: aiInsights },
    { data: todaySales },
    { data: monthSales },
    { data: monthPurchases },
    { data: monthExpenses },
    { data: lowStockProducts },
    { data: recentSales },
    { data: customersCount },
    { data: productsCount },
  ] = await Promise.all([
    supabase.from('ai_insights').select('*').eq('company_id', COMPANY_ID).gte('expires_at', new Date().toISOString()).order('generated_at', { ascending: false }),
    supabase.from('sales').select('total').eq('company_id', COMPANY_ID).gte('sale_date', today).eq('status', 'completed'),
    supabase.from('sales').select('total').eq('company_id', COMPANY_ID).gte('sale_date', monthStart).eq('status', 'completed'),
    supabase.from('purchases').select('total').eq('company_id', COMPANY_ID).gte('purchase_date', monthStart),
    supabase.from('expenses').select('amount').eq('company_id', COMPANY_ID).gte('expense_date', monthStart),
    supabase.from('products').select('id, name, name_ar, min_stock_level, inventory(quantity)').eq('company_id', COMPANY_ID).eq('track_inventory', true).eq('is_active', true),
    supabase.from('sales').select('invoice_number, total, sale_date, customers(name), payment_status').eq('company_id', COMPANY_ID).order('sale_date', { ascending: false }).limit(5),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  const todayTotal  = todaySales?.reduce((s, x) => s + x.total, 0)  || 0
  const monthTotal  = monthSales?.reduce((s, x) => s + x.total, 0)  || 0
  const monthCost   = monthPurchases?.reduce((s, x) => s + x.total, 0) || 0
  const monthExpTot = monthExpenses?.reduce((s, x) => s + x.amount, 0) || 0
  const monthProfit = monthTotal - monthCost - monthExpTot

  const lowStock = (lowStockProducts || []).filter(p => {
    const qty = (p.inventory as any[])?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
    return qty <= p.min_stock_level
  })

  const hasNoSales    = !recentSales || recentSales.length === 0
  const hasNoProducts = (productsCount as any)?.length === 0

  return (
    <div className="space-y-6" dir="rtl">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting}، {staffName} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {hasNoSales ? 'ابدأ بتسجيل أول عملية بيع' : `${todaySales?.length || 0} فاتورة اليوم`}
          </p>
        </div>
        {features.showPOS && (
          <Link href="/dashboard/pos" data-tour="pos-btn"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-primary/90 transition-all">
            <ShoppingCart className="w-4 h-4" /> نقطة البيع
          </Link>
        )}
      </div>

      {/* ── First-time empty state ── */}
      {hasNoProducts && (
        <div className="bg-card border-2 border-dashed border-primary/20 rounded-3xl p-10 text-center">
          <div className="text-6xl mb-4">{features.icon}</div>
          <h2 className="text-xl font-bold mb-2">مرحباً في {features.label}!</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            لم تُضف أي منتجات بعد. ابدأ بإضافة منتجاتك لتتمكن من البيع والتتبع
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/dashboard/inventory"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> أضف أول منتج
            </Link>
            {features.showPOS && (
              <Link href="/dashboard/pos"
                className="border px-6 py-3 rounded-xl font-medium text-sm hover:bg-accent flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> افتح نقطة البيع
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div data-tour="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'مبيعات اليوم',    value: formatCurrency(todayTotal, CURRENCY),   sub: `${todaySales?.length || 0} فاتورة`,  color: 'text-blue-700',    bg: 'bg-blue-50 dark:bg-blue-900/20',    icon: Receipt,    href: '/dashboard/sales' },
          { label: 'مبيعات الشهر',    value: formatCurrency(monthTotal, CURRENCY),   sub: 'هذا الشهر',                          color: 'text-green-700',   bg: 'bg-green-50 dark:bg-green-900/20',  icon: TrendingUp, href: '/dashboard/sales' },
          { label: 'صافي الربح',      value: formatCurrency(monthProfit, CURRENCY),  sub: 'بعد المصروفات',                      color: monthProfit >= 0 ? 'text-emerald-700' : 'text-red-700', bg: monthProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20', icon: monthProfit >= 0 ? TrendingUp : TrendingDown, href: '/dashboard/reports' },
          { label: 'المصروفات',       value: formatCurrency(monthExpTot, CURRENCY),  sub: 'هذا الشهر',                          color: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-900/20',      icon: DollarSign, href: '/dashboard/expenses' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <Link key={i} href={s.href} className={`${s.bg} rounded-2xl p-4 hover:shadow-md transition-all group`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </Link>
          )
        })}
      </div>

      {/* Onboarding */}
      <DashboardOnboarding
        businessType    = {features.businessType}
        hasProducts     = {(productsCount as any)?.length > 0}
        hasDresses      = {false}
        hasOrders       = {false}
        hasSales        = {(recentSales?.length || 0) > 0}
        hasBranding     = {false}
        hasPricingRules = {false}
      />

      {/* AI Insights */}
      <InsightsWidget initialInsights={(aiInsights as any) || []} compact />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent sales */}
        <div className="lg:col-span-2 bg-card border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="font-bold text-sm">آخر المبيعات</h2>
            <Link href="/dashboard/sales" className="text-xs text-primary flex items-center gap-1 hover:underline">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {hasNoSales ? (
            <div className="px-5 py-10 text-center">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground mb-1">لا توجد مبيعات بعد</p>
              <p className="text-xs text-muted-foreground mb-4">ابدأ بإنشاء أول عملية بيع</p>
              {features.showPOS && (
                <Link href="/dashboard/pos"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                  <ShoppingCart className="w-3.5 h-3.5" /> افتح نقطة البيع
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentSales!.map(sale => (
                <div key={sale.invoice_number} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium font-mono">{sale.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{(sale.customers as any)?.name || 'نقدي'}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-primary">{formatCurrency(sale.total, CURRENCY)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Low stock alert */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className={`flex items-center gap-2 px-4 py-3 border-b text-sm font-semibold ${lowStock.length > 0 ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700' : 'bg-green-50 dark:bg-green-900/10 text-green-700'}`}>
              {lowStock.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              تنبيهات المخزون
              {lowStock.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full mr-auto">{lowStock.length}</span>}
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">المخزون بحالة جيدة ✓</p>
            ) : (
              <div className="divide-y divide-border">
                {lowStock.slice(0, 4).map(p => {
                  const qty = (p.inventory as any[])?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
                  return (
                    <div key={p.id} className="flex justify-between items-center px-4 py-2.5 text-sm hover:bg-muted/30">
                      <span className="text-muted-foreground truncate">{p.name_ar || p.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${qty <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {qty <= 0 ? 'نفذ' : qty}
                      </span>
                    </div>
                  )
                })}
                {lowStock.length > 4 && (
                  <div className="px-4 py-2">
                    <Link href="/dashboard/inventory" className="text-xs text-primary hover:underline">+{lowStock.length - 4} منتج آخر</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">ملخص سريع</h3>
            {[
              { label: 'العملاء',   value: (customersCount as any)?.length || 0, icon: Users,    href: '/dashboard/customers',  color: 'text-blue-500' },
              { label: 'المنتجات',  value: (productsCount as any)?.length  || 0, icon: Package,  href: '/dashboard/inventory',  color: 'text-green-500' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <Link key={i} href={item.href} className="flex items-center justify-between hover:bg-muted/30 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm">{item.value}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="bg-card border rounded-2xl p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-3">إجراءات سريعة</h3>
            {[
              features.showPOS && { label: 'فتح نقطة البيع', href: '/dashboard/pos',        icon: ShoppingCart, primary: true  },
              { label: 'إضافة منتج',       href: '/dashboard/inventory',  icon: Package,      primary: false },
              { label: 'إضافة عميل',       href: '/dashboard/customers',  icon: Users,        primary: false },
              { label: 'مصروف جديد',       href: '/dashboard/expenses',   icon: DollarSign,   primary: false },
            ].filter(Boolean).map((action: any, i) => {
              const Icon = action.icon
              return (
                <Link key={i} href={action.href}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${action.primary ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-accent text-foreground border'}`}>
                  <Icon className="w-4 h-4" />
                  {action.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

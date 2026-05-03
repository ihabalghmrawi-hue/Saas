import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import {
  ShoppingCart, Package, TrendingUp, TrendingDown,
  AlertTriangle, Users, Truck, DollarSign, ArrowUpRight,
  ShoppingBag, Receipt
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function DashboardPage() {
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: todaySales },
    { data: monthSales },
    { data: monthPurchases },
    { data: monthExpenses },
    { data: lowStockProducts },
    { data: recentSales },
    { data: customersCount },
    { data: suppliersCount },
    { data: productsCount },
  ] = await Promise.all([
    supabase.from('sales').select('total, status').eq('company_id', COMPANY_ID).gte('sale_date', today).eq('status', 'completed'),
    supabase.from('sales').select('total, subtotal, discount_amount').eq('company_id', COMPANY_ID).gte('sale_date', monthStart).eq('status', 'completed'),
    supabase.from('purchases').select('total').eq('company_id', COMPANY_ID).gte('purchase_date', monthStart),
    supabase.from('expenses').select('amount').eq('company_id', COMPANY_ID).gte('expense_date', monthStart),
    supabase.from('products').select('id, name, name_ar, min_stock_level, inventory(quantity)').eq('company_id', COMPANY_ID).eq('track_inventory', true).eq('is_active', true),
    supabase.from('sales').select('invoice_number, total, sale_date, customers(name), payment_status').eq('company_id', COMPANY_ID).order('sale_date', { ascending: false }).limit(5),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  const todayTotal = todaySales?.reduce((s, sale) => s + sale.total, 0) || 0
  const monthTotal = monthSales?.reduce((s, sale) => s + sale.total, 0) || 0
  const monthCost = monthPurchases?.reduce((s, p) => s + p.total, 0) || 0
  const monthExpTotal = monthExpenses?.reduce((s, e) => s + e.amount, 0) || 0
  const monthProfit = monthTotal - monthCost - monthExpTotal

  const lowStock = lowStockProducts?.filter(p => {
    const qty = (p.inventory as any[])?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
    return qty <= p.min_stock_level
  }) || []

  const quickActions = [
    { label: 'نقطة البيع', href: '/dashboard/pos', icon: ShoppingCart, color: 'bg-blue-500', desc: 'بيع سريع' },
    { label: 'منتج جديد', href: '/dashboard/inventory', icon: Package, color: 'bg-green-500', desc: 'إضافة منتج' },
    { label: 'فاتورة شراء', href: '/dashboard/purchases', icon: ShoppingBag, color: 'bg-orange-500', desc: 'مشتريات' },
    { label: 'مصروف جديد', href: '/dashboard/expenses', icon: DollarSign, color: 'bg-red-500', desc: 'تسجيل مصروف' },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(action => {
          const Icon = action.icon
          return (
            <Link key={action.href} href={action.href} className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all">
              <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'مبيعات اليوم', value: formatCurrency(todayTotal, CURRENCY), icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', change: `${todaySales?.length || 0} فاتورة` },
          { label: 'مبيعات الشهر', value: formatCurrency(monthTotal, CURRENCY), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', change: '' },
          { label: 'صافي الربح', value: formatCurrency(monthProfit, CURRENCY), icon: monthProfit >= 0 ? TrendingUp : TrendingDown, color: monthProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: monthProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20', change: 'هذا الشهر' },
          { label: 'المصروفات', value: formatCurrency(monthExpTotal, CURRENCY), icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', change: 'هذا الشهر' },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className={`${stat.bg} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div className={`w-9 h-9 bg-white/60 dark:bg-black/20 rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              {stat.change && <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Sales */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">آخر المبيعات</h2>
            <Link href="/dashboard/sales" className="text-xs text-primary flex items-center gap-1 hover:underline">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {!recentSales || recentSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد مبيعات بعد</div>
          ) : (
            <div className="space-y-2">
              {recentSales.map(sale => (
                <div key={sale.invoice_number} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium font-mono">{sale.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{(sale.customers as any)?.name || 'نقدي'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{formatCurrency(sale.total, CURRENCY)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {/* Low Stock */}
          <div className="bg-card border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm">تنبيهات المخزون</h3>
              {lowStock.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">{lowStock.length}</span>
              )}
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">المخزون بحالة جيدة ✓</p>
            ) : (
              <div className="space-y-1.5">
                {lowStock.slice(0, 4).map(p => {
                  const qty = (p.inventory as any[])?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
                  return (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground truncate">{p.name_ar || p.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${qty <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {qty <= 0 ? 'نفذ' : qty}
                      </span>
                    </div>
                  )
                })}
                {lowStock.length > 4 && (
                  <Link href="/dashboard/inventory" className="text-xs text-primary hover:underline">+{lowStock.length - 4} منتج آخر</Link>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm mb-1">ملخص سريع</h3>
            {[
              { label: 'إجمالي العملاء', value: customersCount?.length || 0, icon: Users, color: 'text-blue-500' },
              { label: 'إجمالي الموردين', value: suppliersCount?.length || 0, icon: Truck, color: 'text-orange-500' },
              { label: 'إجمالي المنتجات', value: productsCount?.length || 0, icon: Package, color: 'text-green-500' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="font-bold text-sm">{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

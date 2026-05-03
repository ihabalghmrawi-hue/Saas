'use client'

import { useState, useMemo } from 'react'
import { Search, Receipt, Eye, TrendingUp, DollarSign, ShoppingBag, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Sale } from '@/types/erp'
import Link from 'next/link'

interface SalesClientProps {
  sales: Sale[]
  currency: string
  companyId: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'مكتملة', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30' },
  cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
  returned: { label: 'مرتجعة', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  partial: { label: 'جزئي', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' },
  unpaid: { label: 'غير مدفوعة', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
  refunded: { label: 'مسترجعة', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' },
}

export function SalesClient({ sales, currency, companyId }: SalesClientProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')

  const filtered = useMemo(() =>
    sales.filter(s => {
      const matchSearch = !search ||
        s.invoice_number.includes(search) ||
        (s.customers as any)?.name?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = !filterStatus || s.status === filterStatus
      const matchPayment = !filterPayment || s.payment_status === filterPayment
      return matchSearch && matchStatus && matchPayment
    }), [sales, search, filterStatus, filterPayment])

  // Stats
  const today = new Date().toDateString()
  const todaySales = sales.filter(s => new Date(s.sale_date).toDateString() === today && s.status === 'completed')
  const totalToday = todaySales.reduce((s, sale) => s + sale.total, 0)
  const totalMonth = sales.filter(s => {
    const d = new Date(s.sale_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === 'completed'
  }).reduce((s, sale) => s + sale.total, 0)
  const unpaidTotal = sales.filter(s => s.payment_status === 'unpaid' || s.payment_status === 'partial').reduce((s, sale) => s + sale.due_amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">فواتير المبيعات</h1>
          <p className="text-sm text-muted-foreground">{sales.length} فاتورة</p>
        </div>
        <Link href="/dashboard/pos" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <ShoppingBag className="w-4 h-4" />
          فاتورة جديدة (POS)
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
          <p className="text-xs text-green-600 opacity-70">مبيعات اليوم</p>
          <p className="text-lg font-bold text-green-700 mt-0.5">{formatCurrency(totalToday, currency)}</p>
          <p className="text-xs text-green-600">{todaySales.length} فاتورة</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-blue-600 opacity-70">مبيعات الشهر</p>
          <p className="text-lg font-bold text-blue-700 mt-0.5">{formatCurrency(totalMonth, currency)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <p className="text-xs text-red-600 opacity-70">مبالغ مستحقة</p>
          <p className="text-lg font-bold text-red-700 mt-0.5">{formatCurrency(unpaidTotal, currency)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-xs text-purple-600 opacity-70">إجمالي الفواتير</p>
          <p className="text-lg font-bold text-purple-700 mt-0.5">{sales.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو العميل..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل المدفوعات</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدفع</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد فواتير</td></tr>
              ) : (
                filtered.map(sale => (
                  <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">{sale.invoice_number}</td>
                    <td className="px-4 py-3">{(sale.customers as any)?.name || <span className="text-muted-foreground">نقدي</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(sale.sale_date)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(sale.total, currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_LABELS[sale.status]?.color)}>
                        {STATUS_LABELS[sale.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', PAYMENT_STATUS[sale.payment_status]?.color)}>
                        {PAYMENT_STATUS[sale.payment_status]?.label}
                      </span>
                      {sale.due_amount > 0 && (
                        <p className="text-xs text-red-500 mt-0.5">{formatCurrency(sale.due_amount, currency)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

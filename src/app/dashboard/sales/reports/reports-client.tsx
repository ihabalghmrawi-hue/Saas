'use client'

import { useState, useMemo } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReportsClientProps {
  invoices: any[]
  companyId: string
  currency: string
}

export function ReportsClient({ invoices, companyId, currency }: ReportsClientProps) {
  const [loading, setLoading] = useState(false)

  const totalSales = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'reversed').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'reversed').reduce((s, i) => s + Number(i.paid_amount || 0), 0)
  const outstanding = totalSales - totalPaid
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">تقارير المبيعات</h1>
        <p className="text-sm text-muted-foreground">ملخص أداء المبيعات</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي المبيعات</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalSales, currency)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">إجمالي المحصل</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalPaid, currency)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs text-red-600">المستحق</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(outstanding, currency)}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-xs text-yellow-600">الفواتير المتأخرة</p>
          <p className="text-xl font-bold text-yellow-700">{overdueInvoices.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-lg mb-4">الفواتير المتأخرة</h3>
        {overdueInvoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">لا توجد فواتير متأخرة</p>
        ) : (
          <div className="space-y-2">
            {overdueInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{inv.invoice_no} - {inv.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_date}</p>
                </div>
                <p className="font-bold text-red-600">{formatCurrency(Number(inv.total) - Number(inv.paid_amount), currency)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-lg mb-4">آخر الفواتير</h3>
        <div className="space-y-2">
          {invoices.slice(0, 10).map(inv => (
            <div key={inv.id} className="flex items-center justify-between p-3 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{inv.invoice_no}</p>
                <p className="text-xs text-muted-foreground">{inv.customer_name}</p>
              </div>
              <p className="font-bold">{formatCurrency(inv.total || 0, currency)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

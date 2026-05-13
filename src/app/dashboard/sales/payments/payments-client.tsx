'use client'

import { useState, useMemo } from 'react'
import { Search, CreditCard, Loader2, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface PaymentsClientProps {
  payments: any[]
  companyId: string
  currency: string
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: 'نقدي', bank_transfer: 'تحويل بنكي', cheque: 'شيك',
  credit_card: 'بطاقة ائتمان', wallet: 'محفظة', pos: 'نقطة بيع', online: 'دفع إلكتروني',
}

export function PaymentsClient({ payments: initialPayments, companyId, currency }: PaymentsClientProps) {
  const [payments, setPayments] = useState(initialPayments)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => payments.filter(p => {
    if (!search) return true
    return (p.customer_name || '').includes(search) || (p.payment_no || '').includes(search)
  }), [payments, search])

  const totalReceived = payments.filter(p => p.status === 'posted').reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المدفوعات</h1>
          <p className="text-sm text-muted-foreground">{payments.length} دفعة</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي المدفوعات</p>
          <p className="text-xl font-bold text-blue-700">{payments.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">المستلم</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceived, currency)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600">غير موزعة</p>
          <p className="text-xl font-bold text-purple-700">{payments.filter(p => p.status === 'posted' && !p.reconciled).length}</p>
        </div>
      </div>

      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث..."
          className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الدفعة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموزع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد مدفوعات</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.payment_no || '—'}</td>
                  <td className="px-4 py-3">{p.customer_name || '—'}</td>
                  <td className="px-4 py-3">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(p.amount || 0, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(p.allocated_amount || 0, currency)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', p.status === 'posted' ? 'bg-green-100 text-green-700' : p.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>
                      {p.status === 'posted' ? 'مرحلة' : p.status === 'reversed' ? 'ملغاة' : 'مسودة'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

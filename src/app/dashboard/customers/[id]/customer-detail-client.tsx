'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, User, Phone, MapPin, CreditCard, TrendingDown, Receipt, Plus, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  customer: any
  sales: any[]
  transactions: any[]
  currency: string
  companyId: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'مدفوع', color: 'bg-green-100 text-green-700' },
  partial: { label: 'جزئي', color: 'bg-amber-100 text-amber-700' },
  unpaid: { label: 'غير مدفوع', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'مسترجع', color: 'bg-purple-100 text-purple-700' },
}

export function CustomerDetailClient({ customer, sales, transactions, currency, companyId }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'sales' | 'ledger'>('sales')
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payNotes, setPayNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentBalance, setCurrentBalance] = useState(customer.balance || 0)

  const totalPurchases = sales.filter(s => s.status !== 'returned').reduce((s, x) => s + x.total, 0)
  const totalPaid = sales.filter(s => s.status !== 'returned').reduce((s, x) => s + x.paid_amount, 0)

  const handlePayment = async () => {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { setError('أدخل مبلغاً صحيحاً'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/customers/${customer.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: payMethod, notes: payNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCurrentBalance(data.new_balance)
      setShowPayment(false)
      setPayAmount('')
      setPayNotes('')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Back */}
      <Link href="/dashboard/customers" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowRight className="w-4 h-4" />
        العملاء
      </Link>

      {/* Customer Header */}
      <div className="bg-card border rounded-2xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              {customer.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.phone}
                </p>
              )}
              {customer.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {customer.address}
                </p>
              )}
            </div>
          </div>

          {/* Debt Badge */}
          {currentBalance > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
              <p className="text-xs text-red-600 dark:text-red-400 mb-1">الرصيد المستحق</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(currentBalance, currency)}</p>
              <button
                onClick={() => setShowPayment(true)}
                className="mt-2 flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors mx-auto"
              >
                <Plus className="w-3 h-3" />
                تسجيل دفعة
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
          {[
            { label: 'إجمالي المشتريات', value: formatCurrency(totalPurchases, currency), color: 'text-blue-600' },
            { label: 'إجمالي المدفوع', value: formatCurrency(totalPaid, currency), color: 'text-green-600' },
            { label: 'الرصيد المتبقي', value: formatCurrency(currentBalance, currency), color: currentBalance > 0 ? 'text-red-600' : 'text-emerald-600' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-base font-bold mt-0.5', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {[
          { id: 'sales', label: `الفواتير (${sales.length})` },
          { id: 'ledger', label: `كشف الحساب (${transactions.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          {sales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد فواتير</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المدفوع</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المتبقي</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map(sale => {
                  const status = STATUS_LABELS[sale.payment_status] || { label: sale.payment_status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-primary">{sale.invoice_number}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(sale.sale_date)}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(sale.total, currency)}</td>
                      <td className="px-4 py-3 text-green-600">{formatCurrency(sale.paid_amount, currency)}</td>
                      <td className="px-4 py-3 text-red-600 font-medium">{formatCurrency(sale.due_amount, currency)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', status.color)}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد حركات</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">ملاحظات</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                        tx.type === 'payment' ? 'bg-green-100 text-green-700' :
                        tx.type === 'sale' ? 'bg-blue-100 text-blue-700' :
                        tx.type === 'return' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {tx.type === 'payment' ? 'دفعة' : tx.type === 'sale' ? 'بيع' : tx.type === 'return' ? 'مرتجع' : 'تسوية'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{tx.notes || '—'}</td>
                    <td className={cn('px-4 py-3 font-medium', tx.amount < 0 ? 'text-green-600' : 'text-red-600')}>
                      {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), currency)}
                    </td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(tx.balance_after, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">تسجيل دفعة</h3>
              <button onClick={() => setShowPayment(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">الرصيد المستحق</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(currentBalance, currency)}</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">المبلغ المدفوع</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-input rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                step="0.01"
                min="0"
                max={currentBalance}
                autoFocus
              />
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[50, 100, 200, currentBalance].map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setPayAmount(v.toFixed(2))}
                    className="text-xs py-1.5 bg-accent rounded-lg hover:bg-accent/80 transition-colors font-medium"
                  >
                    {i === 3 ? 'الكل' : v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">طريقة الدفع</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: 'cash', label: 'نقدي' },
                  { value: 'card', label: 'بطاقة' },
                  { value: 'bank', label: 'تحويل' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPayMethod(m.value)}
                    className={cn('py-1.5 rounded-lg text-xs font-medium border transition-all',
                      payMethod === m.value ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
            />

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePayment}
                disabled={loading}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                تأكيد الدفعة
              </button>
              <button onClick={() => setShowPayment(false)} className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

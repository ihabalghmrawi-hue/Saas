'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Receipt, Download, Eye, Filter, Search, Calendar, CreditCard, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InvoiceItem {
  description: string
  amount: number
}

interface Invoice {
  id: string
  number: string
  date: number
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'cancelled'
  items: InvoiceItem[]
  paymentMethod?: string
}

interface BillingInvoiceViewProps {
  invoices: Invoice[]
  className?: string
}

type FilterTab = 'all' | 'paid' | 'pending' | 'overdue'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'paid', label: 'مدفوعة' },
  { key: 'pending', label: 'معلقة' },
  { key: 'overdue', label: 'متأخرة' },
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  paid: { label: 'مدفوعة', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'معلقة', icon: Clock, className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  overdue: { label: 'متأخرة', icon: AlertTriangle, className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'ملغية', icon: AlertTriangle, className: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  visa: 'فيزا **** 4242',
  mastercard: 'ماستركارد **** 5678',
  bank_transfer: 'تحويل بنكي',
  cash: 'نقداً',
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ar-SA') + ' ريال'
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const config = STATUS_CONFIG[status]
  if (!config) return null
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0)
  const tax = Math.round(subtotal * 0.15)
  const total = subtotal + tax

  return (
    <div className="pt-3 pb-2 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">تفاصيل الفاتورة</p>
          <p className="text-sm">رقم الفاتورة: {invoice.number}</p>
          <p className="text-sm">التاريخ: {formatDate(invoice.date)}</p>
          {invoice.paymentMethod && (
            <p className="text-sm flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod}
            </p>
          )}
        </div>
        <div className="text-right md:text-left">
          <p className="text-xs text-muted-foreground mb-1">الحالة</p>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      {invoice.items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-right p-2.5 font-medium text-muted-foreground">البيان</th>
                <th className="text-left p-2.5 font-medium text-muted-foreground w-28">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2.5 text-right">{item.description}</td>
                  <td className="p-2.5 text-left font-mono">{item.amount.toLocaleString()} ريال</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="p-2.5 text-right text-muted-foreground">المجموع الفرعي</td>
                <td className="p-2.5 text-left font-mono">{subtotal.toLocaleString()} ريال</td>
              </tr>
              <tr className="border-t">
                <td className="p-2.5 text-right text-muted-foreground">ضريبة القيمة المضافة (15%)</td>
                <td className="p-2.5 text-left font-mono">{tax.toLocaleString()} ريال</td>
              </tr>
              <tr className="border-t bg-muted/20 font-semibold">
                <td className="p-2.5 text-right">الإجمالي</td>
                <td className="p-2.5 text-left">{total.toLocaleString()} ريال</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export function BillingInvoiceView({ invoices, className }: BillingInvoiceViewProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredInvoices = useMemo(() => {
    let result = invoices

    if (activeFilter !== 'all') {
      result = result.filter((inv) => inv.status === activeFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((inv) => inv.number.toLowerCase().includes(q))
    }

    return result
  }, [invoices, activeFilter, searchQuery])

  const counts = useMemo(() => {
    const all = invoices.length
    const paid = invoices.filter((i) => i.status === 'paid').length
    const pending = invoices.filter((i) => i.status === 'pending').length
    const overdue = invoices.filter((i) => i.status === 'overdue').length
    return { all, paid, pending, overdue }
  }, [invoices])

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (invoices.length === 0) {
    return (
      <div className={cn('w-full text-center py-12', className)} dir="rtl">
        <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-lg font-bold mb-1">لا توجد فواتير</h3>
        <p className="text-sm text-muted-foreground">لم يتم إصدار أي فواتير بعد</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeFilter === tab.key
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className="mr-1.5 text-xs opacity-70">({counts[tab.key]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            placeholder="بحث برقم الفاتورة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir="rtl"
          />
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">
          <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">لا توجد نتائج للبحث</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-primary hover:underline mt-1"
            >
              مسح البحث
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const isExpanded = expandedId === invoice.id
            return (
              <div
                key={invoice.id}
                className={cn(
                  'border rounded-lg transition-colors',
                  isExpanded ? 'border-primary/30 bg-primary/[0.02]' : 'hover:bg-muted/30'
                )}
              >
                <button
                  onClick={() => handleToggleExpand(invoice.id)}
                  className="w-full flex items-center justify-between p-4 text-right"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {formatDate(invoice.date)}
                      </p>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{formatAmount(invoice.amount)}</span>
                    <div className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-transform',
                      isExpanded ? 'border-primary rotate-180' : 'border-muted-foreground/30'
                    )}>
                      <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && <InvoiceDetail invoice={invoice} />}

                <div className={cn('flex items-center gap-2 px-4 pb-3', isExpanded ? 'pt-2' : '')}>
                  <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    تحميل PDF
                  </Button>
                  {invoice.status === 'pending' && (
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-primary">
                      <CreditCard className="h-3.5 w-3.5" />
                      دفع الآن
                    </Button>
                  )}
                  {invoice.status === 'overdue' && (
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      تسوية المتأخرات
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-4 text-center">
        إجمالي {filteredInvoices.length} من {invoices.length} فاتورة
      </div>
    </div>
  )
}

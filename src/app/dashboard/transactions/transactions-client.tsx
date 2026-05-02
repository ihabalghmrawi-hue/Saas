'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, Search, Filter, ArrowUpRight, ArrowDownRight,
  Pencil, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Transaction, Category } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface TransactionsClientProps {
  transactions: Transaction[]
  categories: Category[]
  currency: string
  companyId: string
  totalCount: number
  currentPage: number
  limit: number
}

const typeLabels: Record<string, string> = {
  all: 'الكل',
  income: 'إيرادات',
  expense: 'مصروفات',
  transfer: 'تحويلات',
}

const statusLabels: Record<string, string> = {
  completed: 'مكتملة',
  pending: 'معلقة',
  cancelled: 'ملغاة',
  draft: 'مسودة',
}

export function TransactionsClient({
  transactions,
  categories,
  currency,
  companyId,
  totalCount,
  currentPage,
  limit,
}: TransactionsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const totalPages = Math.ceil(totalCount / limit)
  const currentType = searchParams.get('type') || 'all'

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '1')
    startTransition(() => router.push(`?${params.toString()}`))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه المعاملة؟')) return
    setDeleteId(id)
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', id)
    setDeleteId(null)
    router.refresh()
  }

  // Summary stats
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">المعاملات المالية</h2>
          <p className="text-sm text-muted-foreground">{totalCount} معاملة</p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          قيد جديد
        </Link>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">إجمالي الإيرادات</p>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome, currency)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium mb-1">إجمالي المصروفات</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalExpense, currency)}</p>
        </div>
        <div className={cn(
          'rounded-xl p-4 border',
          totalIncome - totalExpense >= 0
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'
        )}>
          <p className={cn('text-xs font-medium mb-1', totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600')}>
            صافي الفترة
          </p>
          <p className={cn('text-lg font-bold', totalIncome - totalExpense >= 0 ? 'text-blue-700' : 'text-orange-700')}>
            {formatCurrency(totalIncome - totalExpense, currency)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {Object.entries(typeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => updateFilter('type', key === 'all' ? '' : key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  currentType === key || (key === 'all' && !searchParams.get('type'))
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select
            value={searchParams.get('category') || ''}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="border border-input bg-background rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">جميع الفئات</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name_ar || cat.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث في المعاملات..."
              defaultValue={searchParams.get('search') || ''}
              onChange={(e) => {
                clearTimeout((window as any)._searchTimer)
                ;(window as any)._searchTimer = setTimeout(() => {
                  updateFilter('search', e.target.value)
                }, 400)
              }}
              className="w-full border border-input bg-background rounded-lg px-3 py-2 pr-9 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowUpRight className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">لا توجد معاملات</p>
            <p className="text-sm text-muted-foreground mt-1">ابدأ بإضافة معاملاتك المالية</p>
            <Link
              href="/dashboard/transactions/new"
              className="inline-flex items-center gap-2 mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              إضافة معاملة
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">الوصف</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">الفئة</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">النوع</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">المبلغ</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 text-muted-foreground text-xs">
                      {formatDate(txn.transaction_date)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                          txn.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          txn.type === 'expense' ? 'bg-red-100 dark:bg-red-900/30' :
                          'bg-blue-100 dark:bg-blue-900/30'
                        )}>
                          {txn.type === 'income' ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />
                          )}
                        </div>
                        <span className="font-medium text-foreground truncate max-w-48">
                          {txn.description_ar || txn.description || 'بدون وصف'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {txn.category ? (
                        <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                          {(txn.category as any).name_ar || (txn.category as any).name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        txn.type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        txn.type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>
                        {txn.type === 'income' ? 'دخل' : txn.type === 'expense' ? 'مصروف' : 'تحويل'}
                      </span>
                    </td>
                    <td className={cn(
                      'py-3.5 px-4 font-semibold',
                      txn.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {txn.type === 'expense' ? '-' : '+'}
                      {formatCurrency(txn.amount, currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        txn.status === 'completed' ? 'bg-green-100 text-green-700' :
                        txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {statusLabels[txn.status] || txn.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/dashboard/transactions/${txn.id}/edit`}
                          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(txn.id)}
                          disabled={deleteId === txn.id}
                          className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              عرض {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalCount)} من {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateFilter('page', String(currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => updateFilter('page', String(p))}
                  className={cn(
                    'w-8 h-8 rounded-md text-xs font-medium transition-colors',
                    currentPage === p
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => updateFilter('page', String(currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

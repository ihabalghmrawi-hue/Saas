'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, ExternalLink } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Transaction } from '@/types/database'

interface RecentTransactionsProps {
  transactions: Transaction[]
  currency: string
}

export function RecentTransactions({ transactions, currency }: RecentTransactionsProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="flex items-center justify-between p-5 border-b">
        <div>
          <h3 className="font-semibold text-foreground">آخر المعاملات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">آخر {transactions.length} معاملة</p>
        </div>
        <Link
          href="/dashboard/transactions"
          className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
        >
          عرض الكل
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground text-sm">لا توجد معاملات بعد</p>
          <Link
            href="/dashboard/transactions/new"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            إضافة أول معاملة
          </Link>
        </div>
      ) : (
        <div className="divide-y">
          {transactions.map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionRow({ transaction, currency }: { transaction: Transaction; currency: string }) {
  const icons = {
    income: <ArrowUpRight className="w-4 h-4 text-emerald-600" />,
    expense: <ArrowDownRight className="w-4 h-4 text-red-600" />,
    transfer: <ArrowLeftRight className="w-4 h-4 text-blue-600" />,
  }

  const bgColors = {
    income: 'bg-emerald-50 dark:bg-emerald-900/20',
    expense: 'bg-red-50 dark:bg-red-900/20',
    transfer: 'bg-blue-50 dark:bg-blue-900/20',
  }

  const amountColors = {
    income: 'text-emerald-600',
    expense: 'text-red-600',
    transfer: 'text-blue-600',
  }

  const typeLabels = {
    income: 'دخل',
    expense: 'مصروف',
    transfer: 'تحويل',
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
      {/* Icon */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bgColors[transaction.type])}>
        {icons[transaction.type]}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {transaction.description_ar || transaction.description || typeLabels[transaction.type]}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {(transaction.category as any)?.name_ar || typeLabels[transaction.type]} •{' '}
          {formatDate(transaction.transaction_date)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-semibold', amountColors[transaction.type])}>
          {transaction.type === 'expense' ? '-' : '+'}
          {formatCurrency(transaction.amount, currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {transaction.payment_method === 'cash' ? 'نقداً' : 'بنكي'}
        </p>
      </div>
    </div>
  )
}

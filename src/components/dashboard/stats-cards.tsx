'use client'

import { TrendingUp, TrendingDown, Wallet, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { DashboardStats as StatsType } from '@/types/database'

interface StatCardProps {
  title: string
  amount: number
  currency: string
  change?: number
  icon: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'danger'
}

function StatCard({ title, amount, currency, change, icon, variant = 'default' }: StatCardProps) {
  const isPositive = (change || 0) >= 0

  const variantStyles = {
    default: 'bg-card border',
    primary: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0',
    success: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0',
    danger: 'bg-gradient-to-br from-red-500 to-red-600 text-white border-0',
  }

  const isColored = variant !== 'default'

  return (
    <div className={cn('rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200', variantStyles[variant])}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', isColored ? 'bg-white/20' : 'bg-primary/10')}>
          <div className={isColored ? 'text-white' : 'text-primary'}>
            {icon}
          </div>
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            isPositive
              ? isColored ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
              : isColored ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      <div>
        <p className={cn('text-sm mb-1', isColored ? 'text-white/80' : 'text-muted-foreground')}>
          {title}
        </p>
        <p className={cn('text-2xl font-bold', isColored ? 'text-white' : 'text-foreground')}>
          {formatCurrency(amount, currency)}
        </p>
        {change !== undefined && (
          <p className={cn('text-xs mt-1', isColored ? 'text-white/70' : 'text-muted-foreground')}>
            مقارنة بالشهر الماضي
          </p>
        )}
      </div>
    </div>
  )
}

interface DashboardStatsProps {
  stats: StatsType
  currency: string
}

export function DashboardStats({ stats, currency }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        title="إجمالي الرصيد"
        amount={stats.totalBalance}
        currency={currency}
        icon={<Wallet className="w-5 h-5" />}
        variant="primary"
      />
      <StatCard
        title="إجمالي الإيرادات"
        amount={stats.totalIncome}
        currency={currency}
        change={stats.incomeChange}
        icon={<TrendingUp className="w-5 h-5" />}
        variant="success"
      />
      <StatCard
        title="إجمالي المصروفات"
        amount={stats.totalExpenses}
        currency={currency}
        change={stats.expenseChange}
        icon={<TrendingDown className="w-5 h-5" />}
        variant="danger"
      />
      <StatCard
        title="صافي الربح"
        amount={stats.netProfit}
        currency={currency}
        icon={<DollarSign className="w-5 h-5" />}
        variant={stats.netProfit >= 0 ? 'default' : 'default'}
      />
    </div>
  )
}

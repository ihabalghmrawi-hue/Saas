'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ProfitLossClientProps {
  monthlyData: any[]
  expenseBreakdown: any[]
  totals: any
  currency: string
  year: number
}

export function ProfitLossClient({ monthlyData, expenseBreakdown, totals, currency, year }: ProfitLossClientProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const cards = [
    { label: 'إجمالي الإيرادات', value: totals.revenue, icon: TrendingUp, color: 'bg-green-50 dark:bg-green-900/20 text-green-700', iconColor: 'text-green-600' },
    { label: 'تكلفة البضاعة المباعة', value: totals.cogs, icon: ShoppingBag, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700', iconColor: 'text-blue-600' },
    { label: 'إجمالي المصروفات', value: totals.expenses, icon: DollarSign, color: 'bg-red-50 dark:bg-red-900/20 text-red-700', iconColor: 'text-red-600' },
    { label: 'صافي الربح', value: totals.netProfit, icon: totals.netProfit >= 0 ? TrendingUp : TrendingDown, color: totals.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700', iconColor: totals.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ]

  const chartData = monthlyData.map(m => ({
    name: m.label,
    إيرادات: Math.round(m.revenue),
    تكاليف: Math.round(m.cogs),
    مصروفات: Math.round(m.expenses),
    'صافي الربح': Math.round(m.netProfit),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الأرباح والخسائر</h1>
          <p className="text-sm text-muted-foreground">السنة المالية {year}</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => setView('chart')} className={cn('px-3 py-1.5 text-sm rounded-md transition-all', view === 'chart' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}>
            رسم بياني
          </button>
          <button onClick={() => setView('table')} className={cn('px-3 py-1.5 text-sm rounded-md transition-all', view === 'table' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}>
            جدول
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className={cn('rounded-2xl p-5', card.color)}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm opacity-80">{card.label}</p>
                <Icon className={cn('w-5 h-5', card.iconColor)} />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(card.value, currency)}</p>
              {i === 3 && (
                <p className="text-xs mt-1 opacity-70">
                  هامش الربح: {totals.revenue > 0 ? ((totals.netProfit / totals.revenue) * 100).toFixed(1) : 0}%
                </p>
              )}
            </div>
          )
        })}
      </div>

      {view === 'chart' ? (
        <div className="bg-card border rounded-2xl p-5">
          <h2 className="font-bold mb-4">الأداء الشهري</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(v, currency)} />
              <Legend />
              <Bar dataKey="إيرادات" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="تكاليف" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="مصروفات" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="صافي الربح" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الشهر</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإيرادات</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التكاليف</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المصروفات</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">إجمالي الربح</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">صافي الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthlyData.map((m, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{m.label}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(m.revenue, currency)}</td>
                    <td className="px-4 py-3 text-blue-600">{formatCurrency(m.cogs, currency)}</td>
                    <td className="px-4 py-3 text-red-600">{formatCurrency(m.expenses, currency)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(m.grossProfit, currency)}</td>
                    <td className={cn('px-4 py-3 font-bold', m.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {formatCurrency(m.netProfit, currency)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3 text-green-600">{formatCurrency(totals.revenue, currency)}</td>
                  <td className="px-4 py-3 text-blue-600">{formatCurrency(totals.cogs, currency)}</td>
                  <td className="px-4 py-3 text-red-600">{formatCurrency(totals.expenses, currency)}</td>
                  <td className="px-4 py-3">{formatCurrency(totals.grossProfit, currency)}</td>
                  <td className={cn('px-4 py-3', totals.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCurrency(totals.netProfit, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Breakdown */}
      {expenseBreakdown.length > 0 && (
        <div className="bg-card border rounded-2xl p-5">
          <h2 className="font-bold mb-4">توزيع المصروفات</h2>
          <div className="space-y-3">
            {expenseBreakdown.sort((a, b) => b.amount - a.amount).map((cat, i) => {
              const pct = totals.expenses > 0 ? (cat.amount / totals.expenses) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(cat.amount, currency)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color || '#6B7280' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

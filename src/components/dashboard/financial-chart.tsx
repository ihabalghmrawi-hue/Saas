'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { MonthlyData } from '@/types/database'

interface FinancialChartProps {
  data: MonthlyData[]
  currency: string
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border rounded-xl p-3 shadow-lg text-sm">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{formatCurrency(entry.value, currency)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function FinancialChart({ data, currency }: FinancialChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-foreground">الأداء المالي</h3>
          <p className="text-xs text-muted-foreground mt-0.5">آخر 6 أشهر</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'bar'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            أعمدة
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'line'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            خطي
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chartType === 'bar' ? (
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={35}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(value) => value === 'income' ? 'الإيرادات' : value === 'expenses' ? 'المصروفات' : 'الربح'}
            />
            <Bar dataKey="income" name="income" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={35}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(value) => value === 'income' ? 'الإيرادات' : value === 'expenses' ? 'المصروفات' : 'الربح'}
            />
            <Line dataKey="income" name="income" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} />
            <Line dataKey="expenses" name="expenses" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4, fill: '#EF4444' }} />
            <Line dataKey="profit" name="profit" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4, fill: '#3B82F6' }} strokeDasharray="5 5" />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

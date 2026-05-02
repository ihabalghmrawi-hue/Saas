'use client'

import { useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Download, FileText, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface ReportsClientProps {
  monthlyData: Array<{ month: string; income: number; expenses: number; profit: number }>
  expenseBreakdown: Array<{ name: string; color: string; amount: number; percentage: number }>
  incomeBreakdown: Array<{ name: string; color: string; amount: number; percentage: number }>
  totals: { income: number; expenses: number; profit: number }
  currency: string
  companyName: string
  currentMonth: string
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export function ReportsClient({
  monthlyData, expenseBreakdown, incomeBreakdown, totals, currency, companyName, currentMonth
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expense' | 'pl'>('overview')

  const profitMargin = totals.income > 0 ? (totals.profit / totals.income) * 100 : 0

  const exportPDF = async () => {
    // Dynamic import for PDF generation
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    doc.setFontSize(20)
    doc.text('Financial Report', 20, 25)
    doc.setFontSize(12)
    doc.text(`Company: ${companyName}`, 20, 35)
    doc.text(`Period: Last 6 Months`, 20, 43)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 51)

    doc.setFontSize(14)
    doc.text('Summary', 20, 65)
    doc.setFontSize(11)
    doc.text(`Total Income: ${formatCurrency(totals.income, currency)}`, 20, 75)
    doc.text(`Total Expenses: ${formatCurrency(totals.expenses, currency)}`, 20, 83)
    doc.text(`Net Profit: ${formatCurrency(totals.profit, currency)}`, 20, 91)
    doc.text(`Profit Margin: ${profitMargin.toFixed(1)}%`, 20, 99)

    doc.setFontSize(14)
    doc.text('Monthly Breakdown', 20, 115)
    doc.setFontSize(10)
    let y = 125
    monthlyData.forEach(m => {
      doc.text(`${m.month}: Income ${formatCurrency(m.income, currency)} | Expenses ${formatCurrency(m.expenses, currency)} | Profit ${formatCurrency(m.profit, currency)}`, 20, y)
      y += 8
    })

    doc.save(`financial-report-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Financial Report', ''],
      ['Company', companyName],
      ['Period', 'Last 6 Months'],
      ['Generated', new Date().toLocaleDateString()],
      ['', ''],
      ['Metric', 'Amount'],
      ['Total Income', totals.income],
      ['Total Expenses', totals.expenses],
      ['Net Profit', totals.profit],
      ['Profit Margin', `${profitMargin.toFixed(1)}%`],
    ]
    const ws1 = utils.aoa_to_sheet(summaryData)
    utils.book_append_sheet(wb, ws1, 'Summary')

    // Monthly data sheet
    const monthlySheet = [
      ['Month', 'Income', 'Expenses', 'Profit'],
      ...monthlyData.map(m => [m.month, m.income, m.expenses, m.profit])
    ]
    const ws2 = utils.aoa_to_sheet(monthlySheet)
    utils.book_append_sheet(wb, ws2, 'Monthly Data')

    // Expenses breakdown
    const expSheet = [
      ['Category', 'Amount', 'Percentage'],
      ...expenseBreakdown.map(e => [e.name, e.amount, `${e.percentage.toFixed(1)}%`])
    ]
    const ws3 = utils.aoa_to_sheet(expSheet)
    utils.book_append_sheet(wb, ws3, 'Expenses Breakdown')

    writeFile(wb, `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const tabs = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'income', label: 'الإيرادات' },
    { key: 'expense', label: 'المصروفات' },
    { key: 'pl', label: 'الربح والخسارة' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">التقارير المالية</h2>
          <p className="text-sm text-muted-foreground">آخر 6 أشهر • {companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPDF}
            className="flex items-center gap-2 border border-input bg-background px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <FileText className="w-4 h-4 text-red-500" />
            تصدير PDF
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الإيرادات', value: totals.income, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'إجمالي المصروفات', value: totals.expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'صافي الربح', value: totals.profit, icon: DollarSign, color: totals.profit >= 0 ? 'text-blue-600' : 'text-orange-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'هامش الربح', value: null, display: `${profitMargin.toFixed(1)}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <div key={i} className={`rounded-xl border p-5 ${item.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>
                {item.display || formatCurrency(item.value!, currency)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">مقارنة شهرية</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Legend formatter={v => v === 'income' ? 'الإيرادات' : 'المصروفات'} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="income" fill="#10B981" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="expenses" fill="#EF4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expenses Pie */}
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">توزيع المصروفات</h3>
            {expenseBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">لا توجد بيانات</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      dataKey="amount" paddingAngle={3}>
                      {expenseBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {expenseBreakdown.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{item.name}</span>
                      <span className="text-xs font-medium text-foreground">{item.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">تطور الإيرادات</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line dataKey="income" stroke="#10B981" strokeWidth={3} dot={{ r: 5, fill: '#10B981' }} name="الإيرادات" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">مصادر الإيرادات</h3>
            <div className="space-y-3">
              {incomeBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات</p>
              ) : incomeBreakdown.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <div className="flex gap-3">
                      <span className="text-emerald-600 font-semibold">{formatCurrency(item.amount, currency)}</span>
                      <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expense' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">تطور المصروفات</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line dataKey="expenses" stroke="#EF4444" strokeWidth={3} dot={{ r: 5, fill: '#EF4444' }} name="المصروفات" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">تفاصيل المصروفات</h3>
            <div className="space-y-3">
              {expenseBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات</p>
              ) : expenseBreakdown.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <div className="flex gap-3">
                      <span className="text-red-600 font-semibold">{formatCurrency(item.amount, currency)}</span>
                      <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color || '#EF4444' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pl' && (
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-5">قائمة الأرباح والخسائر</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">الشهر</th>
                  <th className="text-center py-3 px-4 font-medium text-emerald-600">الإيرادات</th>
                  <th className="text-center py-3 px-4 font-medium text-red-600">المصروفات</th>
                  <th className="text-center py-3 px-4 font-medium text-blue-600">صافي الربح</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">الهامش</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3.5 px-4 font-medium text-foreground">{row.month}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-semibold">{formatCurrency(row.income, currency)}</td>
                    <td className="py-3.5 px-4 text-center text-red-600 font-semibold">{formatCurrency(row.expenses, currency)}</td>
                    <td className={cn('py-3.5 px-4 text-center font-bold', row.profit >= 0 ? 'text-blue-600' : 'text-orange-600')}>
                      {formatCurrency(row.profit, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-muted-foreground text-xs">
                      {row.income > 0 ? `${((row.profit / row.income) * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t-2">
                  <td className="py-3.5 px-4 font-bold text-foreground">الإجمالي</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">{formatCurrency(totals.income, currency)}</td>
                  <td className="py-3.5 px-4 text-center text-red-600 font-bold">{formatCurrency(totals.expenses, currency)}</td>
                  <td className={cn('py-3.5 px-4 text-center font-bold', totals.profit >= 0 ? 'text-blue-700' : 'text-orange-600')}>
                    {formatCurrency(totals.profit, currency)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground font-semibold text-sm">
                    {totals.income > 0 ? `${((totals.profit / totals.income) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

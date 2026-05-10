'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Building2, Users, AlertTriangle } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function ConstructionReportsPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('SAR')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/construction/reports?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  const fmt = (n: number) => formatCurrency(n, currency)

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
    </div>
  )

  if (!data) return (
    <div className="p-6 text-center text-muted-foreground">فشل تحميل التقارير</div>
  )

  const { summary, projectSummary, expensesByCategory, workers } = data

  const catData = Object.entries(expensesByCategory as Record<string, number>).map(([name, value]) => ({ name, value }))
  const projectChartData = (projectSummary as any[]).slice(0, 8).map((p: any) => ({ name: p.name.slice(0, 12), income: p.income, costs: p.costs, profit: p.profit }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">تقارير البناء والتشطيبات</h1>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يوم</option>
          <option value={90}>آخر 3 أشهر</option>
          <option value={180}>آخر 6 أشهر</option>
          <option value={365}>آخر سنة</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs">إجمالي الإيرادات</span></div>
          <p className="text-xl font-bold text-green-800 dark:text-green-300">{fmt(summary.totalIncoming)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1"><TrendingDown className="w-4 h-4" /><span className="text-xs">إجمالي التكاليف</span></div>
          <p className="text-xl font-bold text-red-800 dark:text-red-300">{fmt(summary.totalExpenses + summary.totalMaterials + summary.totalOutgoing)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${summary.netProfit >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'}`}>
          <div className={`flex items-center gap-2 mb-1 ${summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}><DollarSign className="w-4 h-4" /><span className="text-xs">صافي الربح</span></div>
          <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-orange-800 dark:text-orange-300'}`}>{fmt(summary.netProfit)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1"><Building2 className="w-4 h-4" /><span className="text-xs">المشاريع</span></div>
          <div className="flex items-end gap-2">
            <p className="text-xl font-bold text-purple-800 dark:text-purple-300">{summary.totalProjects}</p>
            <p className="text-xs text-muted-foreground mb-0.5">مشروع ({summary.statusCounts.active} نشط)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Profit Chart */}
        {projectChartData.length > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold text-sm mb-4">ربح المشاريع</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={projectChartData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costs"  name="التكاليف"  fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="الربح"     fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expenses by Category */}
        {catData.length > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold text-sm mb-4">المصروفات حسب الفئة</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Project Summary Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">ملخص المشاريع</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المشروع</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">الإيرادات</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">التكاليف</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">الربح</th>
            </tr>
          </thead>
          <tbody>
            {(projectSummary as any[]).map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-left text-green-600 font-medium">{fmt(p.income)}</td>
                <td className="px-4 py-3 text-left text-red-500 font-medium">{fmt(p.costs)}</td>
                <td className={`px-4 py-3 text-left font-bold ${p.profit >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{fmt(p.profit)}</td>
              </tr>
            ))}
            {projectSummary.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Workers */}
      {workers.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-3">العمال</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(workers as any[]).map((w: any) => (
              <div key={w.id} className="border rounded-xl p-3 text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mx-auto mb-2">
                  {w.name[0]}
                </div>
                <p className="text-sm font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.job_type}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {w.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Package,
  AlertTriangle, Lightbulb, RefreshCw, Loader2, DollarSign,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Props {
  initialData: any
  currency: string
}

const PERIOD_OPTIONS = [
  { label: '٧ أيام', days: 7 },
  { label: '٣٠ يوم', days: 30 },
  { label: '٩٠ يوم', days: 90 },
  { label: '١٢ شهر', days: 365 },
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const INSIGHT_STYLES = {
  danger:  'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
  warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
  info:    'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
}
const INSIGHT_ICONS = {
  danger: '🔴',
  warning: '🟡',
  info: '🔵',
}

export function ReportsClient({ initialData, currency }: Props) {
  const [data, setData] = useState(initialData)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'overview' | 'products' | 'customers' | 'inventory'>('overview')

  const loadData = useCallback(async (d: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/data?days=${d}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePeriod = (d: number) => {
    setDays(d)
    loadData(d)
  }

  const t = data?.totals
  const fmt = (v: number) => formatCurrency(v, currency)

  const tabs = [
    { key: 'overview',   label: 'نظرة عامة',   icon: TrendingUp },
    { key: 'products',   label: 'المنتجات',      icon: Package },
    { key: 'customers',  label: 'العملاء',        icon: Users },
    { key: 'inventory',  label: 'المخزون',        icon: ShoppingCart },
  ] as const

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header + Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">التقارير والتحليلات</h1>
          <p className="text-sm text-muted-foreground">آخر {days} يوم</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map(p => (
            <button key={p.days} onClick={() => handlePeriod(p.days)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                days === p.days ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-accent')}>
              {p.label}
            </button>
          ))}
          <button onClick={() => loadData(days)} disabled={loading}
            className="p-1.5 border rounded-lg hover:bg-accent text-muted-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Smart Insights */}
      {data?.insights?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> تنبيهات ذكية
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.insights.map((ins: any, i: number) => (
              <div key={i} className={cn('flex items-start gap-2 p-3 rounded-xl border text-sm', INSIGHT_STYLES[ins.type as keyof typeof INSIGHT_STYLES])}>
                <span className="shrink-0">{INSIGHT_ICONS[ins.type as keyof typeof INSIGHT_ICONS]}</span>
                {ins.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي المبيعات', value: fmt(t.revenue), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', trend: null },
            { label: 'الربح الإجمالي', value: fmt(t.grossProfit), icon: TrendingUp, color: t.grossProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-green-50 dark:bg-green-900/20', trend: t.revenue > 0 ? ((t.grossProfit / t.revenue) * 100).toFixed(1) + '%' : null },
            { label: 'صافي الربح', value: fmt(t.netProfit), icon: t.netProfit >= 0 ? TrendingUp : TrendingDown, color: t.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: null },
            { label: 'عدد الفواتير', value: t.orders.toLocaleString('ar'), icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', trend: `متوسط ${fmt(t.avgOrder)}` },
          ].map((card, i) => {
            const Icon = card.icon
            return (
              <div key={i} className={cn('rounded-2xl p-4', card.bg)}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <Icon className={cn('w-4 h-4', card.color)} />
                </div>
                <p className={cn('text-xl font-bold', card.color)}>{card.value}</p>
                {card.trend && <p className="text-xs text-muted-foreground mt-0.5">{card.trend}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl p-5">
            <h3 className="font-semibold mb-4 text-sm">المبيعات اليومية</h3>
            {data?.dailySales?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="المبيعات" />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-4 text-sm">أفضل ١٠ منتجات</h3>
              {data?.topProducts?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topProducts.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Bar dataKey="revenue" name="المبيعات" radius={4}>
                      {data.topProducts.slice(0, 5).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-semibold mb-4 text-sm">ملخص مالي</h3>
              <div className="space-y-3">
                {t && [
                  { label: 'إجمالي المبيعات', value: t.revenue, color: 'bg-blue-500' },
                  { label: 'تكلفة البضاعة', value: t.cost, color: 'bg-orange-400' },
                  { label: 'المصروفات', value: t.expenses, color: 'bg-red-400' },
                  { label: 'صافي الربح', value: t.netProfit, color: t.netProfit >= 0 ? 'bg-green-500' : 'bg-red-600' },
                ].map((row, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={cn('font-medium', row.value < 0 && 'text-red-500')}>{fmt(row.value)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', row.color)}
                        style={{ width: `${Math.min(100, Math.abs(row.value) / (t.revenue || 1) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">أفضل المنتجات مبيعاً</h3>
            </div>
            {data?.topProducts?.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">#</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المنتج</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الكمية</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المبيعات</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الربح</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الهامش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topProducts.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5">{p.qty.toLocaleString('ar')}</td>
                      <td className="px-4 py-2.5 text-blue-600 font-medium">{fmt(p.revenue)}</td>
                      <td className={cn('px-4 py-2.5 font-medium', p.profit >= 0 ? 'text-green-600' : 'text-red-500')}>{fmt(p.profit)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          p.margin >= 30 ? 'bg-green-100 text-green-700' :
                          p.margin >= 10 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700')}>
                          {p.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState label="لا توجد مبيعات في هذه الفترة" />}
          </div>
        </div>
      )}

      {/* ── CUSTOMERS TAB ── */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">أفضل العملاء</h3>
            </div>
            {data?.topCustomers?.length > 0 ? (
              <div className="divide-y divide-border">
                {data.topCustomers.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(c.spent)}</p>
                    </div>
                    <div className="w-20 h-1.5 bg-muted rounded-full">
                      <div className="h-full bg-primary rounded-full"
                        style={{ width: `${(c.spent / (data.topCustomers[0]?.spent || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="لا يوجد عملاء بمشتريات" />}
          </div>

          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-amber-50 dark:bg-amber-900/20">
              <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> أعلى الديون
              </h3>
            </div>
            {data?.highDebt?.length > 0 ? (
              <div className="divide-y divide-border">
                {data.highDebt.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-medium">{c.name}</p>
                    <span className="text-sm font-bold text-red-500">{fmt(c.debt)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="لا توجد ديون مستحقة" />}
          </div>
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-red-50 dark:bg-red-900/20">
              <h3 className="font-semibold text-sm text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> منتجات على وشك النفاد
              </h3>
            </div>
            {data?.lowStock?.length > 0 ? (
              <div className="divide-y divide-border">
                {data.lowStock.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <span className={cn('text-sm font-bold tabular-nums', p.stock === 0 ? 'text-red-600' : 'text-amber-600')}>
                      {p.stock === 0 ? 'نفد' : `${p.stock} قطعة`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 text-green-600 text-sm">
                ✅ المخزون في حالة جيدة
              </div>
            )}
          </div>

          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4 text-muted-foreground" />
                مخزون راكد (لم يُباع)
              </h3>
            </div>
            {data?.deadStock?.length > 0 ? (
              <div className="divide-y divide-border">
                {data.deadStock.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.stock} قطعة</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{fmt(p.value)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState label={`لا يوجد مخزون راكد خلال ${days} يوم`} />}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
      لا توجد بيانات كافية لعرض الرسم البياني
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground text-sm">{label}</div>
  )
}

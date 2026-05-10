'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import {
  Building2, Users, CheckSquare, TrendingUp, TrendingDown,
  ArrowUpRight, Clock, AlertTriangle, DollarSign,
} from 'lucide-react'

interface Project { id: string; name: string; status: string; expected_cost: number; actual_cost: number; start_date: string; end_date: string | null }
interface Worker  { id: string; name: string; job_type: string; status: string; daily_rate: number }
interface Task    { id: string; title: string; status: string; project_id: string; due_date: string | null; priority: string }
interface Payment { type: string; amount: number; payment_date: string; project_id: string | null }
interface Expense { amount: number; category: string; expense_date: string; project_id: string | null }

const STATUS_COLORS: Record<string, string> = {
  planning:  'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-500',
}
const STATUS_AR: Record<string, string> = {
  planning: 'تخطيط', active: 'نشط', on_hold: 'موقوف', completed: 'مكتمل', cancelled: 'ملغي',
}
const TASK_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار', in_progress: 'جارٍ', done: 'مكتمل', cancelled: 'ملغي',
}
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500', medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600', urgent: 'bg-red-100 text-red-600',
}

export function ConstructionDashboardClient({ projects, workers, tasks, payments, expenses, currency }: {
  projects: Project[]; workers: Worker[]; tasks: Task[]; payments: Payment[]; expenses: Expense[]; currency: string
}) {
  const fmt = (n: number) => formatCurrency(n, currency)

  const stats = useMemo(() => {
    const totalIncome  = payments.filter(p => p.type === 'incoming').reduce((s, p) => s + Number(p.amount), 0)
    const totalPaid    = payments.filter(p => p.type === 'outgoing').reduce((s, p) => s + Number(p.amount), 0)
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const activeProjects   = projects.filter(p => p.status === 'active').length
    const completedProjects = projects.filter(p => p.status === 'completed').length
    const activeWorkers    = workers.filter(w => w.status === 'active').length
    const pendingTasks     = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
    const overrunProjects  = projects.filter(p => Number(p.actual_cost) > Number(p.expected_cost)).length
    return { totalIncome, totalPaid, totalExpense, activeProjects, completedProjects, activeWorkers, pendingTasks, overrunProjects }
  }, [projects, workers, tasks, payments, expenses])

  const recentTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').slice(0, 8)
  const recentPayments = payments.slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التشطيبات والبناء</h1>
          <p className="text-muted-foreground text-sm mt-0.5">نظرة عامة على المشاريع والعمال والمصروفات</p>
        </div>
        <Link href="/dashboard/construction/projects"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          إدارة المشاريع
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="المشاريع النشطة"   value={stats.activeProjects}         icon={Building2}   color="blue"  href="/dashboard/construction/projects" />
        <StatCard label="العمال النشطون"     value={stats.activeWorkers}          icon={Users}       color="green" href="/dashboard/construction/workers" />
        <StatCard label="المهام المعلقة"     value={stats.pendingTasks}           icon={CheckSquare} color="orange" href="/dashboard/construction/tasks" />
        <StatCard label="مشاريع تجاوزت الميزانية" value={stats.overrunProjects} icon={AlertTriangle} color="red" href="/dashboard/construction/projects" />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">إجمالي الإيرادات</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{fmt(stats.totalIncome)}</p>
          <Link href="/dashboard/construction/payments" className="text-xs text-green-600 hover:underline mt-1 block">عرض المدفوعات ←</Link>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium">إجمالي المصروفات</span>
          </div>
          <p className="text-2xl font-bold text-red-800 dark:text-red-300">{fmt(stats.totalExpense + stats.totalPaid)}</p>
          <Link href="/dashboard/construction/expenses" className="text-xs text-red-600 hover:underline mt-1 block">عرض المصروفات ←</Link>
        </div>
        <div className={`border rounded-xl p-4 ${stats.totalIncome - stats.totalExpense - stats.totalPaid >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'}`}>
          <div className={`flex items-center gap-2 mb-1 ${stats.totalIncome - stats.totalExpense - stats.totalPaid >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">صافي الربح</span>
          </div>
          <p className={`text-2xl font-bold ${stats.totalIncome - stats.totalExpense - stats.totalPaid >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-orange-800 dark:text-orange-300'}`}>
            {fmt(stats.totalIncome - stats.totalExpense - stats.totalPaid)}
          </p>
          <Link href="/dashboard/construction/reports" className="text-xs text-blue-600 hover:underline mt-1 block">عرض التقارير ←</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects List */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">المشاريع الحالية</h2>
            <Link href="/dashboard/construction/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {projects.slice(0, 6).map(p => {
              const overrun = Number(p.actual_cost) > Number(p.expected_cost)
              return (
                <Link key={p.id} href={`/dashboard/construction/projects/${p.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.start_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {overrun && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_AR[p.status] || p.status}
                    </span>
                  </div>
                </Link>
              )
            })}
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد مشاريع بعد</p>
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">المهام المعلقة</h2>
            <Link href="/dashboard/construction/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  {t.due_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {t.due_date}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-500'}`}>
                  {t.priority === 'urgent' ? 'عاجل' : t.priority === 'high' ? 'عالي' : t.priority === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
              </div>
            ))}
            {recentTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد مهام معلقة</p>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">آخر المدفوعات</h2>
            <Link href="/dashboard/construction/payments" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentPayments.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                <div>
                  <p className="text-sm font-medium">{p.type === 'incoming' ? 'دفعة واردة' : 'دفعة صادرة'}</p>
                  <p className="text-xs text-muted-foreground">{p.payment_date}</p>
                </div>
                <span className={`text-sm font-bold ${p.type === 'incoming' ? 'text-green-600' : 'text-red-600'}`}>
                  {p.type === 'incoming' ? '+' : '-'}{fmt(Number(p.amount))}
                </span>
              </div>
            ))}
            {recentPayments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد مدفوعات بعد</p>
            )}
          </div>
        </div>

        {/* Workers */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">العمال</h2>
            <Link href="/dashboard/construction/workers" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {workers.slice(0, 6).map(w => (
              <div key={w.id} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                    {w.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.job_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{fmt(Number(w.daily_rate))}</p>
                  <p className="text-xs text-muted-foreground">يومياً</p>
                </div>
              </div>
            ))}
            {workers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد عمال بعد</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, href }: {
  label: string; value: number; icon: any; color: string; href: string
}) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
    red:    'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  }
  return (
    <Link href={href} className={`border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow ${colorMap[color]}`}>
      <Icon className="w-8 h-8 shrink-0 opacity-80" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </Link>
  )
}

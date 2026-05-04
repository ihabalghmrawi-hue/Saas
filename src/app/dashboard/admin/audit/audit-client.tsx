'use client'

import { useState, useMemo } from 'react'
import { Search, Shield, AlertTriangle, Info } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props { logs: any[] }

const ACTION_LABELS: Record<string, { label: string; color: string; risk: 'low' | 'medium' | 'high' }> = {
  'sale.created':     { label: 'بيع جديد',          color: 'bg-green-100 text-green-700',  risk: 'low' },
  'sale.cancelled':   { label: 'إلغاء بيع',         color: 'bg-red-100 text-red-700',      risk: 'high' },
  'sale.returned':    { label: 'مرتجع بيع',         color: 'bg-orange-100 text-orange-700', risk: 'medium' },
  'return.created':   { label: 'مرتجع',             color: 'bg-orange-100 text-orange-700', risk: 'medium' },
  'payment.added':    { label: 'دفعة عميل',         color: 'bg-blue-100 text-blue-700',    risk: 'low' },
  'customer.created': { label: 'عميل جديد',         color: 'bg-purple-100 text-purple-700', risk: 'low' },
  'customer.updated': { label: 'تعديل عميل',        color: 'bg-purple-100 text-purple-700', risk: 'low' },
  'customer.deleted': { label: 'حذف عميل',          color: 'bg-red-100 text-red-700',      risk: 'high' },
  'product.created':  { label: 'منتج جديد',         color: 'bg-teal-100 text-teal-700',    risk: 'low' },
  'product.updated':  { label: 'تعديل منتج',        color: 'bg-teal-100 text-teal-700',    risk: 'low' },
  'product.deleted':  { label: 'حذف منتج',          color: 'bg-red-100 text-red-700',      risk: 'high' },
  'purchase.created': { label: 'مشتريات جديدة',     color: 'bg-indigo-100 text-indigo-700', risk: 'low' },
  'expense.created':  { label: 'مصروف جديد',       color: 'bg-pink-100 text-pink-700',    risk: 'low' },
  'expense.deleted':  { label: 'حذف مصروف',        color: 'bg-red-100 text-red-700',      risk: 'high' },
  'shift.opened':     { label: 'فتح وردية',         color: 'bg-green-100 text-green-700',  risk: 'low' },
  'shift.closed':     { label: 'إغلاق وردية',      color: 'bg-gray-100 text-gray-700',    risk: 'low' },
  'staff.created':    { label: 'موظف جديد',         color: 'bg-violet-100 text-violet-700', risk: 'medium' },
  'staff.deleted':    { label: 'حذف موظف',          color: 'bg-red-100 text-red-700',      risk: 'high' },
}

const ENTITY_LABELS: Record<string, string> = {
  sale: 'مبيعات', return: 'مرتجعات', customer: 'عملاء',
  product: 'منتجات', purchase: 'مشتريات', expense: 'مصروفات',
  shift: 'ورديات', staff: 'موظفين',
}

export function AuditClient({ logs }: Props) {
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [filterStaff, setFilterStaff] = useState('')

  const uniqueStaff = useMemo(() => [...new Set(logs.map(l => l.staff_name).filter(Boolean))], [logs])

  const filtered = useMemo(() => logs.filter(log => {
    const action = ACTION_LABELS[log.action]
    const matchSearch = !search ||
      (log.staff_name || '').toLowerCase().includes(search.toLowerCase()) ||
      log.action.includes(search) ||
      (log.entity_id || '').includes(search)
    const matchEntity = !filterEntity || log.entity_type === filterEntity
    const matchRisk = !filterRisk || action?.risk === filterRisk
    const matchStaff = !filterStaff || log.staff_name === filterStaff
    return matchSearch && matchEntity && matchRisk && matchStaff
  }), [logs, search, filterEntity, filterRisk, filterStaff])

  const highRiskCount = logs.filter(l => ACTION_LABELS[l.action]?.risk === 'high').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            سجل الأحداث
          </h1>
          <p className="text-sm text-muted-foreground">{logs.length} حدث · آخر 200 سجل</p>
        </div>
        {highRiskCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4" />
            {highRiskCount} حدث عالي الخطورة
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي الأحداث', value: logs.length, color: 'text-foreground' },
          { label: 'متوسط الخطورة', value: logs.filter(l => ACTION_LABELS[l.action]?.risk === 'medium').length, color: 'text-amber-600' },
          { label: 'عالي الخطورة', value: highRiskCount, color: 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="bg-card border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
        </div>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الأنواع</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل مستويات الخطورة</option>
          <option value="high">عالي</option>
          <option value="medium">متوسط</option>
          <option value="low">منخفض</option>
        </select>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الموظفين</option>
          {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Log Table */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحدث</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموظف</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المعرّف</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الخطورة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد سجلات</td></tr>
              ) : (
                filtered.map(log => {
                  const action = ACTION_LABELS[log.action]
                  const riskColor = action?.risk === 'high' ? 'bg-red-50 dark:bg-red-900/10' :
                    action?.risk === 'medium' ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                  return (
                    <tr key={log.id} className={cn('hover:bg-muted/30 transition-colors', riskColor)}>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', action?.color || 'bg-gray-100 text-gray-700')}>
                          {action?.label || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-xs">{log.staff_name || 'النظام'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{ENTITY_LABELS[log.entity_type] || log.entity_type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{log.entity_id?.slice(0, 8) || '—'}</td>
                      <td className="px-4 py-2.5">
                        {action?.risk === 'high' ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />عالي
                          </span>
                        ) : action?.risk === 'medium' ? (
                          <span className="text-amber-600 text-xs">متوسط</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">منخفض</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(log.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

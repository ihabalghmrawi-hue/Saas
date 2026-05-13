'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Clock, User, AlertTriangle,
  Search, Filter, ArrowUpDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ApprovalHistoryEntry } from '@/lib/timeline/types'

interface ApprovalHistoryProps {
  entries: ApprovalHistoryEntry[]
  className?: string
}

const decisionFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'approved', label: 'موافق' },
  { key: 'rejected', label: 'مرفوض' },
  { key: 'pending', label: 'معلق' },
  { key: 'delegated', label: 'مفوض' },
  { key: 'escalated', label: 'مصعد' },
] as const

const sortOptions = [
  { key: 'date', label: 'حسب التاريخ' },
  { key: 'priority', label: 'حسب الأولوية' },
]

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
}

const decisionColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  delegated: 'bg-purple-100 text-purple-800 border-purple-200',
  escalated: 'bg-orange-100 text-orange-800 border-orange-200',
}

const decisionIcons: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
  delegated: User,
  escalated: AlertTriangle,
}

const decisionLabels: Record<string, string> = {
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  pending: 'معلق',
  delegated: 'مفوض',
  escalated: 'مصعد',
}

function calculateSLADisplay(slaMinutes: number, createdAt: number, respondedAt?: number) {
  const slaMs = slaMinutes * 60 * 1000
  const now = Date.now()
  const end = respondedAt || now
  const elapsed = end - createdAt
  const percentage = Math.min(100, Math.round((elapsed / slaMs) * 100))
  const remaining = slaMs - elapsed
  const isOverdue = remaining <= 0

  let label: string
  if (respondedAt) {
    if (isOverdue) {
      const overBy = Math.abs(remaining)
      const mins = Math.round(overBy / 60000)
      label = `تجاوز بـ ${mins} دقيقة`
    } else {
      const mins = Math.round(remaining / 60000)
      label = `ضمن SLA (${mins} دقيقة متبقية)`
    }
  } else {
    if (isOverdue) {
      label = 'متأخر عن SLA'
    } else {
      const mins = Math.round(remaining / 60000)
      label = `${mins} دقيقة متبقية`
    }
  }

  return { label, isOverdue, percentage }
}

export function ApprovalHistory({ entries, className }: ApprovalHistoryProps) {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date')

  const kpi = useMemo(() => ({
    total: entries.length,
    approved: entries.filter((e) => e.decision === 'approved').length,
    rejected: entries.filter((e) => e.decision === 'rejected').length,
    pending: entries.filter((e) => e.decision === 'pending').length,
  }), [entries])

  const filtered = useMemo(() => {
    let result = [...entries]

    if (filter !== 'all') {
      result = result.filter((e) => e.decision === filter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.workflowName.toLowerCase().includes(q) ||
          e.requestedBy.name.toLowerCase().includes(q)
      )
    }

    if (sortBy === 'date') {
      result.sort((a, b) => b.createdAt - a.createdAt)
    } else {
      const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      result.sort((a, b) => (priorityRank[a.priority] || 99) - (priorityRank[b.priority] || 99))
    }

    return result
  }, [entries, filter, searchQuery, sortBy])

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">إجمالي الموافقات</p>
          <p className="text-xl font-bold mt-1">{kpi.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">تمت الموافقة</p>
          <p className="text-xl font-bold mt-1 text-green-600">{kpi.approved}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">مرفوضة</p>
          <p className="text-xl font-bold mt-1 text-red-600">{kpi.rejected}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">معلقة</p>
          <p className="text-xl font-bold mt-1 text-yellow-600">{kpi.pending}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
        {decisionFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الموافقات..."
            className="w-full rounded-lg border border-input bg-background py-2 pr-10 pl-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border px-2 py-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
            className="bg-transparent text-xs font-medium outline-none"
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <XCircle className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">لا توجد موافقات للعرض</p>
          </div>
        ) : (
          filtered.map((entry) => {
            const DecisionIcon = decisionIcons[entry.decision]
            const slaInfo = calculateSLADisplay(entry.slaMinutes, entry.createdAt, entry.respondedAt)
            return (
              <div
                key={entry.id}
                className="rounded-lg border bg-card p-3 space-y-2 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={cn('gap-1', decisionColors[entry.decision])}>
                      <DecisionIcon className="h-3 w-3" />
                      {decisionLabels[entry.decision]}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {entry.workflowName} / {entry.stepName}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px]', priorityColors[entry.priority])}>
                    {entry.priority === 'critical' ? 'حرج' :
                     entry.priority === 'high' ? 'عالية' :
                     entry.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </Badge>
                </div>

                <h4 className="text-sm font-semibold">{entry.title}</h4>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    طلب: {entry.requestedBy.name}
                  </span>
                  {entry.decidedBy && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      قرار: {entry.decidedBy.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.createdAt).toLocaleString('ar-SA')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        slaInfo.isOverdue ? 'bg-destructive' : 'bg-green-500'
                      )}
                      style={{ width: `${Math.min(slaInfo.percentage, 100)}%` }}
                    />
                  </div>
                  <span className={cn('shrink-0', slaInfo.isOverdue && 'text-destructive font-medium')}>
                    {slaInfo.label}
                  </span>
                </div>

                {entry.comments && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    {entry.comments}
                  </p>
                )}

                {entry.escalationCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-orange-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>تم التصعيد {entry.escalationCount} مرة</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

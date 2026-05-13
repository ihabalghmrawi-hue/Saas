'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Shield, Clock, User, FileText, CheckCircle2,
  XCircle, AlertTriangle, Search, Filter, Eye,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMockAuditTrail } from '@/lib/workbench/mock-data'
import type { AuditTrailEntry } from '@/lib/workbench/types'

export interface AuditOverlayProps {
  entries: AuditTrailEntry[]
  open: boolean
  onClose: () => void
  entityId?: string
  entityType?: string
}

const actionTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  create: FileText,
  update: FileText,
  approve: CheckCircle2,
  reject: XCircle,
  post: FileText,
  validate: Shield,
  system: Shield,
}

const actionTypeColors: Record<string, string> = {
  create: 'text-blue-600 bg-blue-50',
  update: 'text-amber-600 bg-amber-50',
  approve: 'text-green-600 bg-green-50',
  reject: 'text-red-600 bg-red-50',
  post: 'text-purple-600 bg-purple-50',
  validate: 'text-cyan-600 bg-cyan-50',
  system: 'text-gray-600 bg-gray-50',
}

const actionTypeLabels: Record<string, string> = {
  all: 'الكل',
  create: 'إنشاء',
  update: 'تحديث',
  approve: 'اعتماد',
  reject: 'رفض',
  post: 'ترحيل',
  validate: 'تدقيق',
  system: 'نظام',
}

const filterTypes = ['all', 'create', 'update', 'approve', 'reject', 'post', 'validate', 'system'] as const

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days < 30) return `منذ ${days} يوم`
  return `منذ ${Math.floor(days / 30)} شهر`
}

export function AuditOverlay({
  entries: externalEntries,
  open,
  onClose,
  entityId,
  entityType,
}: AuditOverlayProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const mockEntries = externalEntries ?? generateMockAuditTrail()

  const sortedEntries = [...mockEntries].sort((a, b) => b.timestamp - a.timestamp)

  const filteredEntries = sortedEntries.filter((entry) => {
    if (activeFilter !== 'all' && entry.type !== activeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.actor.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center transition-all duration-300',
        open ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none',
      )}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'relative w-full max-w-3xl bg-background rounded-t-2xl shadow-2xl flex flex-col',
          'transition-all duration-300 ease-out max-h-[85vh]',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        dir="rtl"
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">سجل التدقيق</h2>
              {entityType && (
                <p className="text-xs text-muted-foreground">
                  {entityType} - {entityId?.slice(0, 8)}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b shrink-0">
          {filterTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveFilter(type)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                activeFilter === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {actionTypeLabels[type]}
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في السجل..."
              className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد إدخالات في سجل التدقيق</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredEntries.map((entry) => {
                const Icon = actionTypeIcons[entry.type] || Shield
                const colors = actionTypeColors[entry.type] || 'text-gray-600 bg-gray-50'
                const absDate = new Date(entry.timestamp).toLocaleDateString('ar-SA')
                const absTime = new Date(entry.timestamp).toLocaleTimeString('ar-SA')

                return (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className={cn('p-2 rounded-lg shrink-0', colors)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.action}</span>
                        <span className="text-xs text-muted-foreground">بواسطة</span>
                        <span className="text-xs font-medium flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.actor}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                        <span>({absDate} {absTime})</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
          <span className="text-xs text-muted-foreground">
            إجمالي {filteredEntries.length} {filteredEntries.length === 1 ? 'إدخال' : 'إدخالات'}
          </span>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            تصدير السجل
          </Button>
        </div>
      </div>
    </div>
  )
}

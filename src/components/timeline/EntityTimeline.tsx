'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Clock, Search, AlertCircle } from 'lucide-react'
import { TimelineCard } from './TimelineCard'
import type { TimelineEntry, TimelineFilter } from '@/lib/timeline/types'

interface EntityTimelineProps {
  entries: TimelineEntry[]
  entityType?: string
  entityId?: string
  title?: string
  className?: string
  maxHeight?: string
}

const filterPills: { key: string; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'operation', label: 'عمليات' },
  { key: 'approval', label: 'اعتمادات' },
  { key: 'audit', label: 'تدقيق' },
  { key: 'system', label: 'نظام' },
]

const typeKeyMap: Record<string, TimelineEntry['type']> = {
  operation: 'operation',
  approval: 'approval',
  audit: 'audit',
  system: 'system',
}

export function EntityTimeline({
  entries,
  entityType,
  entityId,
  title = 'النشاطات',
  className,
  maxHeight,
}: EntityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEntries = useMemo(() => {
    let result = entries

    if (entityType) {
      result = result.filter((e) => e.entityType === entityType)
    }
    if (entityId) {
      result = result.filter((e) => e.entityId === entityId)
    }

    if (activeFilter !== 'all' && typeKeyMap[activeFilter]) {
      result = result.filter((e) => e.type === typeKeyMap[activeFilter])
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.entityName.toLowerCase().includes(q),
      )
    }

    return result
  }, [entries, entityType, entityId, activeFilter, searchQuery])

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{title}</h3>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            ({entries.length})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filterPills.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setActiveFilter(pill.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeFilter === pill.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث في النشاطات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div
        className={cn('space-y-2 overflow-y-auto', maxHeight ? `max-h-[${maxHeight}]` : 'max-h-[500px]')}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <TimelineCard key={entry.id} entry={entry} compact />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">لا توجد نشاطات للعرض</p>
          </div>
        )}
      </div>
    </div>
  )
}

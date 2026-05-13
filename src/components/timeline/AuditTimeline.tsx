'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Shield, Search, Filter, Download, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineCard } from './TimelineCard'
import type { TimelineEntry } from '@/lib/timeline/types'

interface AuditTimelineProps {
  entries: TimelineEntry[]
  className?: string
}

const dateRanges = [
  { key: '7d', label: '٧ أيام' },
  { key: '30d', label: '٣٠ يوم' },
  { key: '90d', label: '٩٠ يوم' },
  { key: 'all', label: 'الكل' },
]

const categoryFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'financial_close', label: 'إقفال مالي' },
  { key: 'reconciliation', label: 'تسوية' },
  { key: 'procure_to_pay', label: 'مشتريات' },
  { key: 'payroll', label: 'رواتب' },
]

export function AuditTimeline({ entries, className }: AuditTimelineProps) {
  const [activeDateRange, setActiveDateRange] = useState('30d')
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEntries = useMemo(() => {
    let result = entries

    if (activeDateRange !== 'all') {
      const now = Date.now()
      const ranges: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
      const days = ranges[activeDateRange]
      if (days) {
        const cutoff = now - days * 24 * 60 * 60 * 1000
        result = result.filter((e) => e.timestamp >= cutoff)
      }
    }

    if (activeCategory !== 'all') {
      result = result.filter((e) => e.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.actor.name.toLowerCase().includes(q) ||
          e.entityName.toLowerCase().includes(q),
      )
    }

    return result
  }, [entries, activeDateRange, activeCategory, searchQuery])

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">سجل التدقيق</h3>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            ({entries.length})
          </span>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Download className="h-4 w-4 ml-1" />
          تصدير
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {dateRanges.map((range) => (
          <button
            key={range.key}
            onClick={() => setActiveDateRange(range.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeDateRange === range.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {categoryFilters.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث في سجل التدقيق..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="border-l-2 border-primary/30 pr-4">
              <TimelineCard entry={entry} compact />
              <div className="mt-1 flex items-center gap-3 mr-9">
                <span className="text-xs text-muted-foreground">
                  التصنيف: {entry.category}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  المصدر: {entry.source}
                </span>
                {entry.entityType && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      الكيان: {entry.entityName}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mb-2" />
            <p className="text-sm">لا توجد نتائج للبحث</p>
          </div>
        )}
      </div>
    </div>
  )
}

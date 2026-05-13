'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Activity, Bell, BellOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineCard } from './TimelineCard'
import type { TimelineEntry, ActivityStream } from '@/lib/timeline/types'

interface ActivityFeedProps {
  stream: ActivityStream
  className?: string
  pageSize?: number
}

const categoryFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'entity', label: 'مستندات' },
  { key: 'workflow', label: 'إجراءات' },
  { key: 'approval', label: 'موافقات' },
  { key: 'system', label: 'النظام' },
]

export function ActivityFeed({ stream, className, pageSize = 10 }: ActivityFeedProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const filteredEntries = useMemo(() => {
    let result = stream.entries

    if (activeCategory !== 'all') {
      result = result.filter((e) => e.type === activeCategory)
    }

    return result
  }, [stream.entries, activeCategory])

  const visibleEntries = filteredEntries.slice(0, visibleCount)

  const handleMarkAllRead = () => {
    // visual only
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{stream.name}</h3>
          {stream.unread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {stream.unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'إيقاف التحديث التلقائي' : 'تشغيل التحديث التلقائي'}
          >
            {autoRefresh ? (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            تحديد الكل كمقروء
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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

      <div className="space-y-2">
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <TimelineCard key={entry.id} entry={entry} compact />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BellOff className="h-8 w-8 mb-2" />
            <p className="text-sm">لا توجد نشاطات جديدة</p>
          </div>
        )}
      </div>

      {visibleCount < filteredEntries.length && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((prev) => prev + pageSize)}
          >
            <RefreshCw className="h-4 w-4 ml-1" />
            عرض المزيد
          </Button>
        </div>
      )}
    </div>
  )
}

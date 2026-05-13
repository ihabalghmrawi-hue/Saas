'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Zap, Clock, Radio, Filter,
} from 'lucide-react'
import { TimelineCard } from './TimelineCard'
import type { TimelineEntry } from '@/lib/timeline/types'

interface OperationalEventStreamProps {
  entries: TimelineEntry[]
  realtime?: boolean
  className?: string
}

const severityFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'info', label: 'معلومات' },
  { key: 'warning', label: 'تحذير' },
  { key: 'error', label: 'خطأ' },
  { key: 'success', label: 'نجاح' },
] as const

export function OperationalEventStream({
  entries,
  realtime = false,
  className,
}: OperationalEventStreamProps) {
  const [activeSeverity, setActiveSeverity] = useState('all')
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!realtime) return
    const interval = setInterval(() => {
      setLastUpdate(Date.now())
    }, 10000)
    return () => clearInterval(interval)
  }, [realtime])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries.length])

  const filtered = useMemo(() => {
    let result = [...entries]
    if (activeSeverity !== 'all') {
      result = result.filter((e) => (e.severity || 'info') === activeSeverity)
    }
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }, [entries, activeSeverity])

  const secondsAgo = Math.floor((Date.now() - lastUpdate) / 1000)

  return (
    <div className={cn('space-y-3', className)} dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">الأحداث التشغيلية</h3>
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            مباشر
          </span>
        </div>
      </div>

      {realtime && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>آخر تحديث: منذ {secondsAgo} ثوان</span>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
        {severityFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveSeverity(f.key)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeSeverity === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="space-y-2 overflow-y-auto max-h-[500px]"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Zap className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">لا توجد أحداث تشغيلية</p>
          </div>
        ) : (
          filtered.map((entry) => (
            <TimelineCard key={entry.id} entry={entry} compact />
          ))
        )}
      </div>
    </div>
  )
}

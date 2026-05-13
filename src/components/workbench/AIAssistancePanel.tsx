'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Sparkles, Lightbulb, AlertTriangle, TrendingUp,
  Zap, ChevronRight, ThumbsUp, ThumbsDown,
  X, Loader2, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMockAIInsights } from '@/lib/workbench/mock-data'
import type { AIInsight } from '@/lib/workbench/types'

export interface AIAssistancePanelProps {
  open: boolean
  onClose: () => void
  domain?: string
  entityId?: string
  insights?: AIInsight[]
  className?: string
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  anomaly: AlertTriangle,
  recommendation: Lightbulb,
  insight: TrendingUp,
  summary: Zap,
  optimization: Sparkles,
}

const typeColors: Record<string, string> = {
  anomaly: 'text-red-500 bg-red-50 border-red-200',
  recommendation: 'text-blue-500 bg-blue-50 border-blue-200',
  insight: 'text-purple-500 bg-purple-50 border-purple-200',
  summary: 'text-green-500 bg-green-50 border-green-200',
  optimization: 'text-amber-500 bg-amber-50 border-amber-200',
}

const typeLabels: Record<string, string> = {
  all: 'الجميع',
  anomaly: 'الحالات الشاذة',
  recommendation: 'التوصيات',
  insight: 'الرؤى',
  summary: 'الملخصات',
  optimization: 'التحسين',
}

const categoryFilters = ['all', 'anomaly', 'recommendation', 'insight', 'summary', 'optimization'] as const

export function AIAssistancePanel({
  open,
  onClose,
  domain,
  entityId,
  insights: externalInsights,
  className,
}: AIAssistancePanelProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down' | null>>({})
  const [queryInput, setQueryInput] = useState('')

  const allInsights = externalInsights ?? generateMockAIInsights(domain)

  const filteredInsights = activeFilter === 'all'
    ? allInsights
    : allInsights.filter((i) => i.type === activeFilter)

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedbackState((prev) => ({
      ...prev,
      [id]: prev[id] === type ? null : type,
    }))
  }

  return (
    <div
      className={cn(
        'border-l bg-background flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out',
        open ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0',
        className,
      )}
      style={{ width: open ? 420 : 0, minWidth: open ? 420 : 0 }}
      dir="rtl"
    >
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">المساعدة بالذكاء الاصطناعي</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-1 p-3 border-b overflow-x-auto shrink-0">
        {categoryFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
              activeFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {typeLabels[filter]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredInsights.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد رؤى متاحة لهذا التصنيف</p>
          </div>
        )}

        {filteredInsights.map((insight) => {
          const Icon = typeIcons[insight.type]
          const colors = typeColors[insight.type]
          const feedback = feedbackState[insight.id]
          const confidencePercent = Math.round(insight.confidence * 100) / 100

          return (
            <div
              key={insight.id}
              className={cn('rounded-xl border p-4', colors)}
            >
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', colors)}>
                  {Icon && <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold mb-1">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>نسبة الثقة</span>
                    <span dir="ltr">{confidencePercent}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback(insight.id, 'up')}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      feedback === 'up' ? 'text-green-600 bg-green-50' : 'text-muted-foreground hover:text-green-600 hover:bg-green-50',
                    )}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(insight.id, 'down')}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      feedback === 'down' ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-red-600 hover:bg-red-50',
                    )}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                {insight.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={insight.action.handler}
                    className="h-7 text-xs gap-1"
                  >
                    {insight.action.label}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t p-3 shrink-0">
        <div className="relative">
          <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="شرح هذه العملية..."
            className="flex h-10 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </div>
  )
}

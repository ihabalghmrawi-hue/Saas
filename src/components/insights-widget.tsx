'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp, TrendingUp, Package, Users, DollarSign, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  category: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  title: string
  message: string
  is_read: boolean
  generated_at: string
}

const SEVERITY_STYLES = {
  danger:  { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',    icon: '🔴' },
  warning: { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: '🟡' },
  success: { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: '🟢' },
  info:    { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   icon: '🔵' },
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  sales: TrendingUp,
  inventory: Package,
  customers: Users,
  profit: DollarSign,
  general: Brain,
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'مبيعات',
  inventory: 'مخزون',
  customers: 'عملاء',
  profit: 'أرباح',
  general: 'عام',
}

interface Props {
  initialInsights?: Insight[]
  compact?: boolean
}

export function InsightsWidget({ initialInsights, compact = false }: Props) {
  const [insights, setInsights] = useState<Insight[]>(initialInsights || [])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(!compact)
  const [hasAI, setHasAI] = useState(false)

  const loadInsights = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/insights/generate')
      if (res.ok) setInsights(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const regenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/insights/generate', { method: 'POST' })
      const data = await res.json()
      if (data.hasAI) setHasAI(true)
      await loadInsights()
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (!initialInsights || initialInsights.length === 0) loadInsights()
  }, [])

  const dangerCount = insights.filter(i => i.severity === 'danger').length
  const warningCount = insights.filter(i => i.severity === 'warning').length

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5">
              الرؤى الذكية
              {hasAI && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">AI</span>}
            </p>
            {insights.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {dangerCount > 0 && <span className="text-red-500 ml-2">⚠ {dangerCount} تنبيه عاجل</span>}
                {warningCount > 0 && <span className="text-amber-500">{warningCount} تحذير</span>}
                {dangerCount === 0 && warningCount === 0 && `${insights.length} رؤية`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); regenerate() }}
            disabled={generating}
            className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="تحديث الرؤى"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Insights list */}
      {expanded && (
        <div className="border-t divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري التحليل...
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>لا توجد رؤى بعد</p>
              <button onClick={regenerate} className="mt-2 text-primary text-xs hover:underline">
                تحليل البيانات الآن
              </button>
            </div>
          ) : (
            insights.slice(0, compact ? 4 : undefined).map((ins) => {
              const style = SEVERITY_STYLES[ins.severity]
              const CatIcon = CATEGORY_ICONS[ins.category] || Brain
              return (
                <div key={ins.id} className="flex gap-0 hover:bg-muted/20 transition-colors">
                  <div className={cn('w-1 shrink-0', style.bar)} />
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm">{style.icon}</span>
                          <p className="text-sm font-medium text-foreground">{ins.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ins.message}</p>
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', style.badge)}>
                        {CATEGORY_LABELS[ins.category] || ins.category}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          {compact && insights.length > 4 && (
            <div className="px-4 py-2 text-center">
              <a href="/dashboard/insights" className="text-xs text-primary hover:underline">
                عرض كل الرؤى ({insights.length})
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

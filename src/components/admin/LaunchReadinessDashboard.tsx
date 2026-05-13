'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Rocket, CheckCircle2, AlertTriangle, XCircle, ClipboardList,
  Shield, Zap, Activity, FileText, RefreshCw, ChevronDown, ChevronUp,
  Download, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { assessReadiness, type ReadinessReport } from '@/lib/launch/production-readiness'
import { createProductionChecklist, type DeploymentChecklist, type ChecklistItem } from '@/lib/launch/deployment-checklist'
import { getRunbooks, type Runbook, type RunbookStep } from '@/lib/launch/operational-runbooks'

type ChecklistFilter = 'all' | 'passing' | 'failing'

const categoryIcons: Record<string, typeof Shield> = {
  'الأمان': Shield,
  'الأداء': Zap,
  'الموثوقية': Activity,
  'التشغيل': FileText,
  'تجربة المستخدم': Rocket,
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
}

const statusColors: Record<string, string> = {
  pending: 'text-gray-400',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
}

function CircularGauge({ value, size = 180 }: { value: number; size?: number }) {
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center" dir="ltr">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {value}%
        </span>
        <span className="text-sm text-muted-foreground mt-1">جاهزية الإطلاق</span>
      </div>
    </div>
  )
}

function CategoryCard({ name, score }: { name: string; score: number }) {
  const Icon = categoryIcons[name] || Shield
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{name}</span>
        </div>
        <span className="text-lg font-bold" style={{ color }}>{score}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ChecklistSection({ checklist }: { checklist: DeploymentChecklist }) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<ChecklistFilter>('all')

  const categories = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>()
    for (const item of checklist.items) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    return Array.from(map.entries())
  }, [checklist.items])

  const filteredCategories = useMemo(() => {
    return categories.map(([cat, items]) => {
      let filtered = items
      if (filter === 'passing') filtered = items.filter(i => i.validated)
      if (filter === 'failing') filtered = items.filter(i => !i.validated && i.validationFn !== undefined)
      return [cat, filtered] as [string, ChecklistItem[]]
    }).filter(([, items]) => items.length > 0)
  }, [categories, filter])

  const totalValidated = checklist.items.filter(i => i.validated).length

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">قائمة التحقق للإطلاق</h3>
            <span className="text-sm text-muted-foreground">
              ({totalValidated}/{checklist.items.length})
            </span>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'passing', 'failing'] as ChecklistFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md transition-colors',
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
                )}
              >
                {f === 'all' ? 'الكل' : f === 'passing' ? 'ناجح' : 'فاشل'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${(totalValidated / checklist.items.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="divide-y">
        {filteredCategories.map(([category, items]) => {
          const isExpanded = expandedCategories[category] ?? true
          const validatedCount = items.filter(i => i.validated).length

          return (
            <div key={category}>
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{category}</span>
                  <span className="text-xs text-muted-foreground">
                    ({validatedCount}/{items.length})
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 space-y-1">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {item.validated ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      ) : item.validationFn ? (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.title}</span>
                          {item.required && (
                            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">إلزامي</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        {!item.validated && item.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{item.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RunbooksSection({ runbooks }: { runbooks: Runbook[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          أدلة التشغيل السريع
        </h3>
      </div>
      <div className="divide-y">
        {runbooks.map(rb => (
          <div key={rb.id}>
            <button
              onClick={() => setExpanded(expanded === rb.id ? null : rb.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{rb.id}</span>
                <span className="font-medium text-sm">{rb.title}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border', severityColors[rb.severity])}>
                  {rb.severity === 'critical' ? 'حرج' : rb.severity === 'high' ? 'عالي' : rb.severity === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{rb.estimatedResolution}</span>
                {expanded === rb.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {expanded === rb.id && (
              <div className="px-4 pb-4">
                <p className="text-sm text-muted-foreground mb-3">{rb.description}</p>
                <div className="space-y-2">
                  {rb.steps.map(step => (
                    <div key={step.order} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {step.order}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{step.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                        <p className="text-xs text-green-600 mt-1">
                          <span className="font-medium">النتيجة المتوقعة: </span>
                          {step.expectedOutcome}
                        </p>
                        {step.troubleshooting.length > 0 && (
                          <div className="mt-1.5">
                            <span className="text-xs font-medium text-orange-600">استكشاف الأخطاء:</span>
                            <ul className="list-disc list-inside text-xs text-muted-foreground mt-0.5">
                              {step.troubleshooting.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LaunchReadinessDashboard() {
  const [report, setReport] = useState<ReadinessReport>(() => assessReadiness())
  const [checklist, setChecklist] = useState<DeploymentChecklist>(() => createProductionChecklist())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBlockers, setShowBlockers] = useState(true)

  const runbooks = useMemo(() => getRunbooks(), [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(r => setTimeout(r, 800))
    setReport(assessReadiness())
    setChecklist(createProductionChecklist())
    setIsRefreshing(false)
  }

  const handleExportReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readiness-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintChecklist = () => {
    const printContent = checklist.items.map(item =>
      `${item.validated ? '✓' : '✗'} [${item.required ? 'إلزامي' : 'اختياري'}] ${item.title}\n  ${item.description}\n`
    ).join('\n')
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<pre dir="rtl">${printContent}</pre>`)
      win.document.close()
      win.print()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50" dir="rtl">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'الإدارة' },
            { label: 'جاهزية الإطلاق' },
          ]}
          className="mb-6"
        />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">جاهزية الإطلاق</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                تقييم جاهزية النظام للإنتاج
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleExportReport}
            >
              <Download className="h-4 w-4 ml-1.5" />
              تصدير التقرير
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handlePrintChecklist}
            >
              <Printer className="h-4 w-4 ml-1.5" />
              طباعة القائمة
            </Button>
            <Button
              variant="default"
              size="md"
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              <RefreshCw className="h-4 w-4 ml-1.5" />
              تحديث
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="flex flex-col items-center p-6 rounded-xl border bg-white shadow-sm">
              <CircularGauge value={report.overall} />
            </div>
          </div>

          <div className="lg:col-span-9">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {report.categories.map(cat => (
                <CategoryCard key={cat.category} name={cat.category} score={cat.score} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {report.blockers.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 shadow-sm">
              <button
                onClick={() => setShowBlockers(!showBlockers)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-red-800">العوائق</h3>
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                    {report.blockers.length}
                  </span>
                </div>
                {showBlockers ? <ChevronUp className="h-4 w-4 text-red-400" /> : <ChevronDown className="h-4 w-4 text-red-400" />}
              </button>
              {showBlockers && (
                <div className="px-4 pb-4 space-y-2">
                  {report.blockers.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-semibold text-yellow-800">التحذيرات</h3>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                    {report.warnings.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {report.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-yellow-700">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-blue-800">التوصيات</h3>
                </div>
                <div className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-blue-700">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ChecklistSection checklist={checklist} />
          <RunbooksSection runbooks={runbooks} />
        </div>
      </div>
    </div>
  )
}

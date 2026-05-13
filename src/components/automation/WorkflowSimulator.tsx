'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Play, RotateCcw, CheckCircle2, XCircle,
  ArrowRight, Clock, AlertTriangle, BarChart3,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMockSimulationScenarios } from '@/lib/automation/mock-data'
import type { SimulationScenario, AutomationRule } from '@/lib/automation/types'

interface WorkflowSimulatorProps {
  className?: string
}

interface SimulationResult {
  triggered: boolean
  conditionsMet: boolean
  executionPath: string[]
  duration: number
  actionsExecuted: string[]
}

function evaluateConditions(rule: AutomationRule): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return true
  return rule.conditions.every((group) => {
    if (group.logic === 'and') {
      return group.conditions.every(() => true)
    }
    return group.conditions.some(() => true)
  })
}

function runSimulation(rule: AutomationRule, triggerImmediately: boolean): SimulationResult {
  const startTime = performance.now()

  if (!rule.enabled) {
    return {
      triggered: false,
      conditionsMet: false,
      executionPath: [
        '✗ لم يتم تفعيل القاعدة (معطلة)',
      ],
      duration: 0,
      actionsExecuted: [],
    }
  }

  const path: string[] = []
  const actionsExecuted: string[] = []
  let triggered = false
  let conditionsMet = false

  path.push(`✓ تم اكتشاف الحدث: ${rule.trigger}`)

  if (triggerImmediately) {
    conditionsMet = true
    path.push('✓ تم استيفاء جميع الشروط')
    triggered = true

    const enabledActions = rule.actions.filter((a) => a.enabled)
    for (const action of enabledActions) {
      const actionLabel = action.label || action.type
      path.push(`✓ تم تنفيذ الإجراء: ${actionLabel}`)
      actionsExecuted.push(actionLabel)
    }
  } else {
    const conditionsPassed = evaluateConditions(rule)
    conditionsMet = conditionsPassed

    if (conditionsPassed) {
      path.push('✓ تم استيفاء جميع الشروط')
      triggered = true

      const enabledActions = rule.actions.filter((a) => a.enabled)
      for (const action of enabledActions) {
        const actionLabel = action.label || action.type
        path.push(`✓ تم تنفيذ الإجراء: ${actionLabel}`)
        actionsExecuted.push(actionLabel)
      }
    } else {
      path.push('✗ لم تستوفِ الشروط المطلوبة')
      triggered = false
    }
  }

  const endTime = performance.now()
  const duration = Math.round(endTime - startTime)

  return { triggered, conditionsMet, executionPath: path, duration, actionsExecuted }
}

export function WorkflowSimulator({ className }: WorkflowSimulatorProps) {
  const scenarios = generateMockSimulationScenarios()
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '')
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [quickMode, setQuickMode] = useState(false)

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)

  const handleRun = () => {
    if (!selectedScenario) return
    setLoading(true)
    setHasRun(false)
    setResult(null)

    setTimeout(() => {
      const simResult = runSimulation(
        selectedScenario.rule,
        quickMode
      )
      setResult(simResult)
      setLoading(false)
      setHasRun(true)
    }, 1200)
  }

  const handleReset = () => {
    setResult(null)
    setHasRun(false)
    setLoading(false)
  }

  return (
    <div className={cn('space-y-6', className)} dir="rtl">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">محاكاة قواعد الأتمتة</h1>
      </div>

      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                اختر سيناريو المحاكاة
              </label>
              <select
                value={selectedScenarioId}
                onChange={(e) => {
                  setSelectedScenarioId(e.target.value)
                  handleReset()
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedScenario && (
              <div className="p-3 rounded-lg bg-muted/30 border">
                <h4 className="text-sm font-medium mb-1">وصف السيناريو</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedScenario.description}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">القاعدة:</span>{' '}
                  {selectedScenario.rule.name}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleRun} disabled={loading || !selectedScenario}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    جاري المحاكاة...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 ml-1" />
                    تشغيل المحاكاة
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasRun}
              >
                <RotateCcw className="h-4 w-4 ml-1" />
                إعادة تعيين
              </Button>
              <label className="flex items-center gap-2 mr-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickMode}
                  onChange={(e) => setQuickMode(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground">تنفيذ سريع</span>
              </label>
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedScenario && (
              <div className="space-y-3 p-3 rounded-lg border bg-background">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  تفاصيل القاعدة
                </h4>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المشغل:</span>
                    <span className="font-medium">{selectedScenario.rule.trigger}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مجموعات الشروط:</span>
                    <span className="font-medium">{selectedScenario.rule.conditions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإجراءات:</span>
                    <span className="font-medium">
                      {selectedScenario.rule.actions.filter((a) => a.enabled).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الحالة:</span>
                    <span
                      className={cn(
                        'font-medium',
                        selectedScenario.rule.enabled
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {selectedScenario.rule.enabled ? 'مفعلة' : 'معطلة'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border bg-card shadow-sm p-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري المحاكاة...</p>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">نتيجة المحاكاة</h3>
            {result.triggered ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                تم التفعيل
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                <XCircle className="h-4 w-4" />
                لم يتم التفعيل
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>حالة الشروط</span>
              </div>
              <p
                className={cn(
                  'text-lg font-semibold',
                  result.conditionsMet ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {result.conditionsMet ? 'مستوفاة' : 'غير مستوفاة'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Play className="h-4 w-4" />
                <span>الإجراءات المنفذة</span>
              </div>
              <p className="text-lg font-semibold">{result.actionsExecuted.length}</p>
            </div>

            {result.triggered && (
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span>مدة التنفيذ</span>
                </div>
                <p className="text-lg font-semibold">
                  {result.duration} <span className="text-sm font-normal text-muted-foreground">مللي ثانية</span>
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">مسار التنفيذ</h4>
            <div className="space-y-2">
              {result.executionPath.map((step, idx) => {
                const isSuccess = step.startsWith('✓')
                const isFail = step.startsWith('✗')
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-2 p-2.5 rounded-lg text-sm border',
                      isSuccess && 'bg-emerald-50 border-emerald-200 text-emerald-800',
                      isFail && 'bg-red-50 border-red-200 text-red-800',
                      !isSuccess && !isFail && 'bg-muted/30 border-input text-foreground'
                    )}
                  >
                    <span className="shrink-0 mt-0.5">
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : isFail ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <span>{step.replace(/^[✓✗]\s*/, '')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {result.triggered && result.actionsExecuted.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">الإجراءات المنفذة</h4>
              <div className="flex flex-wrap gap-2">
                {result.actionsExecuted.map((action, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {action}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.triggered && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800">
                  <span className="font-medium">مدة المحاكاة:</span> استغرق التنفيذ {result.duration} مللي ثانية
                  {result.actionsExecuted.length > 0 && (
                    <> · تم تنفيذ {result.actionsExecuted.length} إجراءات</>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasRun && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm max-w-xs">
            اختر سيناريو من القائمة أعلاه ثم اضغط "تشغيل المحاكاة" لاختبار قاعدة الأتمتة
          </p>
        </div>
      )}
    </div>
  )
}

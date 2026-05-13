'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, FileText, Download, Play, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createProductionChecklist, type DeploymentChecklist, type ChecklistItem } from '@/lib/launch/deployment-checklist'

type FilterMode = 'all' | 'passing' | 'failing'
type ItemStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning'

interface ValidatedItem extends ChecklistItem {
  status: ItemStatus
  duration?: number
}

type ValidatedMap = Record<string, ItemStatus>

export function DeploymentValidator() {
  const [checklist, setChecklist] = useState<DeploymentChecklist>(() => createProductionChecklist())
  const [itemStatuses, setItemStatuses] = useState<ValidatedMap>({})
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [progress, setProgress] = useState(0)

  const itemsWithStatus: ValidatedItem[] = checklist.items.map(item => ({
    ...item,
    status: itemStatuses[item.id] || 'pending',
  }))

  const filteredItems = itemsWithStatus.filter(item => {
    if (filter === 'passing') return item.status === 'passed'
    if (filter === 'failing') return item.status === 'failed' || item.status === 'warning'
    return true
  })

  const passedCount = itemsWithStatus.filter(i => i.status === 'passed').length
  const failedCount = itemsWithStatus.filter(i => i.status === 'failed').length
  const warningCount = itemsWithStatus.filter(i => i.status === 'warning').length
  const totalValidated = passedCount + failedCount + warningCount

  const runValidation = useCallback(async () => {
    setIsRunning(true)
    setProgress(0)

    const newStatuses: ValidatedMap = {}
    const items = checklist.items
    const total = items.length

    for (let i = 0; i < total; i++) {
      const item = items[i]

      newStatuses[item.id] = 'running'
      setItemStatuses({ ...newStatuses })
      setProgress(Math.round(((i) / total) * 100))

      const start = Date.now()

      if (item.validationFn) {
        try {
          const result = await item.validationFn()
          const elapsed = Date.now() - start
          if (elapsed < 300) {
            await new Promise(r => setTimeout(r, 300 - elapsed))
          }
          newStatuses[item.id] = result ? 'passed' : 'failed'
        } catch {
          newStatuses[item.id] = 'failed'
        }
      } else {
        const elapsed = Date.now() - start
        if (elapsed < 200) {
          await new Promise(r => setTimeout(r, 200 - elapsed))
        }
        newStatuses[item.id] = 'warning'
      }

      setItemStatuses({ ...newStatuses })
      setProgress(Math.round(((i + 1) / total) * 100))
    }

    const updated = { ...checklist }
    updated.items = updated.items.map(item => ({
      ...item,
      validated: newStatuses[item.id] === 'passed' || newStatuses[item.id] === 'warning',
    }))
    updated.status = failedCount > 0 ? 'failed' : passedCount === total ? 'completed' : 'in_progress'
    setChecklist(updated)

    setIsRunning(false)
  }, [checklist, failedCount, passedCount, totalValidated])

  const resetValidation = useCallback(() => {
    setItemStatuses({})
    setProgress(0)
    setChecklist(createProductionChecklist())
    setFilter('all')
  }, [])

  const runSingleValidation = useCallback(async (itemId: string) => {
    const item = checklist.items.find(i => i.id === itemId)
    if (!item || !item.validationFn) return

    const newStatuses = { ...itemStatuses }
    newStatuses[itemId] = 'running'
    setItemStatuses(newStatuses)

    try {
      const result = await item.validationFn()
      newStatuses[itemId] = result ? 'passed' : 'failed'
    } catch {
      newStatuses[itemId] = 'failed'
    }

    setItemStatuses(newStatuses)

    const updatedItems = checklist.items.map(i => ({
      ...i,
      validated: i.id === itemId ? newStatuses[itemId] === 'passed' : i.validated,
    }))
    setChecklist(prev => ({ ...prev, items: updatedItems }))
  }, [checklist.items, itemStatuses])

  const exportResults = useCallback(() => {
    const results = itemsWithStatus.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      required: item.required,
      errorMessage: item.status === 'failed' ? item.errorMessage : undefined,
    }))

    const exportData = {
      exportedAt: Date.now(),
      summary: {
        total: itemsWithStatus.length,
        passed: passedCount,
        failed: failedCount,
        warning: warningCount,
      },
      results,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deployment-validation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [itemsWithStatus, passedCount, failedCount, warningCount])

  const getStatusIcon = (status: ItemStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case 'passed':
        return 'border-green-200 bg-green-50/50'
      case 'failed':
        return 'border-red-200 bg-red-50/50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50/50'
      case 'running':
        return 'border-blue-200 bg-blue-50/50'
      default:
        return 'border-gray-100 bg-white'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50" dir="rtl">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مدقق النشر</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                التحقق من جميع متطلبات النشر في الإنتاج
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={exportResults}
              disabled={totalValidated === 0}
            >
              <Download className="h-4 w-4 ml-1.5" />
              تصدير النتائج
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={resetValidation}
              disabled={isRunning}
            >
              <RotateCcw className="h-4 w-4 ml-1.5" />
              إعادة تعيين
            </Button>
            <Button
              variant="default"
              size="md"
              onClick={runValidation}
              loading={isRunning}
              disabled={isRunning}
            >
              <Play className="h-4 w-4 ml-1.5" />
              تشغيل التحقق
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm mb-6">
          <div className="p-5 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold">نتائج التحقق</h3>
                <span className="text-sm text-muted-foreground">
                  {passedCount} من {itemsWithStatus.length} اجتازت الفحص
                </span>
              </div>
              <div className="flex gap-1.5">
                {(['all', 'passing', 'failing'] as FilterMode[]).map(f => (
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

            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress === 100 && failedCount > 0 ? 'bg-red-500' :
                  progress === 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${totalValidated > 0 ? (totalValidated / itemsWithStatus.length) * 100 : progress}%` }}
              />
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>ناجح: {passedCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>فاشل: {failedCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>تحذير: {warningCount}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                <span>معلق: {itemsWithStatus.length - totalValidated}</span>
              </span>
            </div>
          </div>

          <div className="divide-y">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-4 p-4 transition-colors',
                  getStatusColor(item.status)
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {getStatusIcon(item.status)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.category}
                    </span>
                    {item.required && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">إلزامي</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  {item.status === 'failed' && item.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{item.errorMessage}</p>
                  )}
                </div>
                {item.validationFn && item.status === 'pending' && !isRunning && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runSingleValidation(item.id)}
                    className="shrink-0"
                  >
                    <Play className="h-3.5 w-3.5 ml-1" />
                    تحقق
                  </Button>
                )}
                {item.status === 'running' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">
                {filter === 'passing' ? 'لا توجد عناصر ناجحة' :
                 filter === 'failing' ? 'لا توجد عناصر فاشلة' :
                 'لا توجد عناصر'}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white shadow-sm p-5">
          <h3 className="font-semibold mb-3">ملخص النشر</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
              <p className="text-2xl font-bold text-green-600">{passedCount}</p>
              <p className="text-xs text-green-700 mt-1">اجتازت الفحص</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-100">
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-red-700 mt-1">لم تجتاز الفحص</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-100">
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-xs text-yellow-700 mt-1">تحذيرات</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-2xl font-bold text-blue-600">{itemsWithStatus.length - totalValidated}</p>
              <p className="text-xs text-blue-700 mt-1">لم يتم التحقق</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

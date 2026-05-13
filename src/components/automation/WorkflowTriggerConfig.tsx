'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Zap, FileText, Clock, AlertCircle, Calendar,
  ArrowRight, CheckCircle2, Settings, Search,
  Plus, AlertTriangle, Edit3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TriggerOption, TriggerEvent } from '@/lib/automation/types'

interface WorkflowTriggerConfigProps {
  options: TriggerOption[]
  selected?: TriggerEvent
  onSelect?: (event: TriggerEvent) => void
  config?: Record<string, string>
  onConfigChange?: (config: Record<string, string>) => void
  className?: string
}

const categoryLabels: Record<string, string> = {
  workflow: 'سير العمل',
  approval: 'الموافقات',
  sla: 'SLA',
  entity: 'الكيانات',
  schedule: 'الجدولة',
}

const categoryColors: Record<string, string> = {
  workflow: 'bg-blue-100 text-blue-700 border-blue-200',
  approval: 'bg-amber-100 text-amber-700 border-amber-200',
  sla: 'bg-red-100 text-red-700 border-red-200',
  entity: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  schedule: 'bg-purple-100 text-purple-700 border-purple-200',
}

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-5 w-5" />,
  ArrowRight: <ArrowRight className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  CheckCircle2: <CheckCircle2 className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  AlertCircle: <AlertCircle className="h-5 w-5" />,
  Plus: <Plus className="h-5 w-5" />,
  Edit3: <Edit3 className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
}

export function WorkflowTriggerConfig({
  options,
  selected,
  onSelect,
  config: externalConfig = {},
  onConfigChange,
  className,
}: WorkflowTriggerConfigProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [internalConfig, setInternalConfig] = useState<Record<string, string>>(externalConfig)

  const config = onConfigChange ? externalConfig : internalConfig

  const updateConfig = (key: string, value: string) => {
    const next = { ...config, [key]: value }
    if (onConfigChange) {
      onConfigChange(next)
    } else {
      setInternalConfig(next)
    }
  }

  const filteredOptions = options.filter((opt) =>
    opt.label.includes(searchQuery) || opt.description.includes(searchQuery)
  )

  const selectedOption = options.find((o) => o.event === selected)

  const categories = ['workflow', 'approval', 'sla', 'entity', 'schedule'] as const

  const renderTriggerConfig = () => {
    if (!selectedOption) return null

    switch (selectedOption.category) {
      case 'workflow':
        return (
          <div className="space-y-3">
            <select
              value={config.workflow || ''}
              onChange={(e) => updateConfig('workflow', e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">اختر نوع سير العمل</option>
              <option value="procure_to_pay">المشتريات حتى الدفع</option>
              <option value="approval_flow">سير الموافقات</option>
              <option value="leave_request">طلبات الإجازات</option>
              <option value="expense_report">تقارير المصروفات</option>
              <option value="purchase_order">أمر شراء</option>
            </select>
          </div>
        )
      case 'approval':
        return (
          <div className="space-y-3">
            <select
              value={config.type || ''}
              onChange={(e) => updateConfig('type', e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">اختر نوع الموافقة</option>
              <option value="purchase_order">موافقة أمر شراء</option>
              <option value="expense">موافقة مصروفات</option>
              <option value="leave">موافقة إجازة</option>
              <option value="contract">موافقة عقد</option>
              <option value="any">أي نوع</option>
            </select>
          </div>
        )
      case 'sla':
        return (
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              نسبة العتبة: {config.threshold || 80}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={config.threshold || 80}
              onChange={(e) => updateConfig('threshold', e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )
      case 'entity':
        return (
          <div className="space-y-3">
            <select
              value={config.entity || ''}
              onChange={(e) => updateConfig('entity', e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">اختر نوع الكيان</option>
              <option value="purchase_order">أمر شراء</option>
              <option value="invoice">فاتورة</option>
              <option value="contract">عقد</option>
              <option value="inventory_item">صنف مخزون</option>
              <option value="employee">موظف</option>
              <option value="expense_report">تقرير مصروفات</option>
            </select>
          </div>
        )
      case 'schedule':
        return (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <label className="text-sm font-medium text-foreground block mb-1">
                تعبير Cron
              </label>
              <code className="text-sm bg-background px-2 py-1 rounded border block mb-2 text-left ltr" dir="ltr">
                {config.cron || '0 0 1 * *'}
              </code>
              <p className="text-xs text-muted-foreground">
                {config.cron === '0 0 1 * *'
                  ? 'اليوم الأول من كل شهر عند منتصف الليل'
                  : config.cron === '0 0 * * *'
                  ? 'كل يوم عند منتصف الليل'
                  : config.cron === '*/5 * * * *'
                  ? 'كل 5 دقائق'
                  : 'تعبير Cron مخصص'}
              </p>
            </div>
            <input
              type="text"
              value={config.cron || '0 0 1 * *'}
              onChange={(e) => updateConfig('cron', e.target.value)}
              placeholder="0 0 1 * *"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left ltr"
              dir="ltr"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { value: '0 0 1 * *', label: 'شهري' },
                { value: '0 0 * * *', label: 'يومي' },
                { value: '0 * * * *', label: 'كل ساعة' },
                { value: '*/5 * * * *', label: 'كل 5 دقائق' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateConfig('cron', preset.value)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer',
                    config.cron === preset.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-input hover:border-primary'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <select
              value={config.timezone || 'Asia/Riyadh'}
              onChange={(e) => updateConfig('timezone', e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="Asia/Riyadh">الرياض (UTC+3)</option>
              <option value="Asia/Dubai">دبي (UTC+4)</option>
              <option value="Asia/Kuwait">الكويت (UTC+3)</option>
              <option value="Asia/Qatar">قطر (UTC+3)</option>
              <option value="Asia/Bahrain">البحرين (UTC+3)</option>
              <option value="Asia/Muscat">مسقط (UTC+4)</option>
            </select>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">إعداد المشغل</h3>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن مشغل..."
          className="h-10 w-full rounded-lg border border-input bg-background pr-9 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filteredOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
          <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm max-w-xs">
            {searchQuery
              ? 'لا توجد نتائج للبحث'
              : 'اختر مشغلاً لبدء تكوين القاعدة'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => {
              const catOptions = filteredOptions.filter((o) => o.category === cat)
              if (catOptions.length === 0) return null
              return (
                <div key={cat} className="col-span-2 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {categoryLabels[cat]}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {catOptions.map((option) => {
                      const isSelected = selected === option.event
                      return (
                        <button
                          key={option.event}
                          type="button"
                          onClick={() => onSelect?.(option.event)}
                          disabled={!onSelect}
                          className={cn(
                            'flex flex-col gap-1.5 p-3 rounded-lg border text-right transition-all cursor-pointer',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-input bg-card hover:border-primary/50 hover:bg-accent/50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                'text-foreground p-1 rounded-md',
                                isSelected ? 'text-primary' : 'text-muted-foreground'
                              )}
                            >
                              {iconMap[option.icon] || <Zap className="h-5 w-5" />}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <span className="text-sm font-medium leading-tight">
                            {option.label}
                          </span>
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {option.description}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full border w-fit',
                              categoryColors[option.category]
                            )}
                          >
                            {categoryLabels[option.category]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="mt-4 p-4 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  إعدادات: {selectedOption?.label}
                </span>
              </div>
              {renderTriggerConfig()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

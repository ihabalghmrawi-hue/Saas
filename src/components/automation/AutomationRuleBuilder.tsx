'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Settings, Plus, Save, Power, PowerOff,
  Play, Copy, Trash2, Clock, AlertTriangle,
  FileText, GitBranch, ArrowUp, Shield,
  CheckCircle2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkflowTriggerConfig } from './WorkflowTriggerConfig'
import { ConditionalRoutingEditor } from './ConditionalRoutingEditor'
import { EscalationRuleConfig } from './EscalationRuleConfig'
import { getTriggerOptions, generateMockRules, getDefaultEscalationLevels } from '@/lib/automation/mock-data'
import type { AutomationRule, ConditionGroup, RuleAction, TriggerEvent } from '@/lib/automation/types'

const actionTypeLabels: Record<string, string> = {
  send_notification: 'إرسال إشعار',
  escalate: 'تصعيد',
  assign: 'تعيين',
  transition: 'تنشيط مرحلة',
  approve_auto: 'اعتماد تلقائي',
  reject_auto: 'رفض تلقائي',
  update_entity: 'تحديث كيان',
  call_webhook: 'استدعاء Webhook',
  pause_workflow: 'إيقاف سير العمل',
  cancel_workflow: 'إلغاء سير العمل',
}

const categories = [
  { value: 'المشتريات', label: 'المشتريات' },
  { value: 'المالية', label: 'المالية' },
  { value: 'الموارد البشرية', label: 'الموارد البشرية' },
  { value: 'المخزون', label: 'المخزون' },
  { value: 'الموافقات', label: 'الموافقات' },
  { value: 'نظام', label: 'نظام' },
]

const actionTypes = [
  'send_notification', 'escalate', 'assign', 'transition',
  'approve_auto', 'reject_auto', 'update_entity', 'call_webhook',
  'pause_workflow', 'cancel_workflow',
]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

let actionCounter = 0

function generateActionId() {
  actionCounter += 1
  return `act-${Date.now()}-${actionCounter}`
}

function createEmptyAction(): RuleAction {
  return {
    id: generateActionId(),
    type: 'send_notification',
    config: {},
    label: '',
    enabled: true,
  }
}

export function AutomationRuleBuilder() {
  const [rules] = useState(generateMockRules())
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0].id)
  const selectedRule = rules.find((r) => r.id === selectedRuleId)

  const [name, setName] = useState(selectedRule?.name || '')
  const [description, setDescription] = useState(selectedRule?.description || '')
  const [category, setCategory] = useState(selectedRule?.category || '')
  const [trigger, setTrigger] = useState<TriggerEvent | undefined>(selectedRule?.trigger)
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(
    selectedRule?.triggerConfig || {}
  )
  const [conditions, setConditions] = useState<ConditionGroup[]>(selectedRule?.conditions || [])
  const [actions, setActions] = useState<RuleAction[]>(selectedRule?.actions || [])
  const [escalationLevels, setEscalationLevels] = useState(getDefaultEscalationLevels())
  const [enabled, setEnabled] = useState(selectedRule?.enabled ?? true)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const loadRule = useCallback(
    (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId)
      if (!rule) return
      setSelectedRuleId(rule.id)
      setName(rule.name)
      setDescription(rule.description)
      setCategory(rule.category)
      setTrigger(rule.trigger)
      setTriggerConfig(rule.triggerConfig)
      setConditions(rule.conditions)
      setActions(rule.actions)
      setEnabled(rule.enabled)
      setSaved(false)
      setShowDeleteConfirm(false)
    },
    [rules]
  )

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const addAction = () => {
    setActions([...actions, createEmptyAction()])
  }

  const removeAction = (actionId: string) => {
    setActions(actions.filter((a) => a.id !== actionId))
  }

  const updateAction = (actionId: string, updates: Partial<RuleAction>) => {
    setActions(
      actions.map((a) => (a.id === actionId ? { ...a, ...updates } : a))
    )
  }

  const triggerOptions = getTriggerOptions()

  return (
    <div className="space-y-6" dir="rtl">
      <EnterpriseBreadcrumbs
        items={[
          { label: 'الأتمتة' },
          { label: 'قواعد الأتمتة' },
          { label: 'بناء القاعدة' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">بناء قاعدة أتمتة</h1>
        </div>
        <div className="flex items-center gap-2">
          {selectedRule && (
            <>
              {enabled ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                  <Power className="h-3 w-3" />
                  مفعل
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full border">
                  <PowerOff className="h-3 w-3" />
                  معطل
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">تحميل قاعدة:</label>
        <select
          value={selectedRuleId}
          onChange={(e) => loadRule(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1 max-w-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">المعلومات الأساسية</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  اسم القاعدة
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسم القاعدة"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  الوصف
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="أدخل وصف القاعدة"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  التصنيف
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">اختر التصنيف</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-6">
            <WorkflowTriggerConfig
              options={triggerOptions}
              selected={trigger}
              onSelect={(e) => setTrigger(e)}
              config={triggerConfig}
              onConfigChange={setTriggerConfig}
            />
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-6">
            <ConditionalRoutingEditor
              groups={conditions}
              onChange={setConditions}
            />
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Play className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">الإجراءات</h2>
            </div>

            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
                <Play className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-muted-foreground text-sm">
                  لم يتم إضافة إجراءات بعد
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={addAction}>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة إجراء
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map((action, idx) => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                  >
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-1">
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={action.type}
                          onChange={(e) =>
                            updateAction(action.id, {
                              type: e.target.value as RuleAction['type'],
                            })
                          }
                          className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {actionTypes.map((at) => (
                            <option key={at} value={at}>
                              {actionTypeLabels[at] || at}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            updateAction(action.id, { enabled: !action.enabled })
                          }
                          className={cn(
                            'h-9 px-3 rounded-lg border text-xs transition-colors cursor-pointer',
                            action.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-muted text-muted-foreground border-input'
                          )}
                        >
                          {action.enabled ? 'مفعل' : 'معطل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-lg border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={action.label}
                        onChange={(e) =>
                          updateAction(action.id, { label: e.target.value })
                        }
                        placeholder="وصف الإجراء"
                        className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة إجراء
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-6">
            <EscalationRuleConfig
              levels={escalationLevels}
              onChange={setEscalationLevels}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm p-6">
            <h3 className="text-sm font-semibold mb-4">حالة القاعدة</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {enabled ? (
                  <Power className="h-5 w-5 text-emerald-600" />
                ) : (
                  <PowerOff className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm">{enabled ? 'مفعلة' : 'معطلة'}</span>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                  enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  )}
                />
              </button>
            </div>
          </div>

          {selectedRule && (
            <div className="rounded-xl border bg-card shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-semibold">إحصائيات التنفيذ</h3>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">آخر تفعيل:</span>
                <span className="font-medium">
                  {selectedRule.lastTriggered
                    ? formatDate(selectedRule.lastTriggered)
                    : 'لم يتم التفعيل بعد'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Play className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">عدد مرات التنفيذ:</span>
                <span className="font-medium">{selectedRule.executionCount}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-semibold">الإجراءات</h3>
            <Button className="w-full gap-2" onClick={handleSave}>
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  تم الحفظ
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  حفظ القاعدة
                </>
              )}
            </Button>
            <Button variant="outline" className="w-full gap-2">
              <Copy className="h-4 w-4" />
              نسخ القاعدة
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            >
              <Trash2 className="h-4 w-4" />
              حذف القاعدة
            </Button>
            {showDeleteConfirm && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive mb-2">
                  هل أنت متأكد من حذف هذه القاعدة؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="flex-1">
                    تأكيد الحذف
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Plus, X, GitBranch, Settings, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ConditionGroup, Condition, ConditionOperator } from '@/lib/automation/types'

interface ConditionalRoutingEditorProps {
  groups: ConditionGroup[]
  onChange?: (groups: ConditionGroup[]) => void
  readOnly?: boolean
  className?: string
}

const operatorLabels: Record<ConditionOperator, string> = {
  equals: 'يساوي',
  not_equals: 'لا يساوي',
  greater_than: 'أكبر من',
  less_than: 'أقل من',
  contains: 'يحتوي',
  not_contains: 'لا يحتوي',
  is_empty: 'فارغ',
  is_not_empty: 'غير فارغ',
  in: 'ضمن',
  not_in: 'ليس ضمن',
}

const operators: ConditionOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'contains', 'not_contains', 'is_empty', 'is_not_empty', 'in', 'not_in',
]

let groupCounter = 0
let conditionCounter = 0

function generateGroupId() {
  groupCounter += 1
  return `cg-${Date.now()}-${groupCounter}`
}

function generateConditionId() {
  conditionCounter += 1
  return `cond-${Date.now()}-${conditionCounter}`
}

function createEmptyGroup(): ConditionGroup {
  const cId = generateConditionId()
  return {
    id: generateGroupId(),
    logic: 'and',
    label: 'مجموعة شروط جديدة',
    conditions: [
      { id: cId, field: '', operator: 'equals', value: '', label: '' },
    ],
  }
}

function createEmptyCondition(): Condition {
  return { id: generateConditionId(), field: '', operator: 'equals', value: '', label: '' }
}

export function ConditionalRoutingEditor({
  groups: externalGroups,
  onChange,
  readOnly = false,
  className,
}: ConditionalRoutingEditorProps) {
  const [internalGroups, setInternalGroups] = useState<ConditionGroup[]>(externalGroups)

  const groups = onChange ? externalGroups : internalGroups

  const updateGroups = (next: ConditionGroup[]) => {
    if (onChange) {
      onChange(next)
    } else {
      setInternalGroups(next)
    }
  }

  const addGroup = () => {
    updateGroups([...groups, createEmptyGroup()])
  }

  const removeGroup = (groupId: string) => {
    updateGroups(groups.filter((g) => g.id !== groupId))
  }

  const toggleGroupLogic = (groupId: string) => {
    updateGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, logic: g.logic === 'and' ? 'or' : 'and' as 'and' | 'or' } : g
      )
    )
  }

  const addCondition = (groupId: string) => {
    updateGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, createEmptyCondition()] }
          : g
      )
    )
  }

  const removeCondition = (groupId: string, conditionId: string) => {
    updateGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
          : g
      )
    )
  }

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<Condition>
  ) => {
    updateGroups(
      groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : g
      )
    )
  }

  if (groups.length === 0) {
    return (
      <div className={cn('space-y-4', className)} dir="rtl">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">محرر التوجيه الشرطي</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
          <GitBranch className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm max-w-xs">
            لم يتم إضافة شروط بعد. أضف مجموعة شروط للبدء.
          </p>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-4" onClick={addGroup}>
              <Plus className="h-4 w-4 ml-1" />
              إضافة مجموعة شروط
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">محرر التوجيه الشرطي</h3>
      </div>

      <div className="space-y-3">
        {groups.map((group, groupIdx) => (
          <div key={group.id} className="relative">
            {groupIdx > 0 && (
              <div className="flex justify-center py-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                  <span>وإلا إذا</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            )}

            <div className="border rounded-xl p-4 bg-card shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.logic === 'and' ? 'جميع الشروط التالية:' : 'أي من الشروط التالية:'}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggleGroupLogic(group.id)}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
                        group.logic === 'and'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      )}
                    >
                      {group.logic === 'and' ? (
                        <ToggleLeft className="h-3 w-3" />
                      ) : (
                        <ToggleRight className="h-3 w-3" />
                      )}
                      {group.logic === 'and' ? 'و' : 'أو'}
                    </button>
                  )}
                  {readOnly && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border',
                        group.logic === 'and'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      )}
                    >
                      {group.logic === 'and' ? 'و' : 'أو'}
                    </span>
                  )}
                </div>
                {!readOnly && groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {group.conditions.map((condition, condIdx) => (
                  <div key={condition.id} className="relative">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                        <select
                          value={condition.field}
                          onChange={(e) =>
                            updateCondition(group.id, condition.id, { field: e.target.value })
                          }
                          disabled={readOnly}
                          className="h-9 min-w-[120px] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">اختر الحقل</option>
                          <option value="amount">المبلغ</option>
                          <option value="category">التصنيف</option>
                          <option value="priority">الأولوية</option>
                          <option value="status">الحالة</option>
                          <option value="assignee">المسؤول</option>
                          <option value="department">القسم</option>
                          <option value="created_at">تاريخ الإنشاء</option>
                          <option value="has_quotation">لديه عرض سعر</option>
                          <option value="has_budget_approval">موافقة ميزانية</option>
                          <option value="sla_elapsed">SLA المستهلك</option>
                          <option value="current_stock">المخزون الحالي</option>
                          <option value="assignee_status">حالة المسؤول</option>
                          <option value="month_end">نهاية الشهر</option>
                        </select>

                        <select
                          value={condition.operator}
                          onChange={(e) =>
                            updateCondition(group.id, condition.id, {
                              operator: e.target.value as ConditionOperator,
                            })
                          }
                          disabled={readOnly}
                          className="h-9 min-w-[100px] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {operators.map((op) => (
                            <option key={op} value={op}>
                              {operatorLabels[op]}
                            </option>
                          ))}
                        </select>

                        {condition.operator !== 'is_empty' &&
                          condition.operator !== 'is_not_empty' && (
                            <input
                              type="text"
                              value={condition.value}
                              onChange={(e) =>
                                updateCondition(group.id, condition.id, { value: e.target.value })
                              }
                              disabled={readOnly}
                              placeholder="القيمة"
                              className="h-9 min-w-[100px] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          )}
                      </div>

                      {!readOnly && group.conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(group.id, condition.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {condIdx < group.conditions.length - 1 && (
                      <div className="flex items-center gap-1.5 mr-8 mt-1 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {group.logic === 'and' ? 'و' : 'أو'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-primary"
                  onClick={() => addCondition(group.id)}
                >
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  + شرط
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addGroup}>
          <Plus className="h-4 w-4 ml-1" />
          + مجموعة شروط
        </Button>
      )}

      {groups.length > 0 && (
        <div className="flex justify-center py-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
            <span>إذا تحققت الشروط → تنفيذ الإجراءات</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  )
}

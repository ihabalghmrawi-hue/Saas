'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Users, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Calendar, Banknote, Briefcase, Percent, Calculator, CreditCard, Fingerprint, Coffee, Home, Heart, Stethoscope, GraduationCap, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell'
import { InspectorPanel } from '@/components/workbench/InspectorPanel'
import { RealtimeValidationBar } from '@/components/workbench/RealtimeValidationBar'
import { AIAssistancePanel } from '@/components/workbench/AIAssistancePanel'
import { CrossEntityInspector } from '@/components/workbench/CrossEntityInspector'
import { AuditOverlay } from '@/components/workbench/AuditOverlay'
import { OperationalCommenting } from '@/components/workbench/OperationalCommenting'
import { WorkbenchMetricCard } from '@/components/workbench/WorkbenchMetricCard'
import { generateMockPayrollRuns, generateMockPayrollEmployees, generateMockValidationMessages, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { PayrollRun, PayrollEmployee, ValidationMessage, AIInsight, AuditTrailEntry, OperationalComment, WorkbenchMetric, WorkbenchAction, InspectorTab } from '@/lib/workbench/types'

interface AnomalyRecord {
  id: string
  type: 'amount' | 'change' | 'duplicate' | 'incorrect' | 'absence'
  typeLabel: string
  employeeId: string
  employeeName: string
  department: string
  period: string
  amount: number
  normalRange: { min: number; max: number }
  variancePercent: number
  status: 'open' | 'investigating' | 'resolved'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  possibleCause: string
  detectedAt: number
  assignee: string
}

const anomalyTypes = [
  { id: 'amount', label: 'مبلغ غير معتاد', icon: DollarSign },
  { id: 'change', label: 'تغيير كبير', icon: TrendingUp },
  { id: 'duplicate', label: 'صرف مكرر', icon: Copy },
  { id: 'incorrect', label: 'مستحقات غير صحيحة', icon: X },
  { id: 'absence', label: 'غياب غير مبرر', icon: User },
]

const anomalyStatusLabels: Record<string, string> = {
  open: 'مفتوح',
  investigating: 'قيد التحقيق',
  resolved: 'تم الحل',
}

const anomalyStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
}

const anomalySeverityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const anomalySeverityLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  critical: 'حرج',
}

const employeeNamesAnomaly = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني', 'هند السلمي',
  'سعود المطيري', 'منال الغامدي', 'عبدالله الزهراني', 'أمل الشمري',
  'نايف الدوسري', 'مريم البقمي', 'تركي العنزي', 'لينا الحارثي',
]

const departmentList = [
  'المالية', 'المشتريات', 'المبيعات', 'الموارد البشرية',
  'تكنولوجيا المعلومات', 'المستودعات', 'الصيانة', 'التسويق',
]

function generateMockAnomalies(): AnomalyRecord[] {
  const anomalyTypeKeys = ['amount', 'change', 'duplicate', 'incorrect', 'absence'] as const
  const statusOptions = ['open', 'open', 'open', 'investigating', 'resolved'] as const
  return Array.from({ length: 12 }, (_, idx) => {
    const typeIdx = Math.floor(Math.random() * anomalyTypeKeys.length)
    const typeKey = anomalyTypeKeys[typeIdx]
    const baseAmount = 5000 + Math.floor(Math.random() * 20000)
    const variance = 0.2 + Math.random() * 0.8
    const amount = typeKey === 'duplicate' ? baseAmount : Math.floor(baseAmount * (1 + variance))
    const normalMin = Math.floor(baseAmount * 0.85)
    const normalMax = Math.floor(baseAmount * 1.15)
    const variancePercent = Math.round(((amount - baseAmount) / baseAmount) * 100)
    return {
      id: 'anomaly-' + idx,
      type: typeKey,
      typeLabel: anomalyTypes[typeIdx].label,
      employeeId: 'EMP-' + String(200 + idx).padStart(3, '0'),
      employeeName: employeeNamesAnomaly[idx % employeeNamesAnomaly.length],
      department: departmentList[idx % departmentList.length],
      period: 'مايو 2025',
      amount,
      normalRange: { min: normalMin, max: normalMax },
      variancePercent,
      status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
      severity: variancePercent > 50 ? 'critical' : variancePercent > 30 ? 'high' : variancePercent > 15 ? 'medium' : 'low',
      description: 'تم اكتشاف حالة شاذة في راتب ' + employeeNamesAnomaly[idx % employeeNamesAnomaly.length] + ' عن مايو 2025 بقيمة ' + amount.toLocaleString('ar-SA') + ' ريال',
      possibleCause: typeKey === 'duplicate' ? 'احتمال إدخال مكرر لبدل السكن' : typeKey === 'absence' ? 'غياب الموظف بدون إذن لمدة 3 أيام' : 'تغيير في هيكل الراتب أو إضافة بدل جديد',
      detectedAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
      assignee: ['أحمد محمد', 'سارة خالد', 'فهد العتيبي', ''][Math.floor(Math.random() * 4)],
    }
  })
}

function generateMockTimelineEvents(anomalyId: string): { id: string; date: number; action: string; details: string }[] {
  return Array.from({ length: 5 + Math.floor(Math.random() * 4) }, (_, idx) => ({
    id: 'tl-' + anomalyId + '-' + idx,
    date: Date.now() - idx * 3 * 24 * 60 * 60 * 1000,
    action: ['تم تسجيل الراتب', 'تم تحديث البدلات', 'تم اكتشاف الحالة الشاذة', 'تم إحالة للتحقيق', 'تم إضافة تعليق', 'تم تغيير الحالة'][idx % 6],
    details: ['تحديث تلقائي للنظام', 'مراجعة من قبل مدير الموارد البشرية', 'اكتشاف تلقائي بواسطة نظام كشف الشذوذ', 'إحالة إلى المحقق المختص', 'إضافة ملاحظات من قبل المحقق', 'تحديث حالة الشذوذ'][idx % 6],
  }))
}

export function PayrollAnomalyCenter() {
  const [anomalies] = useState<AnomalyRecord[]>(() => generateMockAnomalies())
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentingOpen, setCommentingOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [validationMessages] = useState<ValidationMessage[]>(() => generateMockValidationMessages('payroll'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('payroll'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())
  const [timelineEvents] = useState(() => generateMockTimelineEvents('sample'))
  const [investigatorNote, setInvestigatorNote] = useState('')

  const totalAnomalies = anomalies.length
  const openCount = anomalies.filter((a) => a.status === 'open').length
  const investigatingCount = anomalies.filter((a) => a.status === 'investigating').length
  const resolvedCount = anomalies.filter((a) => a.status === 'resolved').length
  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length

  const selectedAnomaly = useMemo(() => {
    if (!selectedAnomalyId) return null
    return anomalies.find((a) => a.id === selectedAnomalyId) ?? null
  }, [selectedAnomalyId, anomalies])

  const filteredAnomalies = useMemo(() => {
    let result = [...anomalies]
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }
    if (typeFilter !== 'all') {
      result = result.filter((a) => a.type === typeFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((a) => a.employeeName.toLowerCase().includes(q) || a.employeeId.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    }
    return result
  }, [anomalies, statusFilter, typeFilter, searchQuery])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total', label: 'إجمالي الحالات الشاذة', value: totalAnomalies, icon: 'AlertTriangle', severity: 'info' },
    { id: 'open', label: 'مفتوح', value: openCount, icon: 'AlertTriangle', severity: 'critical' },
    { id: 'investigating', label: 'قيد التحقيق', value: investigatingCount, icon: 'Search', severity: 'warning' },
    { id: 'resolved', label: 'تم الحل', value: resolvedCount, icon: 'CheckCircle2', severity: 'success', change: 15, trend: 'up' },
    { id: 'critical', label: 'حرجة', value: criticalCount, icon: 'AlertTriangle', severity: criticalCount > 0 ? 'critical' : 'success' },
  ], [totalAnomalies, openCount, investigatingCount, resolvedCount, criticalCount])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'review', label: 'تعليم كمُراجع', type: 'primary', icon: 'CheckSquare', handler: () => {} },
    { id: 'escalate', label: 'تصعيد', type: 'secondary', icon: 'ArrowRight', handler: () => {} },
    { id: 'auto-fix', label: 'إصلاح تلقائي', type: 'secondary', icon: 'Send', handler: () => {} },
    { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
  ], [])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'تفاصيل الحالة', icon: 'info' },
    { id: 'timeline', label: 'الجدول الزمني', icon: 'activity' },
    { id: 'evidence', label: 'الأدلة', icon: 'paperclip' },
    { id: 'comments', label: 'تعليقات', icon: 'message', badge: comments.filter((c) => !c.resolved).length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
  ], [comments])

  const formatCurrency = (value: number) => value.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <WorkbenchShell
      title="مركز كشف الشذوذ في الرواتب"
      description="كشف وتحليل ومعالجة الحالات الشاذة في صرف الرواتب"
      breadcrumbs={[
        { label: 'الرئيسية', icon: Home },
        { label: 'الرواتب', icon: Banknote },
        { label: 'كشف الشذوذ', icon: AlertTriangle },
      ]}
      metrics={metrics}
      actions={actions}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTabs={inspectorTabs}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      inspectorContent={
        <InspectorPanel
          open={inspectorOpen}
          pinned={inspectorPinned}
          onClose={() => setInspectorOpen(false)}
          onPin={() => setInspectorPinned(!inspectorPinned)}
          tabs={inspectorTabs}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          title="تفاصيل الحالة الشاذة"
        >
          {!selectedAnomaly ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">اختر حالة شاذة لعرض التفاصيل</p>
            </div>
          ) : inspectorTab === 'info' ? (
            <div className="space-y-6" dir="rtl">
              <div className={cn('rounded-xl border p-4 space-y-3', selectedAnomaly.severity === 'critical' ? 'bg-red-50 border-red-200' : selectedAnomaly.severity === 'high' ? 'bg-orange-50 border-orange-200' : '')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg', selectedAnomaly.severity === 'critical' ? 'bg-red-100' : selectedAnomaly.severity === 'high' ? 'bg-orange-100' : 'bg-amber-100')}>
                      <AlertTriangle className={cn('h-4 w-4', selectedAnomaly.severity === 'critical' ? 'text-red-600' : selectedAnomaly.severity === 'high' ? 'text-orange-600' : 'text-amber-600')} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{selectedAnomaly.typeLabel}</h4>
                      <p className="text-xs text-muted-foreground">{selectedAnomaly.employeeName} - {selectedAnomaly.employeeId}</p>
                    </div>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', anomalySeverityColors[selectedAnomaly.severity])}>{anomalySeverityLabels[selectedAnomaly.severity]}</span>
                </div>
              </div>
              <div className="rounded-xl border p-4 space-y-4">
                <h4 className="text-sm font-semibold">تفاصيل المبلغ</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المبلغ الفعلي</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedAnomaly.amount)} ريال</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">النطاق الطبيعي</span>
                    <span className="font-medium">{formatCurrency(selectedAnomaly.normalRange.min)} - {formatCurrency(selectedAnomaly.normalRange.max)} ريال</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">نسبة التباين</span>
                    <span className={cn('font-bold', selectedAnomaly.variancePercent > 30 ? 'text-red-600' : 'text-amber-600')}>
                      {selectedAnomaly.variancePercent > 0 ? '+' : ''}{selectedAnomaly.variancePercent}%
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الانحراف المعياري</span>
                    <span className="font-medium">{Math.round(selectedAnomaly.variancePercent / 10)}.2σ</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">الوصف</h4>
                <p className="text-sm text-muted-foreground">{selectedAnomaly.description}</p>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">السبب المحتمل</h4>
                <p className="text-sm text-muted-foreground">{selectedAnomaly.possibleCause}</p>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">التحقيق</h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المحقق</span>
                  <span className="font-medium">{selectedAnomaly.assignee || 'غير معيّن'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ الاكتشاف</span>
                  <span className="font-medium">{new Date(selectedAnomaly.detectedAt).toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الحالة</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', anomalyStatusColors[selectedAnomaly.status])}>{anomalyStatusLabels[selectedAnomaly.status]}</span>
                </div>
              </div>
              {selectedAnomaly.status !== 'resolved' && (
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="text-sm font-semibold">إضافة ملاحظة</h4>
                  <textarea
                    value={investigatorNote}
                    onChange={(e) => setInvestigatorNote(e.target.value)}
                    placeholder="أكتب ملاحظة التحقيق..."
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="default" size="sm" className="h-8 text-xs gap-1" disabled={!investigatorNote.trim()}>
                      <Send className="h-3.5 w-3.5" /> إضافة ملاحظة
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> حل الحالة
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : inspectorTab === 'timeline' ? (
            <div className="space-y-4" dir="rtl">
              <h4 className="text-sm font-semibold">الجدول الزمني للأحداث</h4>
              <div className="relative pr-4 before:absolute before:right-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-border">
                {timelineEvents.map((event, idx) => (
                  <div key={event.id} className="relative pb-4 last:pb-0">
                    <div className="absolute -right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                    <div className="pr-5">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.details}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(event.date).toLocaleDateString('ar-SA')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : inspectorTab === 'evidence' ? (
            <div className="space-y-4" dir="rtl">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">المستندات المرفقة</h4>
                <p className="text-xs text-muted-foreground">لا توجد مستندات مرفقة بعد</p>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">إرفاق دليل</h4>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1"><Paperclip className="h-3.5 w-3.5" /> إرفاق ملف</Button>
              </div>
            </div>
          ) : inspectorTab === 'comments' ? (
            <OperationalCommenting comments={comments} />
          ) : (
            <div className="space-y-3" dir="rtl">
              <h4 className="text-sm font-semibold">سجل النشاط</h4>
              {auditEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="p-1.5 rounded-lg bg-primary/5">
                    <History className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.actor} - {new Date(entry.timestamp).toLocaleDateString('ar-SA')}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{entry.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InspectorPanel>
      }
      validationBar={
        <RealtimeValidationBar messages={validationMessages} onDismiss={(id) => {}} />
      }
      aiPanel={
        <AIAssistancePanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} domain="payroll" insights={aiInsights} />
      }
      sidebar={
        <div className="flex flex-col h-full" dir="rtl">
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث..." className="flex h-10 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {['all', 'open', 'investigating', 'resolved'].map((status) => (
                <button key={status} type="button" onClick={() => setStatusFilter(status)} className={cn('px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors', statusFilter === status ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  {status === 'all' ? 'الكل' : anomalyStatusLabels[status]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {anomalyTypes.map((type) => (
                <button key={type.id} type="button" onClick={() => setTypeFilter(typeFilter === type.id ? 'all' : type.id)} className={cn('px-2 py-1 text-[10px] font-medium rounded-full transition-colors', typeFilter === type.id ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredAnomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد حالات شاذة</p>
              </div>
            ) : (
              filteredAnomalies.map((anomaly) => (
                <button key={anomaly.id} type="button" onClick={() => { setSelectedAnomalyId(anomaly.id); setInspectorOpen(true) }} className={cn('w-full text-right p-3 hover:bg-muted/30 transition-colors', selectedAnomalyId === anomaly.id && 'bg-primary/5 border-r-2 border-primary')}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('p-1 rounded-lg', anomaly.severity === 'critical' ? 'bg-red-50' : anomaly.severity === 'high' ? 'bg-orange-50' : 'bg-amber-50')}>
                      <AlertTriangle className={cn('h-3.5 w-3.5', anomaly.severity === 'critical' ? 'text-red-500' : anomaly.severity === 'high' ? 'text-orange-500' : 'text-amber-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{anomaly.employeeName}</p>
                      <p className="text-[10px] text-muted-foreground">{anomaly.typeLabel} - {anomaly.period}</p>
                    </div>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', anomalySeverityColors[anomaly.severity])}>{anomalySeverityLabels[anomaly.severity]}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pr-9">
                    <span>تباين {anomaly.variancePercent > 0 ? '+' : ''}{anomaly.variancePercent}%</span>
                    <span className={cn('px-1.5 py-0.5 rounded font-medium', anomalyStatusColors[anomaly.status])}>{anomalyStatusLabels[anomaly.status]}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      }
    >
      <div className="p-6 h-full flex flex-col" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">الحالات الشاذة في الرواتب</h2>
            <p className="text-sm text-muted-foreground mt-1">كشف وتحليل الحالات غير الطبيعية في صرف مستحقات الموظفين</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1"><Download className="h-3.5 w-3.5" /> تصدير</Button>
            <Button variant="default" size="sm" className="h-9 text-xs gap-1" onClick={() => setAiPanelOpen(!aiPanelOpen)}><Sparkles className="h-3.5 w-3.5" /> تحليل ذكي</Button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {anomalyTypes.map((type) => {
            const count = anomalies.filter((a) => a.type === type.id).length
            const criticalInType = anomalies.filter((a) => a.type === type.id && a.severity === 'critical').length
            return (
              <button key={type.id} type="button" onClick={() => setTypeFilter(typeFilter === type.id ? 'all' : type.id)} className={cn('rounded-xl border bg-card p-3 text-right hover:shadow-md transition-all', typeFilter === type.id && 'ring-2 ring-primary')}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('p-1.5 rounded-lg', criticalInType > 0 ? 'bg-red-50' : 'bg-muted')}>
                    <type.icon className={cn('h-4 w-4', criticalInType > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                  </div>
                </div>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{type.label}</p>
                {criticalInType > 0 && <p className="text-[10px] text-red-500 mt-1">{criticalInType} حرجة</p>}
              </button>
            )
          })}
        </div>
        <div className="flex-1 rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">قائمة الحالات الشاذة</h3>
              <span className="text-xs text-muted-foreground">({filteredAnomalies.length} حالة)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"><Filter className="h-3.5 w-3.5" /> تصفية</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"><ArrowUpDown className="h-3.5 w-3.5" /> ترتيب</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">النوع</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الموظف</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">القسم</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الفترة</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">المبلغ</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">نسبة التباين</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">شدة</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الحالة</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filteredAnomalies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">لا توجد حالات شاذة</td>
                  </tr>
                ) : (
                  filteredAnomalies.map((anomaly, idx) => (
                    <tr key={anomaly.id} className={cn('border-b last:border-b-0 hover:bg-muted/20 transition-colors', idx % 2 === 0 && 'bg-muted/5')}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1 rounded-lg', anomaly.severity === 'critical' ? 'bg-red-50' : 'bg-muted')}>
                            <AlertTriangle className={cn('h-3.5 w-3.5', anomaly.severity === 'critical' ? 'text-red-500' : 'text-amber-500')} />
                          </div>
                          <span className="text-xs">{anomaly.typeLabel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{anomaly.employeeName[0]}</div>
                          <div>
                            <p className="text-sm font-medium">{anomaly.employeeName}</p>
                            <p className="text-[10px] text-muted-foreground">{anomaly.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{anomaly.department}</td>
                      <td className="py-3 px-4 text-xs">{anomaly.period}</td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(anomaly.amount)}</td>
                      <td className="py-3 px-4">
                        <span className={cn('text-xs font-bold', anomaly.variancePercent > 30 ? 'text-red-600' : 'text-amber-600')}>
                          {anomaly.variancePercent > 0 ? '+' : ''}{anomaly.variancePercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', anomalySeverityColors[anomaly.severity])}>{anomalySeverityLabels[anomaly.severity]}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', anomalyStatusColors[anomaly.status])}>{anomalyStatusLabels[anomaly.status]}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-xs text-muted-foreground">عرض 1-{filteredAnomalies.length} من {anomalies.length} حالة</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled>السابق</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">التالي</Button>
            </div>
          </div>
        </div>
      </div>

      <AuditOverlay entries={auditEntries} open={auditOpen} onClose={() => setAuditOpen(false)} entityId={selectedAnomalyId ?? undefined} entityType="PayrollAnomaly" />
    </WorkbenchShell>
  )
}

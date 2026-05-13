'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Users, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Calendar, Banknote, Briefcase, Percent, Calculator, CreditCard, Fingerprint, Coffee, Home, Heart, Stethoscope, GraduationCap, Wrench } from 'lucide-react'
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

interface ValidationCheck {
  id: string
  category: string
  categoryLabel: string
  name: string
  description: string
  status: 'pass' | 'warning' | 'fail'
  impact: string
  suggestedFix: string
  affectedCount: number
  ruleId: string
}

const validationCategories = [
  { id: 'employees', label: 'بيانات الموظفين', icon: Users },
  { id: 'attendance', label: 'الحضور', icon: Clock },
  { id: 'calculation', label: 'الاحتساب', icon: Calculator },
  { id: 'tax', label: 'الضرائب', icon: Percent },
  { id: 'insurance', label: 'التأمينات', icon: Shield },
  { id: 'end-of-service', label: 'نهاية الخدمة', icon: Briefcase },
]

const categoryChecks: Record<string, Omit<ValidationCheck, 'id'>[]> = {
  employees: [
    { category: 'employees', categoryLabel: 'بيانات الموظفين', name: 'تطابق رقم الهوية', description: 'التحقق من صحة رقم الهوية الوطنية لجميع الموظفين', status: 'pass', impact: 'متوسط', suggestedFix: 'تحديث رقم الهوية في ملف الموظف', affectedCount: 0, ruleId: 'EMP-001' },
    { category: 'employees', categoryLabel: 'بيانات الموظفين', name: 'اكتمال ملف الموظف', description: 'التحقق من اكتمال جميع المستندات المطلوبة في ملف الموظف', status: 'warning', impact: 'منخفض', suggestedFix: 'إرفاق المستندات الناقصة', affectedCount: 3, ruleId: 'EMP-002' },
    { category: 'employees', categoryLabel: 'بيانات الموظفين', name: 'صلاحية العقود', description: 'التحقق من صلاحية عقود العمل وعدم انتهائها', status: 'fail', impact: 'عالي', suggestedFix: 'تجديد العقود المنتهية', affectedCount: 2, ruleId: 'EMP-003' },
    { category: 'employees', categoryLabel: 'بيانات الموظفين', name: 'مطابقة المؤهلات', description: 'التحقق من مطابقة المؤهلات المسجلة مع الشهادات', status: 'pass', impact: 'منخفض', suggestedFix: '', affectedCount: 0, ruleId: 'EMP-004' },
  ],
  attendance: [
    { category: 'attendance', categoryLabel: 'الحضور', name: 'تسجيل الحضور اليومي', description: 'التحقق من تسجيل حضور وانصراف جميع الموظفين', status: 'fail', impact: 'عالي', suggestedFix: 'تسجيل البصمات الناقصة', affectedCount: 5, ruleId: 'ATT-001' },
    { category: 'attendance', categoryLabel: 'الحضور', name: 'ساعات العمل القانونية', description: 'التحقق من عدم تجاوز ساعات العمل القانونية', status: 'pass', impact: 'متوسط', suggestedFix: '', affectedCount: 0, ruleId: 'ATT-002' },
    { category: 'attendance', categoryLabel: 'الحضور', name: 'الإجازات المرضية', description: 'التحقق من توثيق الإجازات المرضية بتقارير طبية', status: 'warning', impact: 'متوسط', suggestedFix: 'إرفاق التقارير الطبية', affectedCount: 4, ruleId: 'ATT-003' },
  ],
  calculation: [
    { category: 'calculation', categoryLabel: 'الاحتساب', name: 'صحة احتساب البدلات', description: 'التحقق من صحة احتساب بدل السكن والمواصلات', status: 'pass', impact: 'عالي', suggestedFix: '', affectedCount: 0, ruleId: 'CAL-001' },
    { category: 'calculation', categoryLabel: 'الاحتساب', name: 'الحد الأدنى للأجور', description: 'التحقق من عدم مخالفة الحد الأدنى للأجور', status: 'pass', impact: 'عالي', suggestedFix: '', affectedCount: 0, ruleId: 'CAL-002' },
    { category: 'calculation', categoryLabel: 'الاحتساب', name: 'ساعات العمل الإضافي', description: 'التحقق من احتساب ساعات العمل الإضافي بشكل صحيح', status: 'fail', impact: 'عالي', suggestedFix: 'إعادة احتساب ساعات العمل الإضافي', affectedCount: 2, ruleId: 'CAL-003' },
    { category: 'calculation', categoryLabel: 'الاحتساب', name: 'نسبة الخصومات', description: 'التحقق من عدم تجاوز نسبة الخصومات المسموح بها', status: 'warning', impact: 'متوسط', suggestedFix: 'مراجعة الخصومات المخصومة', affectedCount: 1, ruleId: 'CAL-004' },
  ],
  tax: [
    { category: 'tax', categoryLabel: 'الضرائب', name: 'ضريبة الدخل', description: 'التحقق من احتساب ضريبة الدخل المقتطعة من الرواتب', status: 'pass', impact: 'عالي', suggestedFix: '', affectedCount: 0, ruleId: 'TAX-001' },
    { category: 'tax', categoryLabel: 'الضرائب', name: 'إقرارات الضريبة', description: 'التحقق من تقديم إقرارات ضريبة الرواتب للهيئة', status: 'fail', impact: 'عالي', suggestedFix: 'تقديم الإقرارات الضريبية المستحقة', affectedCount: 1, ruleId: 'TAX-002' },
    { category: 'tax', categoryLabel: 'الضرائب', name: 'خصم ضريبي', description: 'التحقق من صحة الخصم الضريبي للموظفين', status: 'pass', impact: 'متوسط', suggestedFix: '', affectedCount: 0, ruleId: 'TAX-003' },
  ],
  insurance: [
    { category: 'insurance', categoryLabel: 'التأمينات', name: 'التأمينات الاجتماعية', description: 'التحقق من تسجيل الموظفين في التأمينات الاجتماعية', status: 'fail', impact: 'عالي', suggestedFix: 'تسجيل الموظفين غير المسجلين', affectedCount: 3, ruleId: 'INS-001' },
    { category: 'insurance', categoryLabel: 'التأمينات', name: 'التأمين الطبي', description: 'التحقق من تغطية التأمين الطبي لجميع الموظفين', status: 'warning', impact: 'متوسط', suggestedFix: 'تجديد وثائق التأمين الطبي للموظفين', affectedCount: 6, ruleId: 'INS-002' },
    { category: 'insurance', categoryLabel: 'التأمينات', name: 'سداد الاشتراكات', description: 'التحقق من سداد اشتراكات التأمينات الاجتماعية', status: 'pass', impact: 'عالي', suggestedFix: '', affectedCount: 0, ruleId: 'INS-003' },
  ],
  'end-of-service': [
    { category: 'end-of-service', categoryLabel: 'نهاية الخدمة', name: 'مستحقات نهاية الخدمة', description: 'التحقق من احتساب مكافأة نهاية الخدمة بشكل صحيح', status: 'pass', impact: 'عالي', suggestedFix: '', affectedCount: 0, ruleId: 'EOS-001' },
    { category: 'end-of-service', categoryLabel: 'نهاية الخدمة', name: 'رصيد الإجازات', description: 'التحقق من صحة رصيد الإجازات السنوية المتبقية', status: 'fail', impact: 'متوسط', suggestedFix: 'تحديث رصيد الإجازات في النظام', affectedCount: 4, ruleId: 'EOS-002' },
    { category: 'end-of-service', categoryLabel: 'نهاية الخدمة', name: 'إنذارات الموظفين', description: 'التحقق من وجود إنذارات قد تؤثر على مستحقات نهاية الخدمة', status: 'warning', impact: 'منخفض', suggestedFix: 'مراجعة ملفات الموظفين المعنيين', affectedCount: 2, ruleId: 'EOS-003' },
  ],
}

function generateMockValidationChecks(): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  let id = 1
  for (const [, items] of Object.entries(categoryChecks)) {
    for (const item of items) {
      checks.push({ ...item, id: `vc-${id++}` })
    }
  }
  return checks
}

function generateMockValidationHistory(): { id: string; date: number; action: string; result: string; checksCount: number; passedCount: number }[] {
  return Array.from({ length: 6 }, (_, idx) => ({
    id: `vh-${idx}`,
    date: Date.now() - idx * 7 * 24 * 60 * 60 * 1000,
    action: `فحص التحقق رقم ${idx + 1}`,
    result: Math.random() > 0.3 ? 'ناجح' : 'فشل',
    checksCount: 18,
    passedCount: Math.floor(14 + Math.random() * 5),
  }))
}

export function PayrollValidationCenter() {
  const [allChecks] = useState<ValidationCheck[]>(() => generateMockValidationChecks())
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentingOpen, setCommentingOpen] = useState(false)
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set())
  const [validationMessages] = useState<ValidationMessage[]>(() => generateMockValidationMessages('payroll'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('payroll'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())
  const [validationHistory] = useState(() => generateMockValidationHistory())

  const totalChecks = allChecks.length
  const passedChecks = allChecks.filter((c) => c.status === 'pass').length
  const warningChecks = allChecks.filter((c) => c.status === 'warning').length
  const failedChecks = allChecks.filter((c) => c.status === 'fail').length

  const selectedCheck = useMemo(() => {
    if (!selectedCheckId) return null
    return allChecks.find((c) => c.id === selectedCheckId) ?? null
  }, [selectedCheckId, allChecks])

  const groupedChecks = useMemo(() => {
    const groups: Record<string, ValidationCheck[]> = {}
    for (const check of allChecks) {
      if (!groups[check.category]) groups[check.category] = []
      groups[check.category].push(check)
    }
    return groups
  }, [allChecks])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total', label: 'إجمالي عمليات التحقق', value: totalChecks, icon: 'CheckCircle2', severity: 'info' },
    { id: 'passed', label: 'ناجح', value: passedChecks, icon: 'CheckCircle2', severity: 'success', change: 12, trend: 'up' },
    { id: 'warnings', label: 'تحذيرات', value: warningChecks, icon: 'AlertTriangle', severity: 'warning' },
    { id: 'failed', label: 'راسب', value: failedChecks, icon: 'AlertTriangle', severity: 'critical' },
  ], [totalChecks, passedChecks, warningChecks, failedChecks])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'run-all', label: 'تشغيل جميع الفحوصات', type: 'primary', icon: 'RefreshCw', handler: () => {} },
    { id: 'fix-selected', label: 'إصلاح المحدد', type: 'secondary', icon: 'CheckSquare', handler: () => {} },
    { id: 'validate', label: 'إعادة التحقق', type: 'secondary', icon: 'Shield', handler: () => {} },
    { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
  ], [])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'تفاصيل الفحص', icon: 'info' },
    { id: 'affected', label: 'الموظفون المتأثرون', icon: 'file', badge: selectedCheck?.affectedCount },
    { id: 'comments', label: 'تعليقات', icon: 'message', badge: comments.filter((c) => !c.resolved).length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
  ], [selectedCheck, comments])

  const handleFix = (checkId: string) => {
    setFixingIds((prev) => {
      const next = new Set(prev)
      next.add(checkId)
      return next
    })
    setTimeout(() => {
      setFixingIds((prev) => {
        const next = new Set(prev)
        next.delete(checkId)
        return next
      })
    }, 1500)
  }

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return CheckCircle2
    if (status === 'warning') return AlertTriangle
    return X
  }

  const getStatusColor = (status: string) => {
    if (status === 'pass') return 'text-green-600 bg-green-50 border-green-200'
    if (status === 'warning') return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getStatusBg = (status: string) => {
    if (status === 'pass') return 'bg-green-50 border-green-200'
    if (status === 'warning') return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <WorkbenchShell
      title="مركز التحقق من الرواتب"
      description="التحقق الشامل من بيانات واحتسابات الرواتب قبل الاعتماد"
      breadcrumbs={[
        { label: 'الرئيسية', icon: Home },
        { label: 'الرواتب', icon: Banknote },
        { label: 'مركز التحقق', icon: Shield },
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
          title="تفاصيل التحقق"
        >
          {!selectedCheck ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">اختر فحصاً لعرض التفاصيل</p>
            </div>
          ) : inspectorTab === 'info' ? (
            <div className="space-y-6" dir="rtl">
              <div className={cn('rounded-xl border p-4 space-y-3', getStatusBg(selectedCheck.status))}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{selectedCheck.name}</h4>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    selectedCheck.status === 'pass' ? 'bg-green-100 text-green-700' : selectedCheck.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                  )}>
                    {selectedCheck.status === 'pass' ? 'ناجح' : selectedCheck.status === 'warning' ? 'تحذير' : 'راسب'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{selectedCheck.description}</p>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">قاعدة التحقق: </span>
                    <span className="font-mono">{selectedCheck.ruleId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">التأثير: </span>
                    <span className="font-medium">{selectedCheck.impact}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المتأثرون: </span>
                    <span className={cn('font-medium', selectedCheck.affectedCount > 0 && 'text-red-600')}>{selectedCheck.affectedCount}</span>
                  </div>
                </div>
              </div>

              {selectedCheck.status !== 'pass' && (
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    الإصلاح المقترح
                  </h4>
                  <p className="text-xs text-muted-foreground">{selectedCheck.suggestedFix}</p>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={fixingIds.has(selectedCheck.id)}
                    onClick={() => handleFix(selectedCheck.id)}
                  >
                    {fixingIds.has(selectedCheck.id) ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الإصلاح...</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> إصلاح الآن</>
                    )}
                  </Button>
                </div>
              )}

              {selectedCheck.affectedCount > 0 && (
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="text-sm font-semibold">الموظفون المتأثرون</h4>
                  <div className="space-y-2">
                    {Array.from({ length: Math.min(selectedCheck.affectedCount, 5) }, (_, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                          {['أ', 'س', 'ف', 'ن', 'م'][idx]}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">موظف #{idx + 1}</p>
                          <p className="text-[10px] text-muted-foreground">EMP-{String(100 + idx).padStart(3, '0')}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : inspectorTab === 'affected' ? (
            <div className="space-y-3" dir="rtl">
              {selectedCheck.affectedCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">لا يوجد موظفون متأثرون</p>
                </div>
              ) : (
                Array.from({ length: selectedCheck.affectedCount }, (_, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {['أ', 'س', 'ف', 'ن', 'م', 'ر'][idx % 6]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {['أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله', 'ماجد الحربي', 'ريم الشهري'][idx % 6]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {['المالية', 'المشتريات', 'المبيعات', 'الموارد البشرية', 'تكنولوجيا المعلومات', 'المستودعات'][idx % 6]}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          ) : inspectorTab === 'comments' ? (
            <OperationalCommenting comments={comments} />
          ) : (
            <div className="space-y-3" dir="rtl">
              <h4 className="text-sm font-semibold">سجل التحقق لهذه الدورة</h4>
              {validationHistory.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className={cn('p-1.5 rounded-lg', entry.result === 'ناجح' ? 'bg-green-50' : 'bg-red-50')}>
                    {entry.result === 'ناجح' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.passedCount}/{entry.checksCount} فحص ناجح
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(entry.date).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    entry.result === 'ناجح' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                  )}>
                    {entry.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </InspectorPanel>
      }
      validationBar={
        <RealtimeValidationBar
          messages={validationMessages}
          onDismiss={(id) => {}}
        />
      }
      aiPanel={
        <AIAssistancePanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          domain="payroll"
          insights={aiInsights}
        />
      }
      sidebar={
        <div className="flex flex-col h-full" dir="rtl">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm mb-3">فئات التحقق</h3>
            <div className="space-y-1">
              {validationCategories.map((cat) => {
                const catChecks = groupedChecks[cat.id] || []
                const catFails = catChecks.filter((c) => c.status === 'fail').length
                const catWarnings = catChecks.filter((c) => c.status === 'warning').length
                const isExpanded = expandedCategory === cat.id
                return (
                  <div key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                      className="w-full text-right flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-primary/5">
                        <cat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{cat.label}</p>
                        <p className="text-[10px] text-muted-foreground">{catChecks.length} فحص</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {catFails > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            {catFails}
                          </span>
                        )}
                        {catWarnings > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {catWarnings}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {expandedCategory && groupedChecks[expandedCategory] ? (
              <div className="divide-y">
                {groupedChecks[expandedCategory].map((check) => {
                  const StatusIcon = getStatusIcon(check.status)
                  return (
                    <button
                      key={check.id}
                      type="button"
                      onClick={() => { setSelectedCheckId(check.id); setInspectorOpen(true) }}
                      className={cn(
                        'w-full text-right p-3 hover:bg-muted/30 transition-colors',
                        selectedCheckId === check.id && 'bg-primary/5 border-r-2 border-primary',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={cn(
                          'h-4 w-4',
                          check.status === 'pass' ? 'text-green-500' : check.status === 'warning' ? 'text-amber-500' : 'text-red-500',
                        )} />
                        <span className="text-sm font-medium">{check.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pr-6">{check.description.substring(0, 50)}...</p>
                      <div className="flex items-center gap-2 pr-6 mt-1">
                        {check.affectedCount > 0 && (
                          <span className="text-[10px] text-red-500">{check.affectedCount} متأثر</span>
                        )}
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          check.status === 'pass' ? 'bg-green-100 text-green-700' : check.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                        )}>
                          {check.status === 'pass' ? 'ناجح' : check.status === 'warning' ? 'تحذير' : 'راسب'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">اختر فئة لعرض الفحوصات</p>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="p-6 h-full" dir="rtl">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {validationCategories.map((cat) => {
            const catChecks = groupedChecks[cat.id] || []
            const catPassed = catChecks.filter((c) => c.status === 'pass').length
            const catFailed = catChecks.filter((c) => c.status === 'fail').length
            const progress = catChecks.length > 0 ? (catPassed / catChecks.length) * 100 : 0
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setExpandedCategory(cat.id)}
                className={cn(
                  'rounded-xl border bg-card p-4 text-right hover:shadow-md transition-all',
                  expandedCategory === cat.id && 'ring-2 ring-primary',
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    catFailed > 0 ? 'bg-red-50' : 'bg-green-50',
                  )}>
                    <cat.icon className={cn('h-5 w-5', catFailed > 0 ? 'text-red-500' : 'text-green-500')} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold">{cat.label}</h4>
                    <p className="text-xs text-muted-foreground">{catChecks.length} قاعدة</p>
                  </div>
                  <div className="text-left">
                    {catFailed > 0 && (
                      <span className="text-xs font-bold text-red-600">{catFailed} راسب</span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      progress === 100 ? 'bg-green-500' : catFailed > 0 ? 'bg-red-500' : 'bg-amber-500',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{Math.round(progress)}% ناجح</span>
                  <span>{catPassed}/{catChecks.length}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">سجل نتائج التحقق</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <RefreshCw className="h-3.5 w-3.5" />
                تشغيل الفحوصات
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
                <Sparkles className="h-3.5 w-3.5" />
                اقتراحات ذكية
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {validationHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا يوجد سجل تحقق بعد</p>
              </div>
            ) : (
              validationHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                  <div className={cn(
                    'p-2 rounded-lg',
                    entry.result === 'ناجح' ? 'bg-green-50' : 'bg-red-50',
                  )}>
                    {entry.result === 'ناجح' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.passedCount}/{entry.checksCount} فحص ناجح
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString('ar-SA')}</p>
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      entry.result === 'ناجح' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    )}>
                      {entry.result}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AuditOverlay
        entries={auditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId="validation-center"
        entityType="PayrollValidation"
      />
    </WorkbenchShell>
  )
}

'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Users, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Calendar, Banknote, Briefcase, Percent, Calculator, CreditCard, Fingerprint, Coffee, Home, Heart, Stethoscope, GraduationCap } from 'lucide-react'
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

const statusLabels: Record<string, string> = {
  draft: 'مسودة',
  processing: 'قيد المعالجة',
  validated: 'مدقق',
  approved: 'معتمد',
  paid: 'مدفوع',
  cancelled: 'ملغي',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  validated: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: FileText,
  processing: Loader2,
  validated: Shield,
  approved: CheckCircle2,
  paid: Banknote,
  cancelled: Ban,
}

const phases = ['début', 'processing', 'validated', 'approved', 'paid', 'closed']

const phaseLabels: Record<string, string> = {
  'début': 'بدء',
  'processing': 'معالجة',
  'validated': 'تدقيق',
  'approved': 'اعتماد',
  'paid': 'دفع',
  'closed': 'مغلق',
}

export function PayrollProcessingWorkbench() {
  const [payrollRuns] = useState<PayrollRun[]>(() => generateMockPayrollRuns(12))
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [employees] = useState<PayrollEmployee[]>(() => generateMockPayrollEmployees(20))
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentingOpen, setCommentingOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [validationMessages] = useState<ValidationMessage[]>(() => generateMockValidationMessages('payroll'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('payroll'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())
  const [processingPhase, setProcessingPhase] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null
    return payrollRuns.find((r) => r.id === selectedRunId) ?? null
  }, [selectedRunId, payrollRuns])

  const runEmployees = useMemo(() => {
    if (!selectedRun) return []
    return employees.slice(0, selectedRun.employeeCount)
  }, [selectedRun, employees])

  const filteredRuns = useMemo(() => {
    let result = [...payrollRuns]
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => r.period.toLowerCase().includes(q))
    }
    return result
  }, [payrollRuns, statusFilter, searchQuery])

  const currentPeriod = payrollRuns[0]?.period ?? '—'
  const totalEmployees = employees.length
  const payrollTotal = useMemo(() => employees.reduce((s, e) => s + e.netPay, 0), [employees])
  const processedCount = employees.filter((e) => e.status === 'valid').length

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'period', label: 'الفترة الحالية', value: currentPeriod, icon: 'Calendar', severity: 'info' },
    { id: 'employees', label: 'إجمالي الموظفين', value: totalEmployees, icon: 'Users', severity: 'info', change: 2.1, trend: 'up' },
    { id: 'payroll-total', label: 'إجمالي الرواتب', value: payrollTotal, icon: 'DollarSign', severity: 'info', change: -1.5, trend: 'down' },
    { id: 'processed', label: 'تمت المعالجة', value: `${processedCount}/${totalEmployees}`, icon: 'CheckCircle2', severity: processedCount === totalEmployees ? 'success' : 'warning' },
  ], [currentPeriod, totalEmployees, payrollTotal, processedCount])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'new-run', label: 'دورة جديدة', type: 'primary', icon: 'Plus', handler: () => {} },
    { id: 'process', label: 'معالجة', type: 'secondary', icon: 'Send', handler: () => handleProcessRun() },
    { id: 'bank-file', label: 'ملف بنكي', type: 'secondary', icon: 'Download', handler: () => {} },
    { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
  ], [])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'معلومات الدورة', icon: 'info' },
    { id: 'employees', label: 'الموظفين', icon: 'file', badge: selectedRun?.employeeCount },
    { id: 'comments', label: 'تعليقات', icon: 'message', badge: comments.filter((c) => !c.resolved).length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
  ], [selectedRun, comments])

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId)
    setInspectorOpen(true)
  }

  const handleProcessRun = useCallback(() => {
    if (!selectedRun) return
    setIsProcessing(true)
    const interval = setInterval(() => {
      setProcessingPhase((prev) => {
        if (prev >= 5) {
          clearInterval(interval)
          setIsProcessing(false)
          return 5
        }
        return prev + 1
      })
    }, 800)
  }, [selectedRun])

  const formatCurrency = (value: number) =>
    value.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <WorkbenchShell
      title="منصة معالجة الرواتب"
      description="إدارة دورات الرواتب ومعالجة مستحقات الموظفين"
      breadcrumbs={[
        { label: 'الرئيسية', icon: Home },
        { label: 'الرواتب', icon: Banknote },
        { label: 'معالجة الرواتب', icon: Calculator },
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
          title="تفاصيل دورة الرواتب"
        >
          {!selectedRun ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">اختر دورة راتب لعرض التفاصيل</p>
            </div>
          ) : inspectorTab === 'info' ? (
            <div className="space-y-6" dir="rtl">
              <div className="rounded-xl border p-4 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  معلومات الدورة
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">الفترة</p>
                    <p className="font-medium">{selectedRun.period}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">الحالة</p>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusColors[selectedRun.status])}>
                      {statusLabels[selectedRun.status]}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">تاريخ البداية</p>
                    <p className="font-medium">{new Date(selectedRun.startDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">تاريخ النهاية</p>
                    <p className="font-medium">{new Date(selectedRun.endDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">تاريخ الدفع</p>
                    <p className="font-medium">{new Date(selectedRun.payDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">عدد الموظفين</p>
                    <p className="font-medium">{selectedRun.employeeCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  ملخص الرواتب
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">إجمالي الرواتب</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedRun.totalAmount)} ريال</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">متوسط الراتب</span>
                    <span className="font-medium">{formatCurrency(selectedRun.totalAmount / selectedRun.employeeCount)} ريال</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الحالات الشاذة</span>
                    <span className={cn('font-medium', selectedRun.anomalies > 0 ? 'text-red-600' : 'text-green-600')}>
                      {selectedRun.anomalies}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  مراحل المعالجة
                </h4>
                <div className="space-y-2">
                  {phases.map((phase, idx) => {
                    const active = idx <= processingPhase
                    return (
                      <div key={phase} className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active ? 'bg-primary/5 text-foreground' : 'text-muted-foreground/50',
                      )}>
                        <div className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          active ? 'bg-primary' : 'bg-muted',
                        )} />
                        <span className={active ? 'font-medium' : ''}>{phaseLabels[phase]}</span>
                        {active && idx === processingPhase && processingPhase < 5 && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary mr-auto" />
                        )}
                        {active && idx < processingPhase && (
                          <CheckCircle2 className="h-3 w-3 text-green-500 mr-auto" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : inspectorTab === 'employees' ? (
            <div className="space-y-3" dir="rtl">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث عن موظف..."
                    className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              {runEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">لا يوجد موظفون في هذه الدورة</p>
                </div>
              ) : (
                runEmployees.map((emp) => (
                  <div key={emp.id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {emp.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-[11px] text-muted-foreground">{emp.employeeId} - {emp.department}</p>
                        </div>
                      </div>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        emp.status === 'valid' ? 'bg-green-100 text-green-700' : emp.status === 'anomaly' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {emp.status === 'valid' ? 'صحيح' : emp.status === 'anomaly' ? 'شاذ' : 'معلق'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">الأساسي</span>
                        <p className="font-medium">{formatCurrency(emp.basicSalary)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">البدلات</span>
                        <p className="font-medium text-green-600">{formatCurrency(emp.allowances)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">الاستقطاعات</span>
                        <p className="font-medium text-red-600">{formatCurrency(emp.deductions)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">صافي الراتب</span>
                      <span className="text-sm font-bold">{formatCurrency(emp.netPay)} ريال</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : inspectorTab === 'comments' ? (
            <OperationalCommenting comments={comments} />
          ) : (
            <div className="space-y-3" dir="rtl">
              <h4 className="text-sm font-semibold">النشاط الحديث</h4>
              {auditEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="p-1.5 rounded-lg bg-primary/5">
                    <History className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.actor}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{entry.details}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(entry.timestamp).toLocaleDateString('ar-SA')}
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
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في دورات الرواتب..."
                className="flex h-10 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1 mt-3 overflow-x-auto">
              {['all', 'draft', 'processing', 'validated', 'approved', 'paid'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors',
                    statusFilter === status
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {status === 'all' ? 'الكل' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد دورات رواتب</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  إنشاء دورة جديدة
                </Button>
              </div>
            ) : (
              filteredRuns.map((run) => {
                const StatusIcon = statusIcons[run.status]
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleSelectRun(run.id)}
                    className={cn(
                      'w-full text-right p-4 hover:bg-muted/30 transition-colors',
                      selectedRunId === run.id && 'bg-primary/5 border-r-2 border-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{run.period}</span>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', statusColors[run.status])}>
                        {StatusIcon && <StatusIcon className="h-2.5 w-2.5" />}
                        {statusLabels[run.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {run.employeeCount}
                      </span>
                      <span>{formatCurrency(run.totalAmount)} ريال</span>
                      {run.anomalies > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-3 w-3" />
                          {run.anomalies}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      }
    >
      <div className="p-6 h-full flex flex-col" dir="rtl">
        {!selectedRun ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Calculator className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">اختر دورة راتب</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              اختر دورة راتب من القائمة الجانبية لعرض التفاصيل وإجراء عمليات المعالجة والتدقيق والاعتماد
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold">{selectedRun.period}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  معالجة رواتب {selectedRun.employeeCount} موظف - إجمالي {formatCurrency(selectedRun.totalAmount)} ريال
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                  <Printer className="h-3.5 w-3.5" />
                  طباعة
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                  <Download className="h-3.5 w-3.5" />
                  تصدير
                </Button>
                <Button variant="default" size="sm" className="h-9 text-xs gap-1" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  المساعدة بالذكاء الاصطناعي
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">الموظفون</span>
                </div>
                <p className="text-2xl font-bold">{selectedRun.employeeCount}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">إجمالي الأساسي</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(selectedRun.totalAmount * 0.7)}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">إجمالي البدلات</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(selectedRun.totalAmount * 0.2)}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-muted-foreground">إجمالي الاستقطاعات</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(selectedRun.totalAmount * 0.1)}</p>
              </div>
            </div>

            <div className="rounded-xl border mb-6">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">مراحل المعالجة</h3>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={isProcessing || selectedRun.status === 'paid' || selectedRun.status === 'cancelled'}
                  onClick={handleProcessRun}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري المعالجة...</>
                  ) : (
                    <><Send className="h-3.5 w-3.5" /> بدء المعالجة</>
                  )}
                </Button>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  {phases.map((phase, idx) => {
                    const active = idx <= processingPhase
                    const PhaseIcon = idx === 0 ? FileText : idx === 1 ? Loader2 : idx === 2 ? Shield : idx === 3 ? CheckCircle2 : idx === 4 ? Banknote : Ban
                    return (
                      <div key={phase} className="flex flex-col items-center gap-2">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all',
                          active ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground/50',
                        )}>
                          <PhaseIcon className={cn('h-4 w-4', phase === 'processing' && isProcessing && 'animate-spin')} />
                        </div>
                        <span className={cn('text-[10px] font-medium', active && 'text-primary')}>{phaseLabels[phase]}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="relative mt-2">
                  <div className="absolute top-0 right-[8%] left-[8%] h-0.5 bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${(processingPhase / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 rounded-xl border">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">تفاصيل الموظفين</h3>
                  <span className="text-xs text-muted-foreground">({runEmployees.length} موظف)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="بحث..."
                      className="flex h-8 w-48 rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الموظف</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">القسم</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الراتب الأساسي</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">البدلات</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الاستقطاعات</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">صافي الراتب</th>
                      <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الحالة</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {runEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                          لا يوجد موظفون في هذه الدورة
                        </td>
                      </tr>
                    ) : (
                      runEmployees.map((emp, idx) => (
                        <tr key={emp.id} className={cn('border-b last:border-b-0 hover:bg-muted/20 transition-colors', idx % 2 === 0 && 'bg-muted/10')}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {emp.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{emp.name}</p>
                                <p className="text-[10px] text-muted-foreground">{emp.employeeId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">{emp.department}</td>
                          <td className="py-3 px-4 font-medium">{formatCurrency(emp.basicSalary)}</td>
                          <td className="py-3 px-4 font-medium text-green-600">{formatCurrency(emp.allowances)}</td>
                          <td className="py-3 px-4 font-medium text-red-600">{formatCurrency(emp.deductions)}</td>
                          <td className="py-3 px-4 font-bold">{formatCurrency(emp.netPay)}</td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                              emp.status === 'valid' ? 'bg-green-100 text-green-700' : emp.status === 'anomaly' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                            )}>
                              {emp.status === 'valid' ? 'صحيح' : emp.status === 'anomaly' ? 'شاذ' : 'معلق'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AuditOverlay
        entries={auditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedRunId ?? undefined}
        entityType="PayrollRun"
      />
    </WorkbenchShell>
  )
}

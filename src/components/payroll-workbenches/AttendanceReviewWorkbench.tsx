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

interface AttendanceRecord {
  id: string
  employeeId: string
  name: string
  department: string
  checkIn: string
  checkOut: string
  hoursWorked: number
  status: 'present' | 'late' | 'absent' | 'leave' | 'mission'
  lateMinutes: number
  earlyDeparture: boolean
  missingPunch: boolean
  overtime: number
}

interface AttendanceStats {
  total: number
  present: number
  absent: number
  onLeave: number
  late: number
  onMission: number
  exceptions: number
}

const statusLabels: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  leave: 'إجازة',
  mission: 'مهمة رسمية',
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-700 border-green-200',
  late: 'bg-amber-100 text-amber-700 border-amber-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
  leave: 'bg-blue-100 text-blue-700 border-blue-200',
  mission: 'bg-purple-100 text-purple-700 border-purple-200',
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  present: CheckCircle2,
  late: AlertTriangle,
  absent: X,
  leave: Calendar,
  mission: Briefcase,
}

const departments = [
  'جميع الأقسام', 'المالية', 'المشتريات', 'المبيعات', 'الموارد البشرية',
  'تكنولوجيا المعلومات', 'المستودعات', 'الصيانة', 'التسويق',
]

const employeeAttendanceNames = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني', 'هند السلمي',
  'سعود المطيري', 'منال الغامدي', 'عبدالله الزهراني', 'أمل الشمري',
  'نايف الدوسري', 'مريم البقمي', 'تركي العنزي', 'لينا الحارثي',
  'بدر العجمي', 'نوف الشهراني', 'سلطان القرشي', 'حنان الثقفي',
  'مشعل البريدي', 'عهود الزهراني', 'فيصل الغامدي', 'نورة النمري',
  'عمر السبيعي', 'سارة القحطاني', 'زيد الشهراني', 'مها المالكي',
]

function generateMockAttendanceData(): AttendanceRecord[] {
  const departmentsList = departments.slice(1)
  return Array.from({ length: 28 }, (_, idx) => {
    const statusWeights: ('present' | 'late' | 'absent' | 'leave' | 'mission')[] = ['present', 'present', 'present', 'present', 'present', 'present', 'late', 'late', 'absent', 'leave', 'mission']
    const status = statusWeights[Math.floor(Math.random() * statusWeights.length)]
    const lateMinutes = status === 'late' ? Math.floor(Math.random() * 45) + 5 : 0
    const earlyDeparture = Math.random() > 0.85
    const missingPunch = Math.random() > 0.9
    const hoursWorked = status === 'present' || status === 'late' ? 7 + Math.random() * 2 : 0
    const overtime = hoursWorked > 8 ? hoursWorked - 8 : 0
    return {
      id: `att-${idx}`,
      employeeId: `EMP-${String(idx + 1).padStart(3, '0')}`,
      name: employeeAttendanceNames[idx],
      department: departmentsList[idx % departmentsList.length],
      checkIn: status === 'absent' || status === 'leave' ? '—' : `${String(7 + Math.floor(Math.random() * 2)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      checkOut: status === 'absent' || status === 'leave' ? '—' : `${String(15 + Math.floor(Math.random() * 3)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      hoursWorked: parseFloat(hoursWorked.toFixed(1)),
      status,
      lateMinutes,
      earlyDeparture,
      missingPunch,
      overtime: parseFloat(overtime.toFixed(1)),
    }
  })
}

function calculateStats(records: AttendanceRecord[]): AttendanceStats {
  return {
    total: records.length,
    present: records.filter((r) => r.status === 'present').length,
    absent: records.filter((r) => r.status === 'absent').length,
    onLeave: records.filter((r) => r.status === 'leave').length,
    late: records.filter((r) => r.status === 'late').length,
    onMission: records.filter((r) => r.status === 'mission').length,
    exceptions: records.filter((r) => r.lateMinutes > 0 || r.earlyDeparture || r.missingPunch).length,
  }
}

const dateOptions = [
  'اليوم', 'الأمس', 'هذا الأسبوع', 'الأسبوع الماضي', 'هذا الشهر', 'الشهر الماضي',
]

export function AttendanceReviewWorkbench() {
  const [attendanceRecords] = useState<AttendanceRecord[]>(() => generateMockAttendanceData())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState('جميع الأقسام')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState(dateOptions[0])
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentingOpen, setCommentingOpen] = useState(false)
  const [validationMessages] = useState<ValidationMessage[]>(() => generateMockValidationMessages('payroll'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('payroll'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())

  const stats = useMemo(() => calculateStats(attendanceRecords), [attendanceRecords])

  const filteredRecords = useMemo(() => {
    let result = [...attendanceRecords]
    if (departmentFilter !== 'جميع الأقسام') {
      result = result.filter((r) => r.department === departmentFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q),
      )
    }
    return result
  }, [attendanceRecords, departmentFilter, searchQuery])

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null
    return attendanceRecords.find((r) => r.id === selectedEmployeeId) ?? null
  }, [selectedEmployeeId, attendanceRecords])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total', label: 'إجمالي الموظفين', value: stats.total, icon: 'Users', severity: 'info' },
    { id: 'present', label: 'حاضر', value: stats.present, icon: 'CheckCircle2', severity: 'success', change: 3, trend: 'up' },
    { id: 'absent', label: 'غائب', value: stats.absent, icon: 'AlertTriangle', severity: 'critical' },
    { id: 'exceptions', label: 'استثناءات', value: stats.exceptions, icon: 'AlertTriangle', severity: stats.exceptions > 0 ? 'warning' : 'success' },
  ], [stats])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'approve-all', label: 'اعتماد الكل', type: 'primary', icon: 'CheckSquare', handler: () => {} },
    { id: 'export', label: 'تصدير', type: 'secondary', icon: 'Download', handler: () => {} },
    { id: 'adjust-time', label: 'تعديل وقت', type: 'secondary', icon: 'Edit3', handler: () => {} },
    { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
  ], [])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'سجل الحضور', icon: 'info' },
    { id: 'overtime', label: 'العمل الإضافي', icon: 'file' },
    { id: 'leave', label: 'رصيد الإجازات', icon: 'alert' },
    { id: 'comments', label: 'تعليقات', icon: 'message', badge: comments.filter((c) => !c.resolved).length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
  ], [comments])

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }

  return (
    <WorkbenchShell
      title="مراجعة الحضور والانصراف"
      description="إدارة وتدقيق سجلات الحضور والانصراف للموظفين"
      breadcrumbs={[
        { label: 'الرئيسية', icon: Home },
        { label: 'الرواتب', icon: Banknote },
        { label: 'الحضور والانصراف', icon: Clock },
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
          title="تفاصيل الموظف"
        >
          {!selectedEmployee ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">اختر موظفاً لعرض التفاصيل</p>
            </div>
          ) : inspectorTab === 'info' ? (
            <div className="space-y-6" dir="rtl">
              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                    {selectedEmployee.name[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold">{selectedEmployee.name}</h4>
                    <p className="text-xs text-muted-foreground">{selectedEmployee.employeeId} - {selectedEmployee.department}</p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mr-auto',
                    statusColors[selectedEmployee.status],
                  )}>
                    {statusLabels[selectedEmployee.status]}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">سجل اليوم</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">وقت الحضور</p>
                    <p className="text-lg font-bold">{selectedEmployee.checkIn}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">وقت الانصراف</p>
                    <p className="text-lg font-bold">{selectedEmployee.checkOut}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ساعات العمل</p>
                    <p className="text-lg font-bold">{formatHours(selectedEmployee.hoursWorked)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">العمل الإضافي</p>
                    <p className={cn('text-lg font-bold', selectedEmployee.overtime > 0 ? 'text-amber-600' : '')}>
                      {selectedEmployee.overtime > 0 ? formatHours(selectedEmployee.overtime) : '—'}
                    </p>
                  </div>
                </div>
                {selectedEmployee.lateMinutes > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-700 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    تأخر {selectedEmployee.lateMinutes} دقيقة
                  </div>
                )}
                {selectedEmployee.earlyDeparture && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-700 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    انصراف مبكر
                  </div>
                )}
                {selectedEmployee.missingPunch && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
                    <X className="h-3.5 w-3.5 shrink-0" />
                    بصمة ناقصة
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">سجل الحضور (آخر 7 أيام)</h4>
                <div className="space-y-2">
                  {Array.from({ length: 7 }, (_, idx) => {
                    const dayStatuses: ('present' | 'late' | 'absent' | 'leave' | 'mission')[] = ['present', 'present', 'late', 'present', 'absent', 'leave', 'present']
                    const day = dayStatuses[idx % dayStatuses.length]
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={cn(
                          'h-2 w-2 rounded-full',
                          day === 'present' ? 'bg-green-500' : day === 'late' ? 'bg-amber-500' : day === 'absent' ? 'bg-red-500' : day === 'leave' ? 'bg-blue-500' : 'bg-purple-500',
                        )} />
                        <span className="text-xs flex-1">
                          {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][idx]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {day === 'present' ? '08:00 - 16:00' : day === 'late' ? '08:35 - 16:00' : '—'}
                        </span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          day === 'present' ? 'bg-green-100 text-green-700' : day === 'late' ? 'bg-amber-100 text-amber-700' : day === 'absent' ? 'bg-red-100 text-red-700' : day === 'leave' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
                        )}>
                          {statusLabels[day]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : inspectorTab === 'overtime' ? (
            <div className="space-y-4" dir="rtl">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">ملخص العمل الإضافي</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">إجمالي ساعات العمل الإضافي هذا الشهر</span>
                    <span className="font-bold text-lg">{formatHours(12.5)}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">عدد أيام العمل الإضافي</span>
                    <span className="font-medium">8 أيام</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">قيمة بدل العمل الإضافي</span>
                    <span className="font-medium text-green-600">2,450 ريال</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الحد المسموح به</span>
                    <span className="font-medium">20 ساعة</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">النسبة المستخدمة</span>
                    <span className="font-medium">62.5%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '62.5%' }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">تفاصيل العمل الإضافي</h4>
                <div className="space-y-2">
                  {Array.from({ length: 5 }, (_, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-xs font-medium">{['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء'][idx]}</p>
                        <p className="text-[10px] text-muted-foreground">12/0{idx + 1}/2025</p>
                      </div>
                      <span className="text-xs font-medium">{idx + 1}.5 ساعة</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : inspectorTab === 'leave' ? (
            <div className="space-y-4" dir="rtl">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">رصيد الإجازات</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 text-center">
                    <p className="text-2xl font-bold text-green-600">21</p>
                    <p className="text-xs text-muted-foreground">إجازة سنوية</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 text-center">
                    <p className="text-2xl font-bold text-blue-600">14</p>
                    <p className="text-xs text-muted-foreground">إجازة مرضية</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 text-center">
                    <p className="text-2xl font-bold text-amber-600">5</p>
                    <p className="text-xs text-muted-foreground">إجازة طارئة</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 text-center">
                    <p className="text-2xl font-bold text-purple-600">3</p>
                    <p className="text-xs text-muted-foreground">إجازة بدون راتب</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الإجازات الحالية</h4>
                <p className="text-xs text-muted-foreground">لا توجد إجازات حالية</p>
              </div>
            </div>
          ) : inspectorTab === 'comments' ? (
            <OperationalCommenting comments={comments} />
          ) : (
            <div className="space-y-3" dir="rtl">
              <h4 className="text-sm font-semibold">النشاط الحديث</h4>
              {auditEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="p-1.5 rounded-lg bg-primary/5">
                    <History className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.actor}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(entry.timestamp).toLocaleDateString('ar-SA')}</p>
                  </div>
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
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن موظف..."
                className="flex h-10 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {dateOptions.slice(0, 4).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedDate(opt)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors',
                    selectedDate === opt
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {departments.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد سجلات حضور</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredRecords.map((record) => {
                  const StatusIcon = statusIcons[record.status]
                  const hasExceptions = record.lateMinutes > 0 || record.earlyDeparture || record.missingPunch
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => { setSelectedEmployeeId(record.id); setInspectorOpen(true) }}
                      className={cn(
                        'w-full text-right p-3 hover:bg-muted/30 transition-colors',
                        selectedEmployeeId === record.id && 'bg-primary/5 border-r-2 border-primary',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {record.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{record.name}</p>
                          <p className="text-[10px] text-muted-foreground">{record.department}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasExceptions && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <StatusIcon className={cn(
                            'h-4 w-4',
                            record.status === 'present' ? 'text-green-500' : record.status === 'late' ? 'text-amber-500' : record.status === 'absent' ? 'text-red-500' : 'text-blue-500',
                          )} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pr-10">
                        <span>دخول: {record.checkIn}</span>
                        <span>خروج: {record.checkOut}</span>
                        <span>ساعات: {formatHours(record.hoursWorked)}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded font-medium',
                          statusColors[record.status].split(' ').slice(0, 2).join(' '),
                        )}>
                          {statusLabels[record.status]}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="p-6 h-full flex flex-col" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">سجل الحضور - {selectedDate}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              عرض وتدقيق سجلات الحضور والانصراف للموظفين
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
              تحليل ذكي
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          {(['present', 'late', 'absent', 'leave', 'mission'] as const).map((status) => {
            const count = stats[status === 'present' ? 'present' : status === 'late' ? 'late' : status === 'absent' ? 'absent' : status === 'leave' ? 'onLeave' : 'onMission']
            return (
              <div key={status} className={cn('rounded-xl border p-3 text-center', statusColors[status])}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-[10px] mt-1">{statusLabels[status]}</p>
              </div>
            )
          })}
        </div>

        {stats.exceptions > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-6 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              هناك {stats.exceptions} حالة استثناء تتطلب المراجعة: تأخير، انصراف مبكر، أو بصمات ناقصة
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs mr-auto bg-white gap-1">
              <Eye className="h-3.5 w-3.5" />
              عرض الاستثناءات
            </Button>
          </div>
        )}

        <div className="flex-1 rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">قائمة الموظفين</h3>
              <span className="text-xs text-muted-foreground">({filteredRecords.length} موظف)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <Filter className="h-3.5 w-3.5" />
                تصفية
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <ArrowUpDown className="h-3.5 w-3.5" />
                ترتيب
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الموظف</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">القسم</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">وقت الحضور</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">وقت الانصراف</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">ساعات العمل</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الحالة</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">ملاحظات</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                      لا توجد سجلات حضور
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, idx) => (
                    <tr key={record.id} className={cn('border-b last:border-b-0 hover:bg-muted/20 transition-colors', idx % 2 === 0 && 'bg-muted/5')}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {record.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{record.name}</p>
                            <p className="text-[10px] text-muted-foreground">{record.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{record.department}</td>
                      <td className={cn('py-3 px-4 font-medium', record.status === 'absent' || record.status === 'leave' ? 'text-muted-foreground' : '')}>
                        {record.checkIn}
                      </td>
                      <td className={cn('py-3 px-4 font-medium', record.status === 'absent' || record.status === 'leave' ? 'text-muted-foreground' : '')}>
                        {record.checkOut}
                      </td>
                      <td className="py-3 px-4 font-medium">{formatHours(record.hoursWorked)}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                          statusColors[record.status],
                        )}>
                          {statusLabels[record.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {record.lateMinutes > 0 && (
                            <span className="text-[10px] text-amber-600" title={`تأخر ${record.lateMinutes} دقيقة`}>
                              تأخر
                            </span>
                          )}
                          {record.earlyDeparture && (
                            <span className="text-[10px] text-amber-600" title="انصراف مبكر">
                              مبكر
                            </span>
                          )}
                          {record.missingPunch && (
                            <span className="text-[10px] text-red-600" title="بصمة ناقصة">
                              ناقص
                            </span>
                          )}
                          {!record.lateMinutes && !record.earlyDeparture && !record.missingPunch && (
                            <span className="text-[10px] text-green-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-xs text-muted-foreground">
              عرض 1-{filteredRecords.length} من {attendanceRecords.length} موظف
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled>السابق</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">التالي</Button>
            </div>
          </div>
        </div>
      </div>

      <AuditOverlay
        entries={auditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId="attendance-review"
        entityType="AttendanceReview"
      />
    </WorkbenchShell>
  )
}

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

interface DepartmentAllocation {
  id: string
  name: string
  headcount: number
  budgeted: number
  allocated: number
  available: number
  vacancies: number
  utilizationPercent: number
  avgSalary: number
}

interface EmployeeAllocation {
  id: string
  name: string
  employeeId: string
  department: string
  role: string
  project: string
  utilizationPercent: number
  skills: string[]
  availability: 'full' | 'partial' | 'unavailable'
  startDate: number
}

const departments = [
  { id: 'finance', name: 'المالية', budgeted: 12 },
  { id: 'procurement', name: 'المشتريات', budgeted: 15 },
  { id: 'sales', name: 'المبيعات', budgeted: 25 },
  { id: 'hr', name: 'الموارد البشرية', budgeted: 8 },
  { id: 'it', name: 'تكنولوجيا المعلومات', budgeted: 10 },
  { id: 'warehouse', name: 'المستودعات', budgeted: 20 },
  { id: 'maintenance', name: 'الصيانة', budgeted: 14 },
  { id: 'marketing', name: 'التسويق', budgeted: 8 },
]

const employeeNamesAlloc = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني', 'هند السلمي',
  'سعود المطيري', 'منال الغامدي', 'عبدالله الزهراني', 'أمل الشمري',
  'نايف الدوسري', 'مريم البقمي', 'تركي العنزي', 'لينا الحارثي',
  'بدر العجمي', 'نوف الشهراني', 'سلطان القرشي', 'حنان الثقفي',
]

const roleOptions = [
  'مدير', 'محلل مالي', 'محاسب', 'مشتري', 'مندوب مبيعات',
  'أخصائي موارد بشرية', 'مطور برمجيات', 'أخصائي دعم فني',
  'مسؤول مستودع', 'فني صيانة', 'أخصائي تسويق', 'مدير مشروع',
]

const projectOptions = [
  'تطبيق ERP', 'تحسين العمليات', 'التوسع السوقي', 'أتمتة المشتريات',
  'إدارة المخزون', 'التحول الرقمي', 'تحليل البيانات', 'تدريب الموظفين',
  'غير مرتبط بمشروع',
]

const skillOptions = [
  'Excel', 'ERP', 'PowerBI', 'SQL', 'Python', 'SAP', 'Oracle',
  'إدارة المشاريع', 'تحليل البيانات', 'القيادة', 'التفاوض', 'اللغة الإنجليزية',
]

function generateMockDepartmentAllocations(): DepartmentAllocation[] {
  return departments.map((dep) => {
    const headcount = dep.budgeted - Math.floor(Math.random() * 4)
    const allocated = headcount - Math.floor(Math.random() * 3)
    const available = headcount - allocated
    const vacancies = dep.budgeted - headcount
    const utilizationPercent = Math.round((allocated / headcount) * 100)
    const avgSalary = Math.floor(5000 + Math.random() * 10000)
    return {
      ...dep,
      headcount,
      allocated,
      available,
      vacancies: Math.max(0, vacancies),
      utilizationPercent,
      avgSalary,
    }
  })
}

function generateMockEmployeeAllocations(): EmployeeAllocation[] {
  return Array.from({ length: 20 }, (_, idx) => {
    const departmentsList = departments.map((d) => d.name)
    const deptName = departmentsList[idx % departmentsList.length]
    const utilPercent = Math.floor(40 + Math.random() * 60)
    const skillsCount = 2 + Math.floor(Math.random() * 4)
    const shuffled = [...skillOptions].sort(() => Math.random() - 0.5)
    return {
      id: 'emp-alloc-'+idx,
      name: employeeNamesAlloc[idx % employeeNamesAlloc.length],
      employeeId: 'EMP-'+String(100 + idx).padStart(3, '0'),
      department: deptName,
      role: roleOptions[Math.floor(Math.random() * roleOptions.length)],
      project: projectOptions[Math.floor(Math.random() * projectOptions.length)],
      utilizationPercent: utilPercent,
      skills: shuffled.slice(0, skillsCount),
      availability: utilPercent > 80 ? 'full' : utilPercent > 40 ? 'partial' : 'unavailable',
      startDate: Date.now() - Math.floor(Math.random() * 365 * 2 * 24 * 60 * 60 * 1000),
    }
  })
}

const allocationStatusLabels: Record<string, string> = {
  full: 'متفرغ',
  partial: 'جزئي',
  unavailable: 'غير متاح',
}

const allocationStatusColors: Record<string, string> = {
  full: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  unavailable: 'bg-red-100 text-red-700',
}

export function WorkforceAllocationConsole() {
  const [departmentData] = useState<DepartmentAllocation[]>(() => generateMockDepartmentAllocations())
  const [employeeAllocations] = useState<EmployeeAllocation[]>(() => generateMockEmployeeAllocations())
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  const totalHeadcount = departmentData.reduce((s, d) => s + d.headcount, 0)
  const totalBudgeted = departmentData.reduce((s, d) => s + d.budgeted, 0)
  const totalAllocated = departmentData.reduce((s, d) => s + d.allocated, 0)
  const totalAvailable = departmentData.reduce((s, d) => s + d.available, 0)
  const totalVacancies = departmentData.reduce((s, d) => s + d.vacancies, 0)
  const totalUtilization = totalHeadcount > 0 ? Math.round((totalAllocated / totalHeadcount) * 100) : 0

  const selectedDept = useMemo(() => {
    if (!selectedDeptId) return null
    return departmentData.find((d) => d.id === selectedDeptId) ?? null
  }, [selectedDeptId, departmentData])

  const selectedEmployee = useMemo(() => {
    if (!selectedEmpId) return null
    return employeeAllocations.find((e) => e.id === selectedEmpId) ?? null
  }, [selectedEmpId, employeeAllocations])

  const filteredEmployees = useMemo(() => {
    let result = [...employeeAllocations]
    if (selectedDept) {
      result = result.filter((e) => e.department === selectedDept.name)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) => e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
    }
    return result
  }, [employeeAllocations, selectedDept, searchQuery])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'headcount', label: 'إجمالي القوى العاملة', value: totalHeadcount, icon: 'Users', severity: 'info' },
    { id: 'allocated', label: 'مخصص', value: totalAllocated, icon: 'CheckCircle2', severity: 'success', change: 5, trend: 'up' },
    { id: 'available', label: 'متاح', value: totalAvailable, icon: 'Users', severity: 'info' },
    { id: 'vacancies', label: 'شواغر', value: totalVacancies, icon: 'AlertTriangle', severity: totalVacancies > 0 ? 'warning' : 'success' },
    { id: 'utilization', label: 'نسبة الاستغلال', value: totalUtilization+'%', icon: 'Percent', severity: totalUtilization > 90 ? 'warning' : totalUtilization > 70 ? 'info' : 'critical' },
  ], [totalHeadcount, totalAllocated, totalAvailable, totalVacancies, totalUtilization])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'assign', label: 'تعيين موظف', type: 'primary', icon: 'Plus', handler: () => {} },
    { id: 'transfer', label: 'نقل موظف', type: 'secondary', icon: 'ArrowRight', handler: () => {} },
    { id: 'vacancy', label: 'شاغر جديد', type: 'secondary', icon: 'Plus', handler: () => {} },
    { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
  ], [])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'معلومات التخصيص', icon: 'info' },
    { id: 'skills', label: 'المهارات', icon: 'file' },
    { id: 'projects', label: 'المشاريع', icon: 'alert' },
    { id: 'comments', label: 'تعليقات', icon: 'message', badge: comments.filter((c) => !c.resolved).length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
  ], [comments])

  return (
    <WorkbenchShell
      title="كونسول تخصيص القوى العاملة"
      description="إدارة توزيع الموظفين وتخصيص الموارد حسب الإدارات والمشاريع"
      breadcrumbs={[
        { label: 'الرئيسية', icon: Home },
        { label: 'الرواتب', icon: Banknote },
        { label: 'تخصيص القوى العاملة', icon: Briefcase },
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
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
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
                    <p className="text-xs text-muted-foreground">{selectedEmployee.employeeId}</p>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium mr-auto', allocationStatusColors[selectedEmployee.availability])}>
                    {allocationStatusLabels[selectedEmployee.availability]}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">التخصيص الحالي</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">القسم</p>
                    <p className="font-medium">{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">المسمى الوظيفي</p>
                    <p className="font-medium">{selectedEmployee.role}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">المشروع</p>
                    <p className="font-medium">{selectedEmployee.project}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="text-sm font-semibold">نسبة الاستغلال</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', selectedEmployee.utilizationPercent > 80 ? 'bg-green-500' : selectedEmployee.utilizationPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: selectedEmployee.utilizationPercent+'%' }} />
                    </div>
                  </div>
                  <span className={cn('text-lg font-bold', selectedEmployee.utilizationPercent > 80 ? 'text-green-600' : selectedEmployee.utilizationPercent > 40 ? 'text-amber-600' : 'text-red-600')}>{selectedEmployee.utilizationPercent}%</span>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">المهارات</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployee.skills.map((skill) => (
                    <span key={skill} className="px-2 py-1 rounded-md bg-primary/5 text-primary text-xs font-medium">{skill}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">تاريخ التعيين</h4>
                <p className="text-sm">{new Date(selectedEmployee.startDate).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>
          ) : inspectorTab === 'skills' ? (
            <div className="space-y-4" dir="rtl">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">المهارات المسجلة</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.skills.map((skill) => (
                    <span key={skill} className="px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-sm font-medium">{skill}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الفجوات المهارية</h4>
                <p className="text-xs text-muted-foreground">لا توجد فجوات مهارية محددة</p>
              </div>
            </div>
          ) : inspectorTab === 'projects' ? (
            <div className="space-y-4" dir="rtl">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">المشاريع الحالية</h4>
                <div className="p-3 rounded-lg bg-primary/5">
                  <p className="text-sm font-medium">{selectedEmployee.project}</p>
                  <p className="text-xs text-muted-foreground mt-1">المشروع الرئيسي</p>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">المشاريع السابقة</h4>
                <p className="text-xs text-muted-foreground">لا توجد مشاريع سابقة</p>
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
        <RealtimeValidationBar messages={validationMessages} onDismiss={(id) => {}} />
      }
      aiPanel={
        <AIAssistancePanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} domain="payroll" insights={aiInsights} />
      }
      sidebar={
        <div className="flex flex-col h-full" dir="rtl">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث عن موظف..." className="flex h-10 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا يوجد موظفون</p>
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <button key={emp.id} type="button" onClick={() => { setSelectedEmpId(emp.id); setInspectorOpen(true) }} className={cn('w-full text-right p-3 hover:bg-muted/30 transition-colors', selectedEmpId === emp.id && 'bg-primary/5 border-r-2 border-primary')}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{emp.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                    </div>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', allocationStatusColors[emp.availability])}>{allocationStatusLabels[emp.availability]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground pr-10">
                    <span>{emp.department}</span>
                    <span>|</span>
                    <span>استغلال {emp.utilizationPercent}%</span>
                  </div>
                  <div className="pr-10 mt-1.5">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', emp.utilizationPercent > 80 ? 'bg-green-500' : emp.utilizationPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: emp.utilizationPercent+'%' }} />
                    </div>
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
            <h2 className="text-lg font-bold">توزيع القوى العاملة</h2>
            <p className="text-sm text-muted-foreground mt-1">عرض توزيع الموظفين حسب الإدارات ونسب الاستغلال</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1"><Download className="h-3.5 w-3.5" /> تصدير</Button>
            <Button variant="default" size="sm" className="h-9 text-xs gap-1" onClick={() => setAiPanelOpen(!aiPanelOpen)}><Sparkles className="h-3.5 w-3.5" /> توصيات ذكية</Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {departmentData.map((dept) => {
            const isSelected = selectedDeptId === dept.id
            return (
              <button key={dept.id} type="button" onClick={() => setSelectedDeptId(isSelected ? null : dept.id)} className={cn('rounded-xl border bg-card p-4 text-right hover:shadow-md transition-all', isSelected && 'ring-2 ring-primary')}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">{dept.name}</h4>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', dept.utilizationPercent > 80 ? 'bg-green-100 text-green-700' : dept.utilizationPercent > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{dept.utilizationPercent}%</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.headcount}</span>
                  <span>{dept.budgeted} ميزانية</span>
                  <span className={dept.vacancies > 0 ? 'text-amber-600' : 'text-green-600'}>{dept.vacancies} شاغر</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', dept.utilizationPercent > 80 ? 'bg-green-500' : dept.utilizationPercent > 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: dept.utilizationPercent+'%' }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{dept.allocated} مخصص</span>
                  <span>{dept.utilizationPercent}%</span>
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex-1 rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">الموظفون</h3>
              <span className="text-xs text-muted-foreground">({filteredEmployees.length} موظف)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"><Filter className="h-3.5 w-3.5" /> تصفية</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الموظف</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">القسم</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">المسمى الوظيفي</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">المشروع</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الاستغلال</th>
                  <th className="text-right py-3 px-4 font-medium text-xs text-muted-foreground">الحالة</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">لا يوجد موظفون مخصصون</td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp, idx) => (
                    <tr key={emp.id} className={cn('border-b last:border-b-0 hover:bg-muted/20 transition-colors', idx % 2 === 0 && 'bg-muted/5')}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{emp.name[0]}</div>
                          <div>
                            <p className="text-sm font-medium">{emp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{emp.department}</td>
                      <td className="py-3 px-4 text-xs">{emp.role}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{emp.project}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', emp.utilizationPercent > 80 ? 'bg-green-500' : emp.utilizationPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: emp.utilizationPercent+'%' }} />
                          </div>
                          <span className={cn('text-xs font-medium', emp.utilizationPercent > 80 ? 'text-green-600' : emp.utilizationPercent > 40 ? 'text-amber-600' : 'text-red-600')}>{emp.utilizationPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', allocationStatusColors[emp.availability])}>{allocationStatusLabels[emp.availability]}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-xs text-muted-foreground">عرض 1-{filteredEmployees.length} من {employeeAllocations.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled>السابق</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">التالي</Button>
            </div>
          </div>
        </div>
      </div>
      <AuditOverlay entries={auditEntries} open={auditOpen} onClose={() => setAuditOpen(false)} entityId={selectedDeptId ?? undefined} entityType="WorkforceAllocation" />
    </WorkbenchShell>
  )
}

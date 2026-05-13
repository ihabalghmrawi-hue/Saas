'use client'
import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ShoppingCart, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Truck, Building2, Package, Box, MapPin, CreditCard, Receipt, Percent, Phone, Mail, Globe } from 'lucide-react'
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
import { generateMockSalesOrders, generateMockCustomers, generateMockInvoices, generateMockInventoryItems, generateMockValidationMessages, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { SalesOrder, Invoice, ValidationMessage, AIInsight, AuditTrailEntry, OperationalComment, InspectorTab, WorkbenchMetric, WorkbenchAction } from '@/lib/workbench/types'

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

interface CustomerProfile {
  id: string
  name: string
  code: string
  contactPerson: string
  phone: string
  email: string
  balance: number
  creditLimit: number
  paymentTerms: string
  status: string
  category: string
  totalOrders: number
  totalAmount: number
  lastOrderDate: number
  aging: {
    current: number
    '1-30': number
    '31-60': number
    '61-90': number
    '90+': number
  }
}

function generateMockCustomerProfiles(): CustomerProfile[] {
  const names = [
    'شركة الأمل للتجارة', 'مؤسسة النور للمقاولات', 'شركة الفيصلية للاستثمار',
    'مجموعة السلام التجارية', 'شركة الوادي الأخضر', 'مؤسسة البحرين للتجارة',
    'شركة الجزيرة للسياحة', 'مصنع الرياض للأغذية',
  ]
  return names.map((name, idx) => ({
    id: `cust-${idx}`,
    name,
    code: `CUST-${String(100 + idx)}`,
    contactPerson: ['أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله', 'ماجد الحربي'][idx % 5],
    phone: `05${String(Math.floor(10000000 + Math.random() * 89999999))}`,
    email: `info@${name.replace(/\s/g, '')}.com`,
    balance: Math.round(Math.random() * 300000 * 100) / 100,
    creditLimit: Math.round((100000 + Math.random() * 900000) * 100) / 100,
    paymentTerms: ['نقداً', '30 يوم', '60 يوم'][idx % 3],
    status: ['نشط', 'نشط', 'نشط', 'متوقف'][idx % 4],
    category: ['شركة', 'مؤسسة', 'فرد'][idx % 3],
    totalOrders: Math.floor(5 + Math.random() * 75),
    totalAmount: Math.round((100000 + Math.random() * 2900000) * 100) / 100,
    lastOrderDate: Date.now() - Math.floor(Math.random() * 30) * 86400000,
    aging: {
      current: Math.round(Math.random() * 50000 * 100) / 100,
      '1-30': Math.round(Math.random() * 30000 * 100) / 100,
      '31-60': Math.round(Math.random() * 20000 * 100) / 100,
      '61-90': Math.round(Math.random() * 10000 * 100) / 100,
      '90+': Math.round(Math.random() * 5000 * 100) / 100,
    },
  }))
}

function generateMockActivityTimeline(): { id: string; type: string; description: string; timestamp: number; actor: string }[] {
  const activities = [
    { type: 'order', description: 'إنشاء أمر مبيعات جديد' },
    { type: 'payment', description: 'تسجيل دفعة نقدية' },
    { type: 'invoice', description: 'إصدار فاتورة' },
    { type: 'note', description: 'إضافة ملاحظة للحساب' },
    { type: 'credit', description: 'تعديل حد الائتمان' },
    { type: 'statement', description: 'إرسال كشف حساب' },
  ]
  return Array.from({ length: 10 }, (_, idx) => {
    const act = activities[idx % activities.length]
    return {
      id: `act-${idx}`,
      type: act.type,
      description: act.description,
      timestamp: Date.now() - idx * 86400000 * 2,
      actor: ['أحمد محمد', 'سارة خالد', 'فهد العتيبي'][idx % 3],
    }
  })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA')
}

function getAgingColor(days: number): string {
  if (days <= 30) return 'text-green-600 bg-green-50'
  if (days <= 60) return 'text-amber-600 bg-amber-50'
  if (days <= 90) return 'text-orange-600 bg-orange-50'
  return 'text-red-600 bg-red-50'
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingCart, payment: DollarSign, invoice: FileText, note: MessageSquare, credit: CreditCard, statement: FileText,
}

export function CustomerAccountWorkbench() {
  const [customers] = useState<CustomerProfile[]>(() => generateMockCustomerProfiles())
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState('overview')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState('info')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [validations] = useState<ValidationMessage[]>(() => generateMockValidationMessages('sales'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('sales'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())
  const [activityTimeline] = useState(() => generateMockActivityTimeline())

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedCustId) ?? null, [customers, selectedCustId])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.phone.includes(q))
  }, [customers, customerSearch])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const active = customers.filter((c) => c.status === 'نشط').length
    const totalAR = customers.reduce((s, c) => s + c.balance, 0)
    const totalCredit = customers.reduce((s, c) => s + c.creditLimit, 0)
    const utilPct = totalCredit > 0 ? Math.round((totalAR / totalCredit) * 100) : 0
    const overdueCustomers = customers.filter((c) => c.aging['90+'] > 0 || c.aging['61-90'] > 0).length
    return [
      { id: 'total', label: 'إجمالي العملاء', value: customers.length, change: 5, trend: 'up', icon: 'Users', severity: 'info' },
      { id: 'active', label: 'نشط', value: active, change: 3, trend: 'up', icon: 'CheckCircle2', severity: 'success' },
      { id: 'total_ar', label: 'إجمالي الذمم', value: formatCurrency(totalAR), icon: 'DollarSign', severity: 'info' },
      { id: 'utilization', label: 'نسبة استخدام الائتمان', value: `${utilPct}%`, change: 2, trend: 'up', icon: 'Percent', severity: utilPct > 80 ? 'critical' : 'info' },
    ]
  }, [customers])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'معلومات العميل', icon: 'info' },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
    { id: 'message', label: 'التعليقات', icon: 'message', badge: comments.length },
  ], [comments])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'new-customer', label: 'عميل جديد', type: 'primary', icon: 'Plus', handler: () => {} },
    { id: 'refresh', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
  ], [])

  const creditUtilPct = selectedCustomer ? Math.round((selectedCustomer.balance / selectedCustomer.creditLimit) * 100) : 0
  const totalAging = selectedCustomer
    ? Object.values(selectedCustomer.aging).reduce((s, v) => s + v, 0)
    : 0

  const detailTabs = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'orders', label: 'الطلبات' },
    { key: 'invoices', label: 'الفواتير' },
    { key: 'payments', label: 'المدفوعات' },
    { key: 'aging', label: 'التحليل العمري' },
  ]

  return (
    <WorkbenchShell
      title="حسابات العملاء"
      description="إدارة حسابات العملاء ومتابعة الأرصدة والأنشطة"
      breadcrumbs={[{ label: 'المبيعات', icon: ShoppingCart }, { label: 'حسابات العملاء' }]}
      metrics={metrics}
      actions={actions}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={activeInspectorTab}
      onInspectorTabChange={setActiveInspectorTab}
      inspectorContent={selectedCustomer ? (
        <>
          {activeInspectorTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">معلومات الاتصال</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span>{selectedCustomer.contactPerson}</span></div>
                  <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{selectedCustomer.phone}</span></div>
                  <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-blue-600">{selectedCustomer.email}</span></div>
                  <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-muted-foreground" /><span>{selectedCustomer.category}</span></div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">البيانات المالية</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">الرصيد الحالي</span><span className="font-bold">{formatCurrency(selectedCustomer.balance)} ر.س</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الحد الائتماني</span><span className="font-bold">{formatCurrency(selectedCustomer.creditLimit)} ر.س</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">نسبة الاستخدام</span><span className={cn('font-bold', creditUtilPct > 80 ? 'text-red-600' : creditUtilPct > 60 ? 'text-amber-600' : 'text-green-600')}>{creditUtilPct}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">شروط الدفع</span><span className="font-medium">{selectedCustomer.paymentTerms}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', creditUtilPct > 80 ? 'bg-red-500' : creditUtilPct > 60 ? 'bg-amber-500' : 'bg-green-500')} style={{ width: `${Math.min(creditUtilPct, 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الإجراءات</h4>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1"><ShoppingCart className="h-3.5 w-3.5" />طلب جديد</Button>
                  <Button size="sm" variant="secondary" className="gap-1"><DollarSign className="h-3.5 w-3.5" />تسجيل دفعة</Button>
                  <Button size="sm" variant="secondary" className="gap-1"><CreditCard className="h-3.5 w-3.5" />تعديل الحد الائتماني</Button>
                  <Button size="sm" variant="secondary" className="gap-1"><Send className="h-3.5 w-3.5" />إرسال كشف حساب</Button>
                  <Button size="sm" variant="ghost" className="gap-1"><MessageSquare className="h-3.5 w-3.5" />إضافة ملاحظة</Button>
                </div>
              </div>
            </div>
          )}
          {activeInspectorTab === 'activity' && (
            <div className="space-y-3">
              {activityTimeline.slice(0, 8).map((act) => {
                const Icon = activityIcons[act.type] || Clock
                return (
                  <div key={act.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                    <div className="p-1.5 rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{act.description}</p>
                      <p className="text-xs text-muted-foreground">{act.actor} - {formatDate(act.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {activeInspectorTab === 'message' && (<OperationalCommenting comments={comments} />)}
        </>
      ) : null}
      validationBar={<RealtimeValidationBar messages={validations} />}
      aiPanel={<AIAssistancePanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} domain="sales" entityId={selectedCustId ?? undefined} insights={aiInsights} />}
      className="rtl"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b bg-card px-6 py-3 shrink-0">
          <div className="relative" dir="rtl">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true) }}
                onFocus={() => setCustomerDropdownOpen(true)}
                placeholder="ابحث عن عميل بالاسم أو الرمز..."
                className="flex h-10 w-full rounded-xl border border-input bg-background pr-10 pl-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {customerDropdownOpen && filteredCustomers.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-xl shadow-lg z-50 max-h-[300px] overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn('flex items-center gap-3 w-full px-4 py-3 text-right hover:bg-muted/50 transition-colors border-b last:border-b-0', c.id === selectedCustId && 'bg-primary/5')}
                    onClick={() => { setSelectedCustId(c.id); setCustomerDropdownOpen(false); setCustomerSearch('') }}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">{c.name[0]}</div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.code} | {c.phone}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(c.balance)}</p>
                      <p className="text-[10px] text-muted-foreground">ر.س</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {customerDropdownOpen && filteredCustomers.length === 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-xl shadow-lg z-50 p-8 text-center">
                <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد عميل بهذا الاسم</p>
              </div>
            )}
          </div>
        </div>

        {!selectedCustomer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Building2 className="h-20 w-20 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-semibold mb-2">مرحباً بك في حسابات العملاء</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">ابحث عن عميل من شريط البحث أعلاه لعرض ملفه الكامل وإدارة حسابه</p>
            <Button className="gap-2"><Plus className="h-4 w-4" />إضافة عميل جديد</Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-6">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">{selectedCustomer.name[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', selectedCustomer.status === 'نشط' ? 'text-green-600 bg-green-50 border border-green-200' : 'text-gray-600 bg-gray-100 border border-gray-300')}>{selectedCustomer.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedCustomer.contactPerson}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedCustomer.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selectedCustomer.email}</span>
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />رمز: {selectedCustomer.code}</span>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-2xl font-bold">{formatCurrency(selectedCustomer.balance)}</p>
                  <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                  <p className="text-xs mt-1">الحد الائتماني: <span className="font-semibold">{formatCurrency(selectedCustomer.creditLimit)}</span></p>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">استخدام الائتمان</h4>
                  <span className={cn('text-xs font-bold', creditUtilPct > 80 ? 'text-red-600' : creditUtilPct > 60 ? 'text-amber-600' : 'text-green-600')}>{creditUtilPct}%</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', creditUtilPct > 80 ? 'bg-red-500' : creditUtilPct > 60 ? 'bg-amber-500' : 'bg-green-500')} style={{ width: `${Math.min(creditUtilPct, 100)}%` }} />
                </div>
              </div>

              <div className="flex gap-1 border-b overflow-x-auto">
                {detailTabs.map((tab) => (
                  <button key={tab.key} type="button" onClick={() => setActiveDetailTab(tab.key)} className={cn('px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors', activeDetailTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab.label}</button>
                ))}
              </div>

              {activeDetailTab === 'overview' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4">
                    <h4 className="text-sm font-semibold mb-3">معلومات العميل</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">التصنيف</span><span>{selectedCustomer.category}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">شروط الدفع</span><span>{selectedCustomer.paymentTerms}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الطلبات</span><span>{selectedCustomer.totalOrders}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المبيعات</span><span>{formatCurrency(selectedCustomer.totalAmount)} ر.س</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">آخر طلب</span><span>{formatDate(selectedCustomer.lastOrderDate)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <h4 className="text-sm font-semibold mb-3">التحليل العمري للذمم</h4>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'حالي', key: 'current' as const, days: 0 },
                        { label: '1-30 يوم', key: '1-30' as const, days: 30 },
                        { label: '31-60 يوم', key: '31-60' as const, days: 60 },
                        { label: '61-90 يوم', key: '61-90' as const, days: 90 },
                        { label: 'أكثر من 90 يوم', key: '90+' as const, days: 91 },
                      ].map((bucket) => (
                        <div key={bucket.key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', getAgingColor(bucket.days).split(' ')[0].replace('text-', 'bg-'))} />
                            <span className="text-muted-foreground">{bucket.label}</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(selectedCustomer.aging[bucket.key])}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>الإجمالي</span>
                        <span>{formatCurrency(totalAging)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-xl border p-4">
                    <h4 className="text-sm font-semibold mb-3">آخر الأنشطة</h4>
                    <div className="space-y-2">
                      {activityTimeline.slice(0, 5).map((act) => {
                        const Icon = activityIcons[act.type] || Clock
                        return (
                          <div key={act.id} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                            <div className="p-1.5 rounded-lg bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                            <div className="flex-1">
                              <p className="text-sm">{act.description}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(act.timestamp)} - {act.actor}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'orders' && (
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">سجل الطلبات</h4>
                  <div className="space-y-2">
                    {generateMockSalesOrders(5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-medium">{order.number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.date)} | {order.items.length} أصناف</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{formatCurrency(order.amount)} ر.س</p>
                          <span className="text-[10px] text-muted-foreground">{order.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailTab === 'invoices' && (
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">الفواتير</h4>
                  <div className="space-y-2">
                    {generateMockInvoices(5, 'receivable').map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-medium">{inv.number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(inv.date)} | استحقاق: {formatDate(inv.dueDate)}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{formatCurrency(inv.amount)} ر.س</p>
                          <span className={cn('text-[10px]', inv.status === 'paid' ? 'text-green-600' : inv.status === 'overdue' ? 'text-red-600' : 'text-amber-600')}>{inv.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailTab === 'payments' && (
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">المدفوعات</h4>
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-medium">دفعة رقم {String(i + 1).padStart(3, '0')}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(Date.now() - i * 86400000 * 15)} | {randomChoice(['نقداً', 'تحويل بنكي', 'شيك'])}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-green-600">{formatCurrency(Math.random() * 50000)} ر.س</p>
                          <span className="text-[10px] text-green-600">مدفوع</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailTab === 'aging' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4 col-span-2">
                    <h4 className="text-sm font-semibold mb-3">توزيع الذمم العمرية</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'حالي', key: 'current' as const, days: 0 },
                        { label: '1-30 يوم', key: '1-30' as const, days: 30 },
                        { label: '31-60 يوم', key: '31-60' as const, days: 60 },
                        { label: '61-90 يوم', key: '61-90' as const, days: 90 },
                        { label: 'أكثر من 90 يوم', key: '90+' as const, days: 91 },
                      ].map((bucket) => {
                        const amount = selectedCustomer.aging[bucket.key]
                        const pct = totalAging > 0 ? (amount / totalAging) * 100 : 0
                        return (
                          <div key={bucket.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">{bucket.label}</span>
                              <span className="font-semibold">{formatCurrency(amount)}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', getAgingColor(bucket.days).split(' ')[0].replace('text-', 'bg-'))} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AuditOverlay entries={auditEntries} open={auditOpen} onClose={() => setAuditOpen(false)} entityId={selectedCustId ?? undefined} entityType="حساب عميل" />
    </WorkbenchShell>
  )
}

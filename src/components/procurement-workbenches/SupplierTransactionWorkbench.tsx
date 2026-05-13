'use client'
import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ShoppingCart, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Truck, Building2, Package, ClipboardCheck, Percent, Scale, Users, Box } from 'lucide-react'
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
import { generateMockPurchaseOrders, generateMockSuppliers, generateMockInvoices, generateMockInventoryItems, generateMockValidationMessages, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { PurchaseOrder, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface SupplierData {
  id: string
  name: string
  code: string
  contactPerson: string
  phone: string
  email: string
  balance: number
  paymentTerms: string
  status: string
  category: string
  totalOrders: number
  totalAmount: number
  lastOrderDate: number
  creditLimit?: number
}

interface Interaction {
  id: string
  date: number
  type: string
  reference: string
  amount: number
  status: string
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const defaultSuppliers: SupplierData[] = [
  { id: 'sup-1', name: 'مؤسسة البناء الحديث', code: 'SUP-101', contactPerson: 'أحمد محمد', phone: '0555123456', email: 'info@albinamodern.com', balance: 125000, paymentTerms: '30 يوم', status: 'نشط', category: 'مواد خام', totalOrders: 45, totalAmount: 2850000, lastOrderDate: Date.now() - 3 * 86400000, creditLimit: 500000 },
  { id: 'sup-2', name: 'شركة التوريدات الصناعية', code: 'SUP-102', contactPerson: 'سارة خالد', phone: '0555234567', email: 'info@altawreedat.com', balance: 85000, paymentTerms: '60 يوم', status: 'نشط', category: 'معدات', totalOrders: 32, totalAmount: 1920000, lastOrderDate: Date.now() - 7 * 86400000, creditLimit: 350000 },
  { id: 'sup-3', name: 'مصنع الرياض للحديد', code: 'SUP-103', contactPerson: 'فهد العتيبي', phone: '0555345678', email: 'info@riyadhsteel.com', balance: 220000, paymentTerms: 'نقداً', status: 'نشط', category: 'مواد خام', totalOrders: 78, totalAmount: 5200000, lastOrderDate: Date.now() - 1 * 86400000, creditLimit: 800000 },
  { id: 'sup-4', name: 'شركة الخليج للخدمات', code: 'SUP-104', contactPerson: 'نورة عبدالله', phone: '0555456789', email: 'info@alkhaleej.com', balance: -15000, paymentTerms: '30 يوم', status: 'نشط', category: 'خدمات', totalOrders: 18, totalAmount: 650000, lastOrderDate: Date.now() - 15 * 86400000, creditLimit: 200000 },
  { id: 'sup-5', name: 'مجموعة الفهد التجارية', code: 'SUP-105', contactPerson: 'ماجد الحربي', phone: '0555567890', email: 'info@alfahad.com', balance: 45000, paymentTerms: '90 يوم', status: 'غير نشط', category: 'صيانة', totalOrders: 12, totalAmount: 380000, lastOrderDate: Date.now() - 60 * 86400000, creditLimit: 150000 },
  { id: 'sup-6', name: 'مؤسسة الجزيرة للتجارة', code: 'SUP-106', contactPerson: 'ريم الشهري', phone: '0555678901', email: 'info@aljazeera.com', balance: 95000, paymentTerms: '30 يوم', status: 'نشط', category: 'مواد خام', totalOrders: 55, totalAmount: 3150000, lastOrderDate: Date.now() - 2 * 86400000, creditLimit: 400000 },
  { id: 'sup-7', name: 'شركة الواحة للإمدادات', code: 'SUP-107', contactPerson: 'خالد الزهراني', phone: '0555789012', email: 'info@alwaha.com', balance: 18000, paymentTerms: '60 يوم', status: 'نشط', category: 'تجهيزات', totalOrders: 28, totalAmount: 1100000, lastOrderDate: Date.now() - 10 * 86400000, creditLimit: 250000 },
  { id: 'sup-8', name: 'الشركة السعودية للطاقة', code: 'SUP-108', contactPerson: 'ناصر القحطاني', phone: '0555890123', email: 'info@saudienergy.com', balance: 310000, paymentTerms: 'نقداً', status: 'نشط', category: 'خدمات', totalOrders: 65, totalAmount: 4500000, lastOrderDate: Date.now() - 5 * 86400000, creditLimit: 600000 },
  { id: 'sup-9', name: 'مصنع الشرق للبلاستيك', code: 'SUP-109', contactPerson: 'عبدالله الدوسري', phone: '0555901234', email: 'info@sharqplastic.com', balance: 52000, paymentTerms: '30 يوم', status: 'غير نشط', category: 'مواد خام', totalOrders: 22, totalAmount: 890000, lastOrderDate: Date.now() - 90 * 86400000, creditLimit: 300000 },
  { id: 'sup-10', name: 'شركة البحر الأحمر للتجهيزات', code: 'SUP-110', contactPerson: 'محمد الغامدي', phone: '0555012345', email: 'info@redsea.com', balance: 76000, paymentTerms: '60 يوم', status: 'نشط', category: 'معدات', totalOrders: 38, totalAmount: 2100000, lastOrderDate: Date.now() - 8 * 86400000, creditLimit: 350000 },
]

function generateSupplierInteractions(supplierName: string, count: number): Interaction[] {
  const types = ['أمر شراء', 'فاتورة', 'دفعة', 'مرتجع']
  const statuses = ['مكتمل', 'معلق', 'قيد المعالجة']
  return Array.from({ length: count }, (_, i) => ({
    id: `int-${i}`,
    date: Date.now() - i * 5 * 86400000,
    type: types[i % types.length],
    reference: `${types[i % types.length] === 'أمر شراء' ? 'PO' : types[i % types.length] === 'فاتورة' ? 'INV' : types[i % types.length] === 'دفعة' ? 'PMT' : 'RTN'}-${String(1000 + i).padStart(4, '0')}`,
    amount: Math.random() * 150000 + 5000,
    status: statuses[Math.floor(Math.random() * statuses.length)],
  }))
}

const statusStyle: Record<string, string> = {
  'نشط': 'text-green-600 bg-green-50 border-green-200',
  'غير نشط': 'text-gray-600 bg-gray-100 border-gray-200',
  'متوقف': 'text-red-600 bg-red-50 border-red-200',
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const colors = statusStyle[status] ?? 'text-gray-600 bg-gray-100'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', colors, className)}>
      {status}
    </span>
  )
}

const transactionTabs = ['أوامر شراء', 'فواتير', 'مدفوعات', 'مرتجعات']

export function SupplierTransactionWorkbench() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTransTab, setActiveTransTab] = useState('أوامر شراء')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [validationDismissed, setValidationDismissed] = useState<Record<string, boolean>>({})
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const allSuppliers = defaultSuppliers
  const allPOs = useMemo(() => generateMockPurchaseOrders(15), [])
  const allInvoices = useMemo(() => generateMockInvoices(15, 'payable'), [])
  const allMockMessages = useMemo(() => generateMockValidationMessages('procurement'), [])
  const allAIInsights = useMemo(() => generateMockAIInsights('procurement'), [])
  const allAuditEntries = useMemo(() => generateMockAuditTrail(), [])
  const allComments = useMemo(() => generateMockOperationalComments(), [])

  const activeSuppliers = allSuppliers.filter((s) => s.status === 'نشط').length
  const totalPurchases = allSuppliers.reduce((sum, s) => sum + s.totalAmount, 0)
  const avgCreditDays = allSuppliers.reduce((sum, s) => {
    const days = s.paymentTerms === 'نقداً' ? 0 : s.paymentTerms === '30 يوم' ? 30 : s.paymentTerms === '60 يوم' ? 60 : 90
    return sum + days
  }, 0) / allSuppliers.length

  const metrics: WorkbenchMetric[] = [
    { id: 'm1', label: 'عدد الموردين', value: allSuppliers.length, icon: 'Users', severity: 'info' },
    { id: 'm2', label: 'موردين نشطين', value: activeSuppliers, icon: 'Users', severity: 'success' },
    { id: 'm3', label: 'إجمالي المشتريات', value: formatCurrency(totalPurchases), icon: 'DollarSign', severity: 'info' },
    { id: 'm4', label: 'متوسط أيام الائتمان', value: Math.round(avgCreditDays), icon: 'Clock', severity: 'info' },
  ]

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return allSuppliers
    const q = searchQuery.toLowerCase()
    return allSuppliers.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
  }, [allSuppliers, searchQuery])

  const selectedSupplier = useMemo(() => {
    if (!selectedId) return null
    return allSuppliers.find((s) => s.id === selectedId) ?? null
  }, [selectedId, allSuppliers])

  const supplierTransactions = useMemo(() => {
    if (!selectedSupplier) return []
    return generateSupplierInteractions(selectedSupplier.name, 12)
  }, [selectedSupplier])

  const activeMessages = allMockMessages.filter((m) => !validationDismissed[m.id])

  const handleDismissValidation = useCallback((id: string) => {
    setValidationDismissed((prev) => ({ ...prev, [id]: true }))
  }, [])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'تحليل التقادم', icon: 'info' },
    { id: 'activity', label: 'سجل المشتريات', icon: 'activity' },
    { id: 'file', label: 'تفاصيل العقد', icon: 'file' },
  ]

  function getTabContent(tab: string) {
    switch (tab) {
      case 'info':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">تحليل التقادم</h4>
            {[
              { label: 'حالي', amount: 45000, color: 'bg-green-500' },
              { label: '1-30 يوم', amount: 28000, color: 'bg-blue-500' },
              { label: '31-60 يوم', amount: 15000, color: 'bg-amber-500' },
              { label: '61-90 يوم', amount: 8000, color: 'bg-orange-500' },
              { label: 'أكثر من 90 يوم', amount: 3000, color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-2 rounded-lg">
                <div className={cn('h-2.5 w-2.5 rounded-full', item.color)} />
                <span className="text-sm flex-1">{item.label}</span>
                <span className="text-sm font-medium">{item.amount.toLocaleString('ar-SA')} ريال</span>
              </div>
            ))}
            {selectedSupplier && (
              <div className="rounded-lg border bg-card p-4 mt-3">
                <p className="text-sm text-muted-foreground">الرصيد الحالي: <span className="font-medium text-foreground">{formatCurrency(selectedSupplier.balance)} ريال</span></p>
              </div>
            )}
          </div>
        )
      case 'activity':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">سجل المشتريات</h4>
            {allPOs.slice(0, 6).map((po) => (
              <div key={po.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{po.number}</p>
                  <p className="text-xs text-muted-foreground">{po.supplier}</p>
                </div>
                <span className="text-sm font-medium">{formatCurrency(po.amount)} ريال</span>
              </div>
            ))}
          </div>
        )
      case 'file':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">تفاصيل العقد</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">نوع العقد</span>
                  <span className="font-medium">توريد سنوي</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">قيمة العقد</span>
                  <span className="font-medium">{formatCurrency(250000)} ريال</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">تاريخ البدء</span>
                  <span className="font-medium">{formatDate(Date.now() - 120 * 86400000)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">تاريخ الانتهاء</span>
                  <span className="font-medium">{formatDate(Date.now() + 245 * 86400000)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <WorkbenchShell
      title="منصة معاملات الموردين"
      description="إدارة الموردين والمعاملات المرتبطة بهم"
      breadcrumbs={[
        { label: 'المشتريات' },
        { label: 'الموردين' },
      ]}
      metrics={metrics}
      actions={[
        { id: 'a1', label: 'إنشاء أمر شراء', type: 'primary', icon: 'Plus', handler: () => {} },
        { id: 'a2', label: 'تسجيل فاتورة', type: 'secondary', icon: 'FileText', handler: () => {} },
        { id: 'a3', label: 'معالجة دفعة', type: 'secondary', icon: 'DollarSign', handler: () => {} },
        { id: 'a4', label: 'إضافة ملاحظة', type: 'ghost', icon: 'MessageSquare', handler: () => {} },
        { id: 'a5', label: 'المساعد الذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorContent={getTabContent(inspectorTab)}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      validationBar={
        <RealtimeValidationBar
          messages={activeMessages}
          onDismiss={handleDismissValidation}
        />
      }
      aiPanel={
        aiOpen && (
          <div className="fixed inset-y-0 left-0 z-40 w-[420px] border-l shadow-xl bg-background">
            <AIAssistancePanel
              open={true}
              onClose={() => setAiOpen(false)}
              domain="procurement"
              insights={allAIInsights}
            />
          </div>
        )
      }
    >
      <div className="flex h-full" dir="rtl">
        <div className="w-[420px] border-l flex flex-col shrink-0 bg-card">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن مورد..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">عند عدم وجود بيانات</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setSearchQuery('')}>
                  إعادة تعيين التصفية
                </Button>
              </div>
            ) : (
              filteredSuppliers.map((supplier) => {
                const isSelected = supplier.id === selectedId
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => setSelectedId(supplier.id)}
                    className={cn(
                      'w-full text-right p-4 border-b hover:bg-muted/30 transition-colors',
                      isSelected && 'bg-primary/5 border-r-2 border-r-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{supplier.name}</span>
                      <StatusBadge status={supplier.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span>رمز: {supplier.code}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(
                        'font-medium',
                        supplier.balance < 0 ? 'text-red-600' : 'text-green-600',
                      )}>
                        {formatCurrency(supplier.balance)} ريال
                      </span>
                      <span className="text-xs text-muted-foreground">الرصيد المفتوح</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedSupplier ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">اختر مورداً من القائمة</p>
              <p className="text-sm text-muted-foreground mt-1">لعرض التفاصيل والمعاملات</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedSupplier.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedSupplier.code}</p>
                    </div>
                  </div>
                  <StatusBadge status={selectedSupplier.status} className="text-sm px-3 py-1" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground text-xs">جهة الاتصال</span>
                    <p className="font-medium mt-1 flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedSupplier.contactPerson}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground text-xs">رقم الجوال</span>
                    <p className="font-medium mt-1" dir="ltr">{selectedSupplier.phone}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground text-xs">البريد الإلكتروني</span>
                    <p className="font-medium mt-1 text-xs">{selectedSupplier.email}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground text-xs">شروط الدفع</span>
                    <p className="font-medium mt-1">{selectedSupplier.paymentTerms}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                    <span className="text-xs text-blue-600">الرصيد الحالي</span>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedSupplier.balance)} ريال</p>
                  </div>
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                    <span className="text-xs text-green-600">الحد الائتماني</span>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(selectedSupplier.creditLimit ?? 0)} ريال</p>
                  </div>
                </div>
              </div>

              <div className="border-b">
                <div className="flex gap-1">
                  {transactionTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTransTab(tab)}
                      className={cn(
                        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                        activeTransTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المرجع</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">النوع</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">التاريخ</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المبلغ</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">لا توجد معاملات</td>
                        </tr>
                      ) : (
                        supplierTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{tx.reference}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
                                tx.type === 'أمر شراء' ? 'bg-blue-100 text-blue-700' :
                                tx.type === 'فاتورة' ? 'bg-amber-100 text-amber-700' :
                                tx.type === 'دفعة' ? 'bg-green-100 text-green-700' :
                                'bg-purple-100 text-purple-700',
                              )}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(tx.amount)} ريال</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                                tx.status === 'مكتمل' ? 'text-green-600 bg-green-50 border-green-200' :
                                tx.status === 'معلق' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                'text-blue-600 bg-blue-50 border-blue-200',
                              )}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-medium mb-4">مؤشرات أداء المورد</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold text-green-600">98%</div>
                    <div className="text-xs text-muted-foreground mt-1">نسبة التسليم في الوقت المحدد</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold text-blue-600">95%</div>
                    <div className="text-xs text-muted-foreground mt-1">جودة المنتجات</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold text-amber-600">2.5</div>
                    <div className="text-xs text-muted-foreground mt-1">متوسط زمن الاستجابة (أيام)</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">التفاعلات مع المورد</span>
                </div>
                <div className="space-y-0">
                  {supplierTransactions.slice(0, 6).map((tx, i) => (
                    <div key={tx.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'h-3 w-3 rounded-full border-2',
                          tx.status === 'مكتمل' ? 'border-green-500 bg-green-500' :
                          tx.status === 'معلق' ? 'border-amber-500 bg-amber-500' :
                          'border-blue-500 bg-blue-500',
                        )} />
                        {i < 5 && <div className="w-px h-6 bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{tx.reference} - {tx.type}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(tx.amount)} ريال • {formatDate(tx.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4 flex-wrap">
                <Button variant="outline" className="h-9 text-xs gap-1.5"><MessageSquare className="h-4 w-4" />إضافة ملاحظة</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCommentsOpen(!commentsOpen)} title="التعليقات">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setAuditOpen(true)} title="سجل التدقيق">
                  <Shield className="h-4 w-4" />
                </Button>
              </div>

              {commentsOpen && (
                <div className="rounded-xl border bg-card">
                  <OperationalCommenting comments={allComments} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AuditOverlay
        entries={allAuditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedSupplier?.id}
        entityType="مورد"
      />
    </WorkbenchShell>
  )
}

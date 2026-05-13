'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Building2, User, Package, FileText,
  DollarSign, Users, Shield, ArrowRight,
  Activity, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMockInspectorData, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'

export interface CrossEntityInspectorProps {
  entityType: 'customer' | 'supplier' | 'inventory' | 'journal' | 'payroll' | 'approval' | 'workflow'
  entityId: string
  onClose?: () => void
  className?: string
}

const entityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  customer: Building2,
  supplier: Building2,
  inventory: Package,
  journal: FileText,
  payroll: Users,
  approval: Shield,
  workflow: Activity,
}

const entityLabels: Record<string, string> = {
  customer: 'العميل',
  supplier: 'المورد',
  inventory: 'المخزون',
  journal: 'القيد المحاسبي',
  payroll: 'الرواتب',
  approval: 'الموافقات',
  workflow: 'سير العمل',
}

interface TabDef {
  id: string
  label: string
}

const entityTabs: Record<string, TabDef[]> = {
  customer: [
    { id: 'summary', label: 'ملخص' },
    { id: 'transactions', label: 'المعاملات' },
    { id: 'aging', label: 'التقادم' },
    { id: 'documents', label: 'المستندات' },
    { id: 'comments', label: 'التعليقات' },
  ],
  supplier: [
    { id: 'summary', label: 'ملخص' },
    { id: 'purchases', label: 'المشتريات' },
    { id: 'documents', label: 'المستندات' },
    { id: 'comments', label: 'التعليقات' },
  ],
  inventory: [
    { id: 'summary', label: 'ملخص' },
    { id: 'movements', label: 'الحركات' },
    { id: 'reservations', label: 'الحجوزات' },
    { id: 'documents', label: 'المستندات' },
  ],
  journal: [
    { id: 'summary', label: 'ملخص' },
    { id: 'entries', label: 'القيود' },
    { id: 'approvals', label: 'الموافقات' },
    { id: 'comments', label: 'التعليقات' },
  ],
  payroll: [
    { id: 'summary', label: 'ملخص' },
    { id: 'employees', label: 'الموظفين' },
    { id: 'anomalies', label: 'الحالات الشاذة' },
    { id: 'documents', label: 'المستندات' },
  ],
  approval: [
    { id: 'summary', label: 'ملخص' },
    { id: 'history', label: 'السجل' },
    { id: 'sla', label: 'مستوى الخدمة' },
    { id: 'comments', label: 'التعليقات' },
  ],
  workflow: [
    { id: 'summary', label: 'ملخص' },
    { id: 'stages', label: 'المراحل' },
    { id: 'timeline', label: 'الخط الزمني' },
    { id: 'documents', label: 'المستندات' },
  ],
}

function TabContent({ entityType, tab, data }: { entityType: string; tab: string; data: Record<string, unknown> }) {
  switch (tab) {
    case 'summary':
      return (
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-semibold mb-3">نظرة عامة</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(data).slice(0, 8).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b last:border-b-0">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'transactions':
    case 'movements':
    case 'entries':
    case 'purchases':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">آخر المعاملات</h4>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">معاملة #{1000 + i}</p>
                <p className="text-xs text-muted-foreground">{new Date(Date.now() - i * 86400000).toLocaleDateString('ar-SA')}</p>
              </div>
              <span className="text-sm font-medium">{((i + 1) * 1500).toLocaleString('ar-SA')} ريال</span>
            </div>
          ))}
        </div>
      )
    case 'aging':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">تحليل التقادم</h4>
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
        </div>
      )
    case 'documents':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">المستندات المرفقة</h4>
          {generateMockDocuments().map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent transition-colors">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.uploadedBy}</p>
              </div>
            </div>
          ))}
        </div>
      )
    case 'comments':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">التعليقات</h4>
          {generateMockOperationalComments().map((comment) => (
            <div key={comment.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {comment.author[0]}
                </div>
                <span className="text-sm font-medium">{comment.author}</span>
              </div>
              <p className="text-sm text-muted-foreground">{comment.text}</p>
            </div>
          ))}
        </div>
      )
    case 'history':
    case 'stages':
    case 'timeline':
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold mb-2">{tab === 'history' ? 'سجل القرارات' : tab === 'stages' ? 'المراحل' : 'الخط الزمني'}</h4>
          {(data.history as any[])?.map((item: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'h-3 w-3 rounded-full border-2',
                  item?.status === 'مكتملة' ? 'border-green-500 bg-green-500' :
                  item?.status === 'قيد التنفيذ' ? 'border-blue-500 bg-blue-500' :
                  'border-gray-300',
                )} />
                {i < 4 && <div className="w-px h-full bg-border" />}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium">{item?.name || item?.action || `خطوة ${i + 1}`}</p>
                <p className="text-xs text-muted-foreground">{item?.assignee || item?.by}</p>
                <p className="text-xs text-muted-foreground">{item?.completedAt || item?.at}</p>
              </div>
            </div>
          ))}
          {!data.history && Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'h-3 w-3 rounded-full border-2',
                  i < 2 ? 'border-green-500 bg-green-500' :
                  i === 2 ? 'border-blue-500 bg-blue-500' :
                  'border-gray-300',
                )} />
                {i < 3 && <div className="w-px h-full bg-border" />}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium">المرحلة {i + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {i < 2 ? 'مكتملة' : i === 2 ? 'قيد التنفيذ' : 'قادمة'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )
    case 'reservations':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">الحجوزات النشطة</h4>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">حجز #{2000 + i}</p>
                <p className="text-xs text-muted-foreground">الكمية: {(i + 1) * 5}</p>
              </div>
              <span className="text-xs text-amber-600">قيد التنفيذ</span>
            </div>
          ))}
        </div>
      )
    case 'employees':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">الموظفين في هذه الدفعة</h4>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                {['أ', 'س', 'ف', 'ن', 'م'][i]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{['أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله', 'ماجد الحربي'][i]}</p>
                <p className="text-xs text-muted-foreground">{['المالية', 'المشتريات', 'المبيعات', 'الموارد البشرية', 'تكنولوجيا المعلومات'][i]}</p>
              </div>
              <span className="text-sm font-medium">{((i + 1) * 5000).toLocaleString('ar-SA')} ريال</span>
            </div>
          ))}
        </div>
      )
    case 'anomalies':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2 text-amber-600">الحالات الشاذة</h4>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">حالة شاذة #{i + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {i === 0 ? 'اختلاف في الراتب الأساسي' : 'بدلات غير متوقعة'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )
    case 'sla':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">مستوى الخدمة</h4>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>الوقت المنقضي</span>
                <span>12 ساعة</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>الوقت المتبقي</span>
                <span>8 ساعات</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>الموعد النهائي</span>
                <span>{new Date(Date.now() + 8 * 3600000).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          </div>
        </div>
      )
    case 'approvals':
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-2">سجل الموافقات</h4>
          {['تمت الموافقة', 'بإنتظار المراجعة', 'تم الرفض'].map((status, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              {i === 0 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : i === 1 ? <Activity className="h-4 w-4 text-amber-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
              <div className="flex-1">
                <p className="text-sm">{status}</p>
                <p className="text-xs text-muted-foreground">{['أحمد محمد', 'سارة خالد', 'فهد العتيبي'][i]}</p>
              </div>
            </div>
          ))}
        </div>
      )
    default:
      return <p className="text-sm text-muted-foreground">محتوى غير متاح</p>
  }
}

export function CrossEntityInspector({
  entityType,
  entityId,
  onClose,
  className,
}: CrossEntityInspectorProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const data = generateMockInspectorData(entityType)
  const EntityIcon = entityIcons[entityType]
  const tabs = entityTabs[entityType] || []

  return (
    <div className={cn('flex flex-col h-full bg-background border rounded-xl', className)} dir="rtl">
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          {EntityIcon && <EntityIcon className="h-5 w-5 text-primary" />}
          <h3 className="font-semibold text-sm">{entityLabels[entityType]}</h3>
          <span className="text-xs text-muted-foreground">#{entityId.slice(0, 8)}</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex border-b overflow-x-auto shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <TabContent entityType={entityType} tab={activeTab} data={data} />
      </div>

      <div className="flex gap-2 p-3 border-t shrink-0">
        <Button variant="default" size="sm" className="flex-1 h-9 text-xs gap-1">
          <Search className="h-3.5 w-3.5" />
          عرض التفاصيل الكاملة
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
          <ArrowRight className="h-3.5 w-3.5" />
          الانتقال إلى الوحدة
        </Button>
      </div>
    </div>
  )
}

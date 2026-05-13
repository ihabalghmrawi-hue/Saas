'use client'

import { useState, useMemo } from 'react'
import { EnterpriseDataGrid } from '@/components/enterprise/DataGrid/DataGrid'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Wallet, Filter, Calendar, Download, Plus, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MOCK_JOURNAL = Array.from({ length: 50 }, (_, i) => ({
  id: `JRN-${String(i + 1).padStart(4, '0')}`,
  date: new Date(2024, 0, i + 1).toISOString(),
  description: ['قيد مقبوضات نقدية', 'مشتريات نقدية', 'مبيعات آجلة', 'مصروفات إدارية', 'مرتبات الموظفين'][i % 5],
  reference: `REF-${1000 + i}`,
  debit: Math.random() * 10000,
  credit: Math.random() * 10000,
  account: ['صندوق', 'بنك الراجحي', 'عملاء', 'مخزون', 'مصروفات'][i % 5],
  status: ['مرحل', 'معلق', 'مسودة'][i % 3],
  createdBy: ['أحمد محمد', 'سارة خالد', 'محمد علي'][i % 3],
}))

const JOURNAL_COLUMNS = [
  { id: 'id', title: 'رقم القيد', dataType: 'text' as const, width: 120, sortable: true, filterable: true },
  { id: 'date', title: 'التاريخ', dataType: 'date' as const, width: 130, sortable: true },
  { id: 'description', title: 'البيان', dataType: 'text' as const, minWidth: 200, sortable: true, filterable: true },
  { id: 'account', title: 'الحساب', dataType: 'text' as const, width: 150, sortable: true, filterable: true },
  { id: 'debit', title: 'مدين', dataType: 'currency' as const, width: 140, sortable: true, align: 'left' as const },
  { id: 'credit', title: 'دائن', dataType: 'currency' as const, width: 140, sortable: true, align: 'left' as const },
  {
    id: 'status', title: 'الحالة', dataType: 'badge' as const, width: 110, sortable: true, filterable: true,
    render: (value: string) => {
      const styles: Record<string, string> = {
        'مرحل': 'bg-success/10 text-success',
        'معلق': 'bg-warning/10 text-warning',
        'مسودة': 'bg-muted text-muted-foreground',
      }
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[value] || ''}`}>{value}</span>
    },
  },
  { id: 'createdBy', title: 'المستخدم', dataType: 'text' as const, width: 130, sortable: true },
]

export function JournalOperationsWorkspace() {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'draft'>('all')

  const filteredData = useMemo(() => {
    if (activeTab === 'all') return MOCK_JOURNAL
    return MOCK_JOURNAL.filter(j =>
      activeTab === 'pending' ? j.status === 'معلق' || j.status === 'مسودة' : j.status === 'مرحل'
    )
  }, [activeTab])

  const totals = useMemo(() => {
    const totalDebit = MOCK_JOURNAL.reduce((s, j) => s + j.debit, 0)
    const totalCredit = MOCK_JOURNAL.reduce((s, j) => s + j.credit, 0)
    const pending = MOCK_JOURNAL.filter(j => j.status === 'معلق' || j.status === 'مسودة').length
    return { totalDebit, totalCredit, pending }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[
          { label: 'المالية', icon: Wallet },
          { label: 'عمليات اليومية' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">عمليات اليومية</h1>
            <p className="text-sm text-muted-foreground">إدارة قيود اليومية وترحيلها للحسابات</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 ml-1" />
              فلتر التاريخ
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 ml-1" />
              تصدير
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 ml-1" />
              قيد جديد
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي المدين</div>
            <div className="text-xl font-bold text-success">{totals.totalDebit.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي الدائن</div>
            <div className="text-xl font-bold">{totals.totalCredit.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">الفرق</div>
            <div className={`text-xl font-bold ${Math.abs(totals.totalDebit - totals.totalCredit) < 0.01 ? 'text-success' : 'text-destructive'}`}>
              {Math.abs(totals.totalDebit - totals.totalCredit).toFixed(2)} <span className="text-xs font-normal">ر.س</span>
            </div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">قيود معلقة</div>
            <div className="text-xl font-bold text-warning">
              {totals.pending}
              {totals.pending > 0 && <span className="text-xs font-normal mr-2">تحتاج مراجعة</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Data Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex items-center gap-1 px-6 pt-4 border-b bg-card">
          {[
            { id: 'all', label: 'الكل', count: MOCK_JOURNAL.length },
            { id: 'pending', label: 'معلقة', count: MOCK_JOURNAL.filter(j => j.status !== 'مرحل').length },
            { id: 'draft', label: 'مرحلة', count: MOCK_JOURNAL.filter(j => j.status === 'مرحل').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="mr-1.5 px-1.5 py-0.5 text-xs bg-muted rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>
        <EnterpriseDataGrid
          columns={JOURNAL_COLUMNS}
          data={filteredData}
          selectable
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          groupable
          groupBy="status"
          pagination={{ page: 1, pageSize: 15, total: filteredData.length }}
          stickyHeader
          bulkActions={
            selectedRows.size > 0 ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default"><CheckCircle2 className="h-4 w-4 ml-1" /> ترحيل المحدد</Button>
                <Button size="sm" variant="outline"><XCircle className="h-4 w-4 ml-1" /> رفض</Button>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Inbox, Clock, CheckCircle2, XCircle, AlertTriangle, User,
  Filter, Search, ChevronDown, ArrowUpDown, SlidersHorizontal,
  AlertCircle, ArrowRight, CheckCheck,
} from 'lucide-react'
import type { ApprovalRequest, ApprovalDecision } from '@/lib/workflow/types'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import { SLAIndicator } from '@/components/workflow/SLAIndicator'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-muted text-muted-foreground border-muted',
}

const MOCK_APPROVALS: ApprovalRequest[] = Array.from({ length: 15 }, (_, i) => ({
  id: `apr-${i}`,
  workflowInstanceId: `wf-${i}`,
  stepId: `step-${i % 5}`,
  title: [
    'اعتماد فاتورة مبيعات #INV-0085', 'اعتماد أمر شراء #PO-0032',
    'ترحيل قيد يومية #JRN-0042', 'اعتماد تسوية بنكية', 'موافقة على طلب إجازة',
    'اعتماد صرف مرتبات', 'اعتماد عقد مورد جديد', 'الموافقة على زيادة حد ائتماني',
    'اعتماد قيد مخزون', 'اعتماد تقرير مصروفات', 'موافقة على طلب شراء',
    'اعتماد ميزانية القسم', 'الموافقة على تخفيض سعر', 'اعتماد سياسة جديدة',
  ][i % 14],
  description: '',
  requestedBy: { type: 'user' as const, id: `req-${i}`, name: ['أحمد محمد', 'سارة خالد', 'محمد علي', 'نورة أحمد'][i % 4] },
  assignedTo: [{ type: 'user' as const, id: 'user-1', name: 'المستخدم الحالي' }],
  decision: 'pending',
  slaMinutes: [60, 120, 30, 240, 480][i % 5],
  createdAt: Date.now() - Math.random() * 86400000,
  priority: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
  escalationCount: i > 8 ? 1 : 0,
}))

const FILTER_TABS = [
  { id: 'all', label: 'الكل', icon: Inbox },
  { id: 'critical', label: 'حرجة', icon: AlertCircle },
  { id: 'pending', label: 'معلقة', icon: Clock },
  { id: 'approved', label: 'تمت', icon: CheckCircle2 },
]

export function UnifiedApprovalInbox() {
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [sortBy, setSortBy] = useState<'sla' | 'priority' | 'date'>('sla')

  const approvals = MOCK_APPROVALS

  const filtered = useMemo(() => {
    let result = [...approvals]
    if (activeTab === 'critical') result = result.filter(a => a.priority === 'critical')
    if (activeTab === 'pending') result = result.filter(a => a.decision === 'pending')
    if (activeTab === 'approved') result = result.filter(a => a.decision === 'approved')
    if (searchQuery) result = result.filter(a => a.title.includes(searchQuery) || a.requestedBy.name.includes(searchQuery))
    result.sort((a, b) => {
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      if (sortBy === 'sla') return calculateSLADisplay(a.slaMinutes, a.createdAt).status === 'breached' ? -1 : 1
      return b.createdAt - a.createdAt
    })
    return result
  }, [approvals, activeTab, searchQuery, sortBy])

  const criticalCount = approvals.filter(a => a.priority === 'critical' && a.decision === 'pending').length
  const pendingCount = approvals.filter(a => a.decision === 'pending').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">صندوق الاعتماد الموحد</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingCount} معاملة تنتظر موافقتك
              {criticalCount > 0 && <span className="mr-2 text-destructive font-medium">{criticalCount} حرجة</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="h-9 pr-8 w-48 bg-muted/50 border rounded-lg text-xs outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-9 px-2 text-xs bg-muted/50 border rounded-lg outline-none"
            >
              <option value="sla">حسب SLA</option>
              <option value="priority">حسب الأولوية</option>
              <option value="date">حسب التاريخ</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Queue */}
        <div className="w-[420px] border-l overflow-y-auto bg-muted/10">
          <div className="flex gap-1 p-3 border-b bg-card">
            {FILTER_TABS.map(tab => {
              const Icon = tab.icon
              const count = tab.id === 'all' ? approvals.length :
                tab.id === 'critical' ? criticalCount :
                tab.id === 'pending' ? pendingCount :
                approvals.filter(a => a.decision === 'approved').length
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                    activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <span className={cn('px-1 text-[10px] rounded-full', activeTab === tab.id ? 'bg-white/20' : 'bg-muted')}>{count}</span>
                </button>
              )
            })}
          </div>

          {filtered.map(apr => {
            const slaDisplay = calculateSLADisplay(apr.slaMinutes, apr.createdAt)
            const isSelected = selectedApproval?.id === apr.id
            return (
              <button
                key={apr.id}
                onClick={() => setSelectedApproval(apr)}
                className={cn(
                  'w-full text-right px-4 py-3 border-b hover:bg-accent/50 transition-colors',
                  isSelected && 'bg-accent/30 border-r-2 border-r-primary',
                  apr.decision === 'approved' && 'opacity-60',
                  apr.priority === 'critical' && 'bg-destructive/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full border', PRIORITY_STYLES[apr.priority])}>
                    {apr.priority === 'critical' ? 'حرجة' : apr.priority === 'high' ? 'عالية' : apr.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </span>
                  <SLAIndicator sla={slaDisplay} size="sm" />
                </div>
                <div className="font-medium text-sm mt-1 line-clamp-1">{apr.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {apr.requestedBy.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(apr.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!selectedApproval && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Inbox className="h-16 w-16 mb-4 opacity-30" />
              <p className="font-medium">اختر معاملة للمراجعة</p>
              <p className="text-sm">اختر عنصراً من القائمة لعرض التفاصيل</p>
            </div>
          )}

          {selectedApproval && (
            <div className="max-w-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedApproval.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    من {selectedApproval.requestedBy.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedApproval.decision === 'pending' && (
                    <>
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors text-sm">
                        <CheckCircle2 className="h-4 w-4" /> اعتماد
                      </button>
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors text-sm">
                        <XCircle className="h-4 w-4" /> رفض
                      </button>
                    </>
                  )}
                  {selectedApproval.decision === 'approved' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm">
                      <CheckCircle2 className="h-4 w-4" /> تم الاعتماد
                    </div>
                  )}
                  {selectedApproval.decision === 'rejected' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <XCircle className="h-4 w-4" /> مرفوض
                    </div>
                  )}
                </div>
              </div>

              {/* SLA + Priority */}
              <div className="grid grid-cols-3 gap-3">
                {renderDetailCard('الأولوية', selectedApproval.priority === 'critical' ? 'حرجة' : selectedApproval.priority === 'high' ? 'عالية' : selectedApproval.priority === 'medium' ? 'متوسطة' : 'منخفضة', AlertTriangle)}
                {renderDetailCard('SLA', `${selectedApproval.slaMinutes} دقيقة`, Clock)}
                {renderDetailCard('تاريخ الإنشاء', new Date(selectedApproval.createdAt).toLocaleString('ar-SA'), Clock)}
              </div>

              {/* Escalation warning */}
              {selectedApproval.escalationCount > 0 && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <p className="text-sm text-warning font-medium">تم تصعيد هذا الطلب {selectedApproval.escalationCount} مرة</p>
                </div>
              )}

              {/* Comment box */}
              <div>
                <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                <textarea
                  placeholder="أضف ملاحظات..."
                  className="w-full h-24 px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderDetailCard(label: string, value: string, Icon: any) {
  return (
    <div className="p-3 rounded-xl bg-muted/20 border">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

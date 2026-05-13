'use client'

import { useState } from 'react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Wallet, CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User, FileText, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PENDING_POSTINGS = [
  { id: '1', type: 'قيد يومية', number: 'JRN-0042', description: 'مقبوضات نقدية - شركة الأفق', amount: 250000, submittedBy: 'أحمد محمد', submittedAt: '2024-01-20 10:30', priority: 'عالية', notes: 'مرفق إيصال استلام' },
  { id: '2', type: 'فاتورة مبيعات', number: 'INV-0085', description: 'فاتورة مبيعات - مؤسسة النور', amount: 85000, submittedBy: 'سارة خالد', submittedAt: '2024-01-20 09:15', priority: 'متوسطة', notes: '' },
  { id: '3', type: 'قيد تسوية', number: 'ADJ-0012', description: 'تسوية بنكية - بنك الراجحي', amount: 1500, submittedBy: 'محمد علي', submittedAt: '2024-01-19 14:45', priority: 'منخفضة', notes: 'فروقات رسوم بنكية' },
  { id: '4', type: 'قيد يومية', number: 'JRN-0043', description: 'صرف مرتبات شهر يناير', amount: 520000, submittedBy: 'نورة أحمد', submittedAt: '2024-01-19 11:00', priority: 'عالية', notes: 'قائمة الرواتب مرفقة' },
  { id: '5', type: 'فاتورة مشتريات', number: 'PUR-0031', description: 'مشتريات مخزون - موردون', amount: 180000, submittedBy: 'خالد عمر', submittedAt: '2024-01-18 16:30', priority: 'متوسطة', notes: '' },
]

export function PostingApprovalQueue() {
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [selectedPosting, setSelectedPosting] = useState(PENDING_POSTINGS[0])

  const filtered = filterPriority ? PENDING_POSTINGS.filter(p => p.priority === filterPriority) : PENDING_POSTINGS
  const highCount = PENDING_POSTINGS.filter(p => p.priority === 'عالية').length
  const totalAmount = PENDING_POSTINGS.reduce((s, p) => s + p.amount, 0)

  const priorityStyles: Record<string, string> = {
    'عالية': 'bg-destructive/10 text-destructive',
    'متوسطة': 'bg-warning/10 text-warning',
    'منخفضة': 'bg-muted text-muted-foreground',
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[
          { label: 'المالية', icon: Wallet },
          { label: 'مهام الترحيل' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">مهام الترحيل</h1>
            <p className="text-sm text-muted-foreground">مراجعة واعتماد قيود الترحيل المعلقة</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{PENDING_POSTINGS.length} معاملة معلقة</span>
            <span className="text-sm font-medium text-warning">{highCount} عالية الأهمية</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">بإنتظار الترحيل</div>
            <div className="text-xl font-bold text-warning">{PENDING_POSTINGS.length}</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">عالية الأهمية</div>
            <div className="text-xl font-bold text-destructive">{highCount}</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">الإجمالي</div>
            <div className="text-xl font-bold">{totalAmount.toLocaleString('ar-SA')} ر.س</div>
          </div>
          <div className="finance-card !p-4 bg-primary/5 border-primary/20">
            <div className="text-xs text-muted-foreground">مدة الانتظار avg</div>
            <div className="text-xl font-bold">4.2 ساعة</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Queue list */}
        <div className="w-[420px] border-l overflow-y-auto bg-muted/10">
          <div className="flex gap-1 p-3 border-b bg-card">
            {[null, 'عالية', 'متوسطة', 'منخفضة'].map(p => (
              <button
                key={p ?? 'all'}
                onClick={() => setFilterPriority(p)}
                className={`px-3 py-1.5 text-xs rounded-lg ${filterPriority === p ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {p ?? 'الكل'}
              </button>
            ))}
          </div>
          {filtered.map(posting => (
            <button
              key={posting.id}
              onClick={() => setSelectedPosting(posting)}
              className={`w-full text-right px-4 py-3 border-b hover:bg-accent/50 transition-colors ${
                selectedPosting.id === posting.id ? 'bg-accent/30 border-r-2 border-r-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{posting.type}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${priorityStyles[posting.priority]}`}>{posting.priority}</span>
              </div>
              <div className="font-medium mt-1">{posting.number} - {posting.description}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-mono">{posting.amount.toLocaleString('ar-SA')} ر.س</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {posting.submittedAt}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail view */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedPosting && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedPosting.number}</h2>
                  <p className="text-muted-foreground">{selectedPosting.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm"><Eye className="h-4 w-4 ml-1" /> معاينة</Button>
                  <Button size="sm" className="bg-success hover:bg-success/90"><CheckCircle2 className="h-4 w-4 ml-1" /> اعتماد</Button>
                  <Button size="sm" variant="destructive"><XCircle className="h-4 w-4 ml-1" /> رفض</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">البيان</label>
                    <p className="font-medium">{selectedPosting.description}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">المبلغ</label>
                    <p className="text-2xl font-bold">{selectedPosting.amount.toLocaleString('ar-SA')} <span className="text-base font-normal text-muted-foreground">ر.س</span></p>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <label className="text-xs text-muted-foreground">المقدم من</label>
                      <p className="flex items-center gap-1"><User className="h-4 w-4" /> {selectedPosting.submittedBy}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">تاريخ التقديم</label>
                      <p>{selectedPosting.submittedAt}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> ملاحظات</h3>
                  <p className="text-sm text-muted-foreground">{selectedPosting.notes || 'لا توجد ملاحظات'}</p>

                  <h3 className="font-semibold mt-4">سجل التدقيق</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تم التقديم</span>
                      <span>{selectedPosting.submittedAt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">آخر مراجعة</span>
                      <span>-</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <ArrowRight className="h-4 w-4" /> عرض تفاصيل القيد
                    </button>
                  </div>
                </div>
              </div>

              {/* Approval Actions */}
              <div className="border rounded-xl p-4">
                <h3 className="font-semibold mb-3">إجراءات الاعتماد</h3>
                <div className="flex items-center gap-3">
                  <Button className="bg-success hover:bg-success/90">
                    <CheckCircle2 className="h-4 w-4 ml-1" /> اعتماد وترحيل
                  </Button>
                  <Button variant="outline">
                    <CheckCircle2 className="h-4 w-4 ml-1" /> اعتماد مع ملاحظات
                  </Button>
                  <Button variant="destructive">
                    <XCircle className="h-4 w-4 ml-1" /> رفض
                  </Button>
                </div>
                <textarea
                  placeholder="أضف ملاحظات (اختياري)..."
                  className="w-full mt-3 h-20 px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

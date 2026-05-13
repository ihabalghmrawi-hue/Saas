'use client'

import { useState } from 'react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Wallet, AlertTriangle, AlertCircle, TrendingUp, TrendingDown, Search, CheckCircle2, Eye, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ANOMALIES = [
  { id: '1', type: 'اختلاف في الرصيد', severity: 'critical', account: 'صندوق النقدية', amount: 45000, expected: 50000, variance: -5000, variancePct: -10, detectedAt: '2024-01-20 08:30', status: 'مفتوحة', description: 'رصيد الصندوق أقل من المتوقع بمبلغ 5,000 ر.س' },
  { id: '2', type: 'قيد مكرر', severity: 'high', account: 'بنك الراجحي', amount: 150000, expected: 0, variance: 150000, variancePct: 100, detectedAt: '2024-01-20 07:45', status: 'مفتوحة', description: 'تم إدخال قيد مقبوضات مكرر لنفس المرجع' },
  { id: '3', type: 'حركة غير معتادة', severity: 'medium', account: 'مخزون البضاعة', amount: 850000, expected: 350000, variance: 500000, variancePct: 143, detectedAt: '2024-01-19 16:20', status: 'قيد المراجعة', description: 'حركة مخزون كبيرة غير معتادة خارج أوقات العمل' },
  { id: '4', type: 'تجاوز حد ائتماني', severity: 'high', account: 'شركة الأفق - عميل', amount: 750000, expected: 500000, variance: 250000, variancePct: 50, detectedAt: '2024-01-19 14:00', status: 'مفتوحة', description: 'العميل تجاوز الحد الائتماني المقرر' },
  { id: '5', type: 'فروقات تسوية', severity: 'low', account: 'بنك الأهلي', amount: 2300, expected: 0, variance: 2300, variancePct: 100, detectedAt: '2024-01-18 11:30', status: 'تم الحل', description: 'فروقات تسوية بنكية بسيطة' },
]

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-muted text-muted-foreground border-muted',
}

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: AlertTriangle,
}

export function FinancialAnomalyWorkspace() {
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)
  const [selectedAnomaly, setSelectedAnomaly] = useState(ANOMALIES[0])

  const filtered = selectedSeverity ? ANOMALIES.filter(a => a.severity === selectedSeverity) : ANOMALIES
  const openAnomalies = ANOMALIES.filter(a => a.status === 'مفتوحة').length
  const criticalAnomalies = ANOMALIES.filter(a => a.severity === 'critical').length
  const totalExposure = ANOMALIES.filter(a => a.status !== 'تم الحل').reduce((s, a) => s + Math.abs(a.variance), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[
          { label: 'المالية', icon: Wallet },
          { label: 'حالات الشذوذ المالي' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">حالات الشذوذ المالي</h1>
            <p className="text-sm text-muted-foreground">الكشف التلقائي عن الحالات غير الطبيعية والأنشطة المشبوهة</p>
          </div>
          <Button variant="outline" size="sm"><Eye className="h-4 w-4 ml-1" /> عرض الكل</Button>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="finance-card !p-4 border-destructive/20">
            <div className="text-xs text-muted-foreground">حالات مفتوحة</div>
            <div className="text-xl font-bold text-destructive">{openAnomalies}</div>
          </div>
          <div className="finance-card !p-4 border-orange-200">
            <div className="text-xs text-muted-foreground">حرجة</div>
            <div className="text-xl font-bold text-orange-600">{criticalAnomalies}</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي التعرض</div>
            <div className="text-xl font-bold text-warning">{totalExposure.toLocaleString('ar-SA')} ر.س</div>
          </div>
          <div className="finance-card !p-4 bg-success/5">
            <div className="text-xs text-muted-foreground">تم الحل</div>
            <div className="text-xl font-bold text-success">{ANOMALIES.filter(a => a.status === 'تم الحل').length}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[420px] border-l overflow-y-auto bg-muted/10">
          <div className="flex gap-1 p-3 border-b bg-card">
            {[null, 'critical', 'high', 'medium', 'low'].map(s => (
              <button
                key={s ?? 'all'}
                onClick={() => setSelectedSeverity(s)}
                className={`px-3 py-1.5 text-xs rounded-lg ${selectedSeverity === s ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {s === 'critical' ? 'حرجة' : s === 'high' ? 'عالية' : s === 'medium' ? 'متوسطة' : s === 'low' ? 'منخفضة' : 'الكل'}
              </button>
            ))}
          </div>
          {filtered.map(anomaly => {
            const Icon = SEVERITY_ICONS[anomaly.severity]
            return (
              <button
                key={anomaly.id}
                onClick={() => setSelectedAnomaly(anomaly)}
                className={`w-full text-right px-4 py-3 border-b hover:bg-accent/50 transition-colors ${
                  selectedAnomaly.id === anomaly.id ? 'bg-accent/30 border-r-2 border-r-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${anomaly.severity === 'critical' ? 'text-destructive' : anomaly.severity === 'high' ? 'text-orange-500' : ''}`} />
                    <span className="font-medium">{anomaly.type}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full border ${SEVERITY_STYLES[anomaly.severity]}`}>
                    {anomaly.severity === 'critical' ? 'حرجة' : anomaly.severity === 'high' ? 'عالية' : anomaly.severity === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </span>
                </div>
                <div className="text-sm mt-1">{anomaly.account}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-mono text-destructive">{anomaly.variance.toLocaleString('ar-SA')} ر.س</span>
                  <span className="text-xs text-muted-foreground">{anomaly.detectedAt}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {selectedAnomaly && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedAnomaly.type}</h2>
                  <p className="text-muted-foreground">{selectedAnomaly.account}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline"><Eye className="h-4 w-4 ml-1" /> تفاصيل</Button>
                  <Button size="sm" className="bg-success hover:bg-success/90"><CheckCircle2 className="h-4 w-4 ml-1" /> تأكيد وحل</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-muted/20 rounded-xl p-4">
                    <h3 className="font-semibold mb-2">تفاصيل الحالة</h3>
                    <p className="text-sm text-muted-foreground">{selectedAnomaly.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="finance-card !p-3">
                      <div className="text-xs text-muted-foreground">المبلغ الحالي</div>
                      <div className="text-lg font-bold text-destructive">{selectedAnomaly.amount.toLocaleString('ar-SA')}</div>
                    </div>
                    <div className="finance-card !p-3">
                      <div className="text-xs text-muted-foreground">المبلغ المتوقع</div>
                      <div className="text-lg font-bold text-success">{selectedAnomaly.expected.toLocaleString('ar-SA')}</div>
                    </div>
                  </div>
                  <div className="finance-card !p-3">
                    <div className="text-xs text-muted-foreground">الانحراف</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-destructive">{selectedAnomaly.variance.toLocaleString('ar-SA')} ر.س</span>
                      <span className="flex items-center text-sm text-destructive">
                        <TrendingDown className="h-4 w-4" /> {selectedAnomaly.variancePct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted/20 rounded-xl p-4">
                    <h3 className="font-semibold mb-2">التحليل</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ الكشف</span>
                        <span>{selectedAnomaly.detectedAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الحالة</span>
                        <span className={`font-medium ${selectedAnomaly.status === 'مفتوحة' ? 'text-destructive' : selectedAnomaly.status === 'قيد المراجعة' ? 'text-warning' : 'text-success'}`}>
                          {selectedAnomaly.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-xl p-4">
                    <h3 className="font-semibold mb-2">الإجراءات المقترحة</h3>
                    <div className="space-y-1">
                      <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                        <ArrowRight className="h-4 w-4 ml-2 inline" /> مراجعة الحركات المرتبطة
                      </button>
                      <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                        <ArrowRight className="h-4 w-4 ml-2 inline" /> إنشاء تقرير تدقيق
                      </button>
                      <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                        <ArrowRight className="h-4 w-4 ml-2 inline" /> إبلاغ المشرف
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

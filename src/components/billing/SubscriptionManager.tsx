'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CreditCard, CheckCircle2, Circle, AlertTriangle,
  ArrowUp, ArrowDown, Zap, Building2, Users,
  Database, BarChart3, Download, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'

interface Plan {
  id: string
  name: string
  price: number
  users: number | string
  storage: string
  modules: string[]
  support: string
}

interface UsageMetric {
  label: string
  used: number
  limit: number
  unit: string
  icon: React.ComponentType<{ className?: string }>
}

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'cancelled'
}

const PLANS: Plan[] = [
  { id: 'starter', name: 'ناشئ', price: 299, users: 5, storage: '1GB', modules: ['مالية', 'مخزون'], support: 'بريد إلكتروني' },
  { id: 'growth', name: 'متنامي', price: 599, users: 20, storage: '10GB', modules: ['مالية', 'مخزون', 'مشتريات', 'مبيعات'], support: 'دردشة + بريد' },
  { id: 'enterprise', name: 'مؤسسة', price: 1499, users: 100, storage: '50GB', modules: ['الكل', 'رواتب'], support: 'دعم فني 24/7' },
  { id: 'enterprise_plus', name: 'مؤسسة+', price: 2999, users: 'غير محدود', storage: '200GB', modules: ['الكل + واجهات API'], support: 'مدير حساب مخصص' },
]

const USAGE_METRICS: UsageMetric[] = [
  { label: 'المستخدمون', used: 12, limit: 20, unit: 'مستخدم', icon: Users },
  { label: 'مساحة التخزين', used: 3.2, limit: 10, unit: 'GB', icon: Database },
  { label: 'استدعاءات API', used: 8500, limit: 50000, unit: 'استدعاء', icon: Zap },
  { label: 'سير العمل النشط', used: 4, limit: 10, unit: 'سير', icon: BarChart3 },
]

const INVOICES: Invoice[] = [
  { id: 'INV-2026-001', date: '2026-01-01', amount: 599, status: 'paid' },
  { id: 'INV-2026-002', date: '2026-02-01', amount: 599, status: 'paid' },
  { id: 'INV-2026-003', date: '2026-03-01', amount: 599, status: 'paid' },
  { id: 'INV-2026-004', date: '2026-04-01', amount: 599, status: 'pending' },
]

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: 'مدفوعة', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending: { label: 'معلقة', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  overdue: { label: 'متأخرة', className: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'ملغية', className: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const PLAN_STATUS = {
  label: 'نشط',
  className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function UsageBar({ used, limit, unit, label, icon: Icon }: UsageMetric & { icon: React.ComponentType<{ className?: string }> }) {
  const pct = Math.min((used / limit) * 100, 100)
  const isNearLimit = pct > 80
  const isAtLimit = pct >= 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className="text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-warning' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PlanCard({ plan, isCurrent, onSelect }: { plan: Plan; isCurrent: boolean; onSelect: (id: string) => void }) {
  return (
    <div
      className={cn(
        'border rounded-xl p-5 transition-all flex flex-col',
        isCurrent
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md'
          : 'border-border hover:border-primary/40 hover:shadow-sm'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{plan.name}</h3>
        {isCurrent && <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">الخطة الحالية</span>}
      </div>

      <div className="mb-4">
        <span className="text-2xl font-bold">{plan.price.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground mr-1">ريال/شهر</span>
      </div>

      <div className="space-y-2 text-sm flex-1">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{plan.users === 'غير محدود' ? plan.users : `${plan.users} مستخدم`}</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{plan.storage} مساحة تخزين</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-1">
            {plan.modules.map((m) => (
              <span key={m} className="text-xs bg-muted px-1.5 py-0.5 rounded">{m}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{plan.support}</span>
        </div>
      </div>

      <Button
        variant={isCurrent ? 'outline' : 'default'}
        className="w-full mt-4"
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
      >
        {isCurrent ? 'الخطة الحالية' : plan.price > 599 ? 'ترقية' : 'تغيير الخطة'}
      </Button>
    </div>
  )
}

function ConfirmationDialog({
  open,
  plan,
  isUpgrade,
  onConfirm,
  onCancel,
}: {
  open: boolean
  plan: Plan | null
  isUpgrade: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open || !plan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-background rounded-xl border shadow-lg p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'p-2 rounded-full',
            isUpgrade ? 'bg-primary/10' : 'bg-yellow-100'
          )}>
            {isUpgrade ? <ArrowUp className="h-5 w-5 text-primary" /> : <ArrowDown className="h-5 w-5 text-yellow-600" />}
          </div>
          <h3 className="text-lg font-bold">{isUpgrade ? 'تأكيد الترقية' : 'تأكيد التخفيض'}</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          {isUpgrade
            ? `سيتم تطبيق الترقية فوراً وسيتم احتساب الفرق proporionally`
            : `سيتم تطبيق التخفيض في نهاية فترة الفوترة الحالية`}
        </p>

        <div className="border rounded-lg p-4 my-4 bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{plan.name}</span>
            <span className="text-lg font-bold">{plan.price.toLocaleString()} ريال/شهر</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>إلغاء</Button>
          <Button
            className="flex-1"
            variant={isUpgrade ? 'default' : 'secondary'}
            onClick={onConfirm}
          >
            {isUpgrade ? 'تأكيد الترقية' : 'تأكيد التخفيض'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SubscriptionManager() {
  const [currentPlan, setCurrentPlan] = useState('growth')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null)
  const [showPaymentMethod, setShowPaymentMethod] = useState(false)

  const activePlan = PLANS.find((p) => p.id === currentPlan)!

  const handlePlanSelect = (id: string) => {
    if (id === currentPlan) return
    const plan = PLANS.find((p) => p.id === id)!
    setPendingPlan(plan)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (pendingPlan) {
      setCurrentPlan(pendingPlan.id)
    }
    setShowConfirm(false)
    setPendingPlan(null)
  }

  const handleCancel = () => {
    setShowConfirm(false)
    setPendingPlan(null)
  }

  const isUpgrade = pendingPlan ? PLANS.findIndex((p) => p.id === pendingPlan.id) > PLANS.findIndex((p) => p.id === currentPlan) : false

  const invoiceStatusBadge = (status: Invoice['status']) => {
    const badge = STATUS_BADGE[status]
    return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', badge.className)}>{badge.label}</span>
  }

  return (
    <div className="w-full max-w-6xl mx-auto" dir="rtl">
      <EnterpriseBreadcrumbs
        items={[
          { label: 'الرئيسية', href: '/dashboard' },
          { label: 'الفواتير' },
          { label: 'الاشتراك' },
        ]}
        className="mb-6"
      />

      <div className="border rounded-xl bg-card p-6 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{activePlan.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activePlan.modules.join('، ')} • {activePlan.users === 'غير محدود' ? activePlan.users : `${activePlan.users} مستخدم`}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-2xl font-bold">{activePlan.price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ريال/شهر</span></span>
                <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', PLAN_STATUS.className)}>
                  {PLAN_STATUS.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                تاريخ الفاتورة القادمة: 01 مايو 2026
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Receipt className="h-4 w-4" />
            عرض الفواتير
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4">مقارنة الخطط</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              onSelect={handlePlanSelect}
            />
          ))}
        </div>
      </div>

      <div className="border rounded-xl bg-card p-6 shadow-sm mb-8">
        <h3 className="text-lg font-bold mb-4">استخدام الخطة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {USAGE_METRICS.map((metric) => (
            <UsageBar key={metric.label} {...metric} />
          ))}
        </div>
      </div>

      <div className="border rounded-xl bg-card p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">سجل الفواتير</h3>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير الكل
          </Button>
        </div>

        {INVOICES.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد فواتير بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </div>
                  {invoiceStatusBadge(inv.status)}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{inv.amount.toLocaleString()} ريال</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-xl bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">طريقة الدفع</p>
              <p className="text-sm text-muted-foreground">
                بطاقة ائتمان تنتهي بـ **** 4242
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPaymentMethod(true)}>
            تحديث طريقة الدفع
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={showConfirm}
        plan={pendingPlan}
        isUpgrade={isUpgrade}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {showPaymentMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPaymentMethod(false)}>
          <div
            className="bg-background rounded-xl border shadow-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-bold mb-4">تحديث طريقة الدفع</h3>
            <p className="text-sm text-muted-foreground mb-4">سيتم فتح نافذة دفع آمنة لتحديث معلومات بطاقتك</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">رقم البطاقة</label>
                <input className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" placeholder="4242 4242 4242 4242" dir="rtl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">تاريخ الانتهاء</label>
                  <input className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" placeholder="MM/YY" dir="rtl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">CVV</label>
                  <input className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" placeholder="123" dir="rtl" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentMethod(false)}>إلغاء</Button>
              <Button className="flex-1">حفظ</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

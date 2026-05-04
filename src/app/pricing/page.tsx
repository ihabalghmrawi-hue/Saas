import Link from 'next/link'
import { Check, X, Zap } from 'lucide-react'
import { PLAN_PRICING, PLAN_LIMITS, PLAN_FEATURES } from '@/lib/plans'
import type { Plan } from '@/lib/plans'

const PLANS: Plan[] = ['free', 'basic', 'pro']

const FEATURE_ROWS = [
  { key: 'products',        label: 'المنتجات',          isLimit: true  },
  { key: 'customers',       label: 'العملاء',            isLimit: true  },
  { key: 'salesPerMonth',   label: 'مبيعات شهرية',       isLimit: true  },
  { key: 'users',           label: 'المستخدمون',          isLimit: true  },
  { key: 'reports',         label: 'التقارير',            isLimit: false },
  { key: 'exportCSV',       label: 'تصدير CSV',           isLimit: false },
  { key: 'backups',         label: 'النسخ الاحتياطية',    isLimit: false },
  { key: 'aiInsights',      label: 'تحليلات الذكاء الاصطناعي', isLimit: false },
  { key: 'customBranding',  label: 'هوية بصرية مخصصة',   isLimit: false },
  { key: 'prioritySupport', label: 'دعم فني أولوية',     isLimit: false },
] as const

function formatLimit(val: number): string {
  return val === -1 ? 'غير محدود' : val.toLocaleString('ar')
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30" dir="rtl">
      {/* Nav */}
      <nav className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg text-primary">BOB ERP</span>
          <div className="flex items-center gap-3">
            <Link href="/auth/login"  className="text-sm text-muted-foreground hover:text-foreground">تسجيل الدخول</Link>
            <Link href="/auth/signup" className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90">ابدأ مجاناً</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <Zap className="w-4 h-4" /> خطط مرنة لكل حجم عمل
          </div>
          <h1 className="text-4xl font-bold">الأسعار والخطط</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            ابدأ مجاناً وطوّر خطتك مع نمو عملك. جميع الخطط تشمل 7 أيام تجريبية مجانية.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const pricing  = PLAN_PRICING[plan]
            const limits   = PLAN_LIMITS[plan]
            const features = PLAN_FEATURES[plan]
            return (
              <div key={plan} className={`relative rounded-3xl border p-8 flex flex-col gap-6 ${
                pricing.highlight
                  ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                  : 'border-border bg-card'
              }`}>
                {pricing.badge && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {pricing.badge}
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{pricing.nameAr}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    {pricing.monthly === 0 ? (
                      <span className="text-4xl font-bold">مجاني</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">${pricing.monthly}</span>
                        <span className="text-muted-foreground">/شهر</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Key limits */}
                <div className="space-y-2">
                  {[
                    { label: 'منتجات', val: limits.products },
                    { label: 'عملاء',  val: limits.customers },
                    { label: 'مستخدمون', val: limits.users },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-semibold">{formatLimit(r.val)}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'التقارير',           val: features.reports },
                    { label: 'تصدير CSV',           val: features.exportCSV },
                    { label: 'النسخ الاحتياطية',   val: features.backups },
                    { label: 'تحليلات AI',          val: features.aiInsights },
                    { label: 'هوية بصرية مخصصة',  val: features.customBranding },
                    { label: 'دعم أولوية',          val: features.prioritySupport },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-2 text-sm">
                      {f.val
                        ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                        : <X    className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                      <span className={f.val ? 'text-foreground' : 'text-muted-foreground/60'}>{f.label}</span>
                    </div>
                  ))}
                </div>

                <Link href="/auth/signup"
                  className={`w-full py-3 rounded-xl text-center text-sm font-semibold transition-all ${
                    pricing.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border hover:bg-accent'
                  }`}>
                  {plan === 'free' ? 'ابدأ مجاناً' : 'ابدأ التجربة المجانية'}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="bg-card border rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <h2 className="font-bold text-lg">مقارنة تفصيلية</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right px-6 py-3 font-medium text-muted-foreground w-1/4">الميزة</th>
                {PLANS.map(p => (
                  <th key={p} className="px-6 py-3 font-semibold text-center">{PLAN_PRICING[p].nameAr}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FEATURE_ROWS.map(row => (
                <tr key={row.key} className="hover:bg-muted/20">
                  <td className="px-6 py-3 text-muted-foreground">{row.label}</td>
                  {PLANS.map(plan => {
                    const val = row.isLimit
                      ? formatLimit((PLAN_LIMITS[plan] as any)[row.key])
                      : (PLAN_FEATURES[plan] as any)[row.key]
                    return (
                      <td key={plan} className="px-6 py-3 text-center font-medium">
                        {typeof val === 'boolean'
                          ? val
                            ? <Check className="w-4 h-4 text-green-500 mx-auto" />
                            : <X    className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                          : <span className={val === 'غير محدود' ? 'text-primary font-bold' : ''}>{val}</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="text-center py-8 space-y-4">
          <p className="text-muted-foreground">هل لديك أسئلة؟ تواصل معنا</p>
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-semibold hover:bg-primary/90 transition-all">
            <Zap className="w-4 h-4" />
            ابدأ تجربتك المجانية الآن
          </Link>
        </div>
      </div>
    </div>
  )
}

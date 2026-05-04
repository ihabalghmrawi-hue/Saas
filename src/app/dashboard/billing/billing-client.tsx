'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CreditCard, Zap, CheckCircle2, AlertTriangle, Clock,
  Loader2, ExternalLink, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_PRICING, PLAN_LIMITS, PLAN_FEATURES } from '@/lib/plans'
import type { SubscriptionContext, Plan } from '@/lib/plans'

interface Props { subscription: SubscriptionContext }

const STATUS_CONFIG = {
  active:    { label: 'نشط',      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  trialing:  { label: 'تجريبي',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  past_due:  { label: 'متأخر',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  canceled:  { label: 'ملغى',     color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  unpaid:    { label: 'غير مدفوع', color: 'bg-red-100 text-red-700' },
  paused:    { label: 'موقوف',    color: 'bg-amber-100 text-amber-700' },
}

export function BillingClient({ subscription: initialSub }: Props) {
  const [sub, setSub]     = useState(initialSub)
  const [loading, setLoading] = useState<Plan | 'portal' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const handleUpgrade = async (plan: Plan) => {
    setLoading(plan)
    try {
      const res  = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) { notify(json.error || 'فشل إنشاء جلسة الدفع'); return }
      window.location.href = json.url
    } finally { setLoading(null) }
  }

  const handlePortal = async () => {
    setLoading('portal')
    try {
      const res  = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { notify(json.error || 'فشل فتح بوابة الفاتورة'); return }
      window.open(json.url, '_blank')
    } finally { setLoading(null) }
  }

  const statusCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active
  const planPrice = PLAN_PRICING[sub.plan]
  const limits    = PLAN_LIMITS[sub.plan]
  const features  = PLAN_FEATURES[sub.plan]
  const PLANS: Plan[] = ['free', 'basic', 'pro']

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-red-600 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          الاشتراك والفوترة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة خطتك وفواتيرك</p>
      </div>

      {/* Trial / past-due banners */}
      {sub.isTrialing && sub.daysLeft !== null && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Clock className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              متبقي {sub.daysLeft} يوم من التجربة المجانية
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
              اختر خطة للاستمرار بعد انتهاء الفترة التجريبية
            </p>
          </div>
          <button onClick={() => handleUpgrade('basic')} disabled={loading === 'basic'}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <Zap className="w-3.5 h-3.5" /> ترقية الآن
          </button>
        </div>
      )}

      {sub.status === 'past_due' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">فشل تجديد الاشتراك</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">يرجى تحديث بيانات الدفع</p>
          </div>
          <button onClick={handlePortal} disabled={loading === 'portal'}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
            {loading === 'portal' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            تحديث الدفع
          </button>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">خطتك الحالية</p>
            <h2 className="text-2xl font-bold mt-1">{planPrice.nameAr}</h2>
            {planPrice.monthly > 0 && (
              <p className="text-muted-foreground text-sm">${planPrice.monthly}/شهر</p>
            )}
          </div>
          <span className={cn('text-xs px-3 py-1 rounded-full font-semibold', statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>

        {sub.currentPeriodEnd && !sub.isTrialing && (
          <p className="text-sm text-muted-foreground">
            {sub.cancelAtPeriodEnd ? '⚠️ ينتهي' : 'يتجدد'} في:{' '}
            <span className="font-medium text-foreground">
              {new Date(sub.currentPeriodEnd).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </p>
        )}

        {/* Limits overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'المنتجات',    val: limits.products        },
            { label: 'العملاء',     val: limits.customers       },
            { label: 'المستخدمون', val: limits.users            },
            { label: 'التخزين',    val: `${limits.storageGB} GB` },
          ].map(l => (
            <div key={l.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold">
                {typeof l.val === 'number' ? (l.val === -1 ? '∞' : l.val.toLocaleString('ar')) : l.val}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{l.label}</p>
            </div>
          ))}
        </div>

        {/* Active features */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          {[
            { label: 'التقارير',           val: features.reports },
            { label: 'تصدير CSV',           val: features.exportCSV },
            { label: 'النسخ الاحتياطية',   val: features.backups },
            { label: 'تحليلات AI',          val: features.aiInsights },
            { label: 'هوية مخصصة',         val: features.customBranding },
            { label: 'دعم أولوية',          val: features.prioritySupport },
          ].map(f => (
            <div key={f.label} className={cn(
              'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
              f.val ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 text-muted-foreground/50',
            )}>
              <CheckCircle2 className={cn('w-3.5 h-3.5 shrink-0', !f.val && 'opacity-20')} />
              {f.label}
            </div>
          ))}
        </div>

        {/* Manage / portal button */}
        {sub.stripeCustomerId && (
          <button onClick={handlePortal} disabled={loading === 'portal'}
            className="flex items-center gap-2 text-sm text-primary hover:underline">
            {loading === 'portal' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            إدارة الاشتراك والفواتير
          </button>
        )}
      </div>

      {/* Upgrade options */}
      {sub.plan !== 'pro' && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> ترقية خطتك
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANS.filter(p => p !== 'free' && p !== sub.plan).map(plan => {
              const pricing = PLAN_PRICING[plan]
              const lim     = PLAN_LIMITS[plan]
              return (
                <div key={plan} className={cn(
                  'border rounded-2xl p-5 space-y-3',
                  pricing.highlight ? 'border-primary bg-primary/5' : 'bg-card',
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{pricing.nameAr}</p>
                      <p className="text-muted-foreground text-sm">${pricing.monthly}/شهر</p>
                    </div>
                    {pricing.badge && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                        {pricing.badge}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {lim.products === -1 ? 'منتجات غير محدودة' : `${lim.products} منتج`}</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {lim.users === -1 ? 'مستخدمون غير محدودون' : `${lim.users} مستخدمون`}</li>
                    {PLAN_FEATURES[plan].aiInsights && <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> تحليلات الذكاء الاصطناعي</li>}
                    {PLAN_FEATURES[plan].customBranding && <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> هوية بصرية مخصصة</li>}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={!!loading}
                    className={cn(
                      'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      pricing.highlight
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-border hover:bg-accent',
                      loading && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {loading === plan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {loading === plan ? 'جاري التوجيه...' : `الترقية إلى ${pricing.nameAr}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pro badge */}
      {sub.plan === 'pro' && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-l from-primary/10 to-purple-500/10 border border-primary/20 rounded-2xl">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
          <div>
            <p className="font-semibold">أنت على الخطة الاحترافية</p>
            <p className="text-sm text-muted-foreground mt-0.5">تمتع بجميع الميزات بدون قيود</p>
          </div>
        </div>
      )}

      {/* View pricing link */}
      <div className="text-center">
        <Link href="/pricing" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
          <ExternalLink className="w-3.5 h-3.5" />
          عرض مقارنة الخطط الكاملة
        </Link>
      </div>
    </div>
  )
}

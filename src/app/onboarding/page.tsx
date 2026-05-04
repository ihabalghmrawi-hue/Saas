'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { BusinessType, BUSINESS_TYPES, getFeatures } from '@/lib/features'
import { cn } from '@/lib/utils'

const DESCRIPTIONS: Record<BusinessType, string> = {
  pharmacy:     'تتبع انتهاء الصلاحية، الدُفعات، تصنيفات الأدوية',
  retail:       'نقطة بيع سريعة، باركود، منتجات يومية',
  wholesale:    'أسعار الجملة، الحد الأدنى للكميات، فواتير كبيرة',
  clothing:     'مقاسات وألوان، متغيرات المنتج، عرض شبكي',
  stationery:   'فئات بسيطة، بيع سريع، مدرسة ومكتب',
  tools:        'أدوات وقطع غيار، مشتريات وصيانة',
  dress_rental: 'إدارة الفساتين، الحجوزات، الإرجاعات، التأمين',
  other:        'إعداد عام مناسب لأي نشاط تجاري',
}

type Step = 'select' | 'loading' | 'done'

const LOADING_STEPS = [
  'جاري إعداد النظام...',
  'إنشاء التصنيفات...',
  'إضافة المنتجات التجريبية...',
  'تهيئة نقطة البيع...',
  'اكتمل الإعداد! 🎉',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<BusinessType | null>(null)
  const [step, setStep] = useState<Step>('select')
  const [loadingStep, setLoadingStep] = useState(0)

  const handleConfirm = async () => {
    if (!selected) return
    setStep('loading')

    // Save business type
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_type: selected }),
    })

    // Animate loading steps while seeding
    const animate = async () => {
      for (let i = 0; i < LOADING_STEPS.length - 1; i++) {
        setLoadingStep(i)
        await new Promise(r => setTimeout(r, 600))
      }
    }

    const [seedResult] = await Promise.all([
      fetch('/api/onboarding/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: selected }),
      }),
      animate(),
    ])

    setLoadingStep(LOADING_STEPS.length - 1)
    setStep('done')
    await new Promise(r => setTimeout(r, 900))
    router.replace('/dashboard')
  }

  if (step === 'loading' || step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-sm text-center space-y-8">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
            <span className="text-4xl">{selected ? getFeatures(selected).icon : '🏪'}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {step === 'done' ? 'اكتمل الإعداد!' : 'جاري تهيئة النظام'}
            </h2>
            <p className="text-muted-foreground text-sm">{selected ? getFeatures(selected).label : ''}</p>
          </div>
          <div className="space-y-3">
            {LOADING_STEPS.map((label, i) => (
              <div key={i} className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all',
                i < loadingStep ? 'text-muted-foreground' :
                i === loadingStep ? 'bg-primary/10 text-primary font-medium' :
                'text-muted-foreground/40'
              )}>
                {i < loadingStep ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : i === loadingStep ? (
                  step === 'done' && i === LOADING_STEPS.length - 1
                    ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                    : <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 shrink-0" />
                )}
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🏪</div>
          <h1 className="text-3xl font-bold text-foreground">مرحباً بك في نظام ERP</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            اختر نوع نشاطك — سيتم إعداد النظام تلقائياً بفئات ومنتجات جاهزة
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {BUSINESS_TYPES.map((type) => {
            const f = getFeatures(type)
            const isSelected = selected === type
            return (
              <button
                key={type}
                onClick={() => setSelected(type)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-5 rounded-2xl border-2 text-center transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-3xl">{f.icon}</span>
                <span className="font-semibold text-sm text-foreground">{f.label}</span>
                <span className="text-[11px] text-muted-foreground leading-snug">{DESCRIPTIONS[type]}</span>
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="bg-card border rounded-2xl p-4 mb-5 text-sm">
            <p className="font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              سيتم إعداده تلقائياً لـ <strong>{getFeatures(selected).label}</strong>:
            </p>
            <div className="flex flex-wrap gap-2">
              {getFeatures(selected).hasExpiry && <Tag>تتبع انتهاء الصلاحية</Tag>}
              {getFeatures(selected).hasBatch && <Tag>إدارة الدُفعات</Tag>}
              {getFeatures(selected).hasVariants && <Tag>متغيرات (مقاس / لون)</Tag>}
              {getFeatures(selected).hasBulkPricing && <Tag>أسعار الجملة</Tag>}
              {getFeatures(selected).hasMinQty && <Tag>الحد الأدنى للطلب</Tag>}
              {getFeatures(selected).fastPOS && <Tag>POS سريع</Tag>}
              {getFeatures(selected).showReturns && <Tag>المرتجعات</Tag>}
              {getFeatures(selected).showShifts && <Tag>الورديات</Tag>}
              {getFeatures(selected).hasRental && <Tag>إدارة الفساتين</Tag>}
              {getFeatures(selected).hasRental && <Tag>نظام الحجوزات</Tag>}
              {getFeatures(selected).hasRental && <Tag>تتبع الإرجاعات</Tag>}
              <Tag variant="green">فئات جاهزة</Tag>
              {!getFeatures(selected).hasRental && <Tag variant="green">منتجات تجريبية</Tag>}
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-bold text-base hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
        >
          ابدأ الآن ←
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          يمكنك تغيير نوع النشاط وإعادة الضبط لاحقاً من الإعدادات
        </p>
      </div>
    </div>
  )
}

function Tag({ children, variant = 'blue' }: { children: React.ReactNode; variant?: 'blue' | 'green' }) {
  return (
    <span className={cn(
      'text-xs px-2.5 py-1 rounded-full font-medium',
      variant === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-primary/10 text-primary'
    )}>
      {children}
    </span>
  )
}

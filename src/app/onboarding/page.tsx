'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { BusinessType, BUSINESS_TYPES, getFeatures } from '@/lib/features'
import { cn } from '@/lib/utils'

const DESCRIPTIONS: Record<BusinessType, string> = {
  pharmacy:   'تتبع انتهاء الصلاحية، الدُفعات، تصنيفات الأدوية',
  retail:     'نقطة بيع سريعة، باركود، منتجات يومية',
  wholesale:  'أسعار الجملة، الحد الأدنى للكميات، فواتير كبيرة',
  clothing:   'مقاسات وألوان، متغيرات المنتج، عرض شبكي',
  stationery: 'فئات بسيطة، بيع سريع، مدرسة ومكتب',
  tools:      'أدوات وقطع غيار، مشتريات وصيانة',
  other:      'إعداد عام مناسب لأي نشاط تجاري',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<BusinessType | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_type: selected }),
    })
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🏪</div>
          <h1 className="text-3xl font-bold text-foreground">مرحباً بك في نظام ERP</h1>
          <p className="text-muted-foreground mt-2 text-base">اختر نوع نشاطك التجاري لتخصيص النظام تلقائياً</p>
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
          <div className="bg-card border rounded-2xl p-4 mb-6 text-sm">
            <p className="font-medium text-foreground mb-2">✅ سيتم تفعيل تلقائياً لـ <strong>{getFeatures(selected).label}</strong>:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {getFeatures(selected).hasExpiry && <Tag>تتبع انتهاء الصلاحية</Tag>}
              {getFeatures(selected).hasBatch && <Tag>إدارة الدُفعات</Tag>}
              {getFeatures(selected).hasVariants && <Tag>متغيرات المنتج (مقاس / لون)</Tag>}
              {getFeatures(selected).hasBulkPricing && <Tag>أسعار الجملة</Tag>}
              {getFeatures(selected).hasMinQty && <Tag>الحد الأدنى للكمية</Tag>}
              {getFeatures(selected).fastPOS && <Tag>نقطة بيع سريعة</Tag>}
              {getFeatures(selected).barcodeFirst && <Tag>باركود أولاً</Tag>}
              {getFeatures(selected).showReturns && <Tag>المرتجعات</Tag>}
              {getFeatures(selected).showShifts && <Tag>الورديات</Tag>}
              {getFeatures(selected).medicineCategories && <Tag>تصنيفات الأدوية</Tag>}
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-bold text-base hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? 'جاري الإعداد...' : 'ابدأ الآن →'}
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          يمكنك تغيير نوع النشاط لاحقاً من الإعدادات
        </p>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
      {children}
    </span>
  )
}

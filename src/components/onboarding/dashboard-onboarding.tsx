'use client'

import { OnboardingTour } from './onboarding-tour'
import { SetupProgress }  from './setup-progress'
import type { TourStep }  from './onboarding-tour'
import type { SetupStep } from './setup-progress'

// ── Tour definitions ──────────────────────────────────────────────────────────

const RENTAL_TOUR: TourStep[] = [
  {
    title:    'مرحباً في نظام تأجير الفساتين! 👗',
    body:     'سنأخذك في جولة سريعة لتتعرف على أهم ميزات النظام. لن تأخذ أكثر من دقيقة!',
    position: 'center',
    emoji:    '👰',
  },
  {
    title:    'شريط الإجراءات السريعة',
    body:     'من هنا تستطيع إنشاء حجز جديد، إضافة فستان، أو الوصول للتقويم بنقرة واحدة فقط.',
    target:   '[data-tour="quick-action-bar"]',
    position: 'bottom',
    emoji:    '⚡',
  },
  {
    title:    'لوحة التحكم',
    body:     'تعرض لك دائماً الفساتين المتاحة، الحجوزات النشطة، والمتأخرات في مكان واحد.',
    target:   '[data-tour="dashboard-stats"]',
    position: 'bottom',
    emoji:    '📊',
  },
  {
    title:    'حجز سريع — مثل POS',
    body:     'الحجز السريع مصمم للعمل بنقرتين فقط: اختر الفستان والتاريخ ← أدخل اسم العميلة ← تأكيد.',
    target:   '[data-tour="new-booking-btn"]',
    position: 'bottom',
    emoji:    '🚀',
  },
  {
    title:    'تقويم التأجير',
    body:     'شاهد كل الحجوزات على شكل جدول زمني. اضغط على أي يوم فارغ لإنشاء حجز مباشرة.',
    target:   '[data-tour="calendar-link"]',
    position: 'right',
    emoji:    '📅',
  },
  {
    title:    'أنت جاهز! 🎉',
    body:     'ابدأ بإضافة فساتينك ثم استقبل أول حجز. النظام سيحسب الأسعار والتواريخ تلقائياً.',
    position: 'center',
    emoji:    '✅',
  },
]

const RETAIL_TOUR: TourStep[] = [
  {
    title:    'مرحباً في نظام ERP! 🏪',
    body:     'سنريك كيف تستخدم النظام بكفاءة. الجولة تستغرق أقل من دقيقة.',
    position: 'center',
    emoji:    '👋',
  },
  {
    title:    'الإجراءات السريعة',
    body:     'الأزرار في الأعلى تمنحك وصولاً فورياً للبيع، إضافة منتج، أو تسجيل مصروف.',
    target:   '[data-tour="quick-action-bar"]',
    position: 'bottom',
    emoji:    '⚡',
  },
  {
    title:    'نقطة البيع',
    body:     'مصممة للسرعة — باركود، بحث فوري، وإتمام البيع في ثوانٍ. مثالية للكاشير.',
    target:   '[data-tour="pos-btn"]',
    position: 'bottom',
    emoji:    '🛒',
  },
  {
    title:    'لوحة الإحصائيات',
    body:     'تتابع مبيعات اليوم والشهر والأرباح في لمحة سريعة — تتحدث تلقائياً.',
    target:   '[data-tour="dashboard-stats"]',
    position: 'bottom',
    emoji:    '📈',
  },
  {
    title:    'أنت جاهز! 🎉',
    body:     'ابدأ بإضافة منتجاتك وتفعيل نقطة البيع. النظام جاهز لاستقبال أول عملية بيع.',
    position: 'center',
    emoji:    '✅',
  },
]

// ── Setup steps ───────────────────────────────────────────────────────────────

interface DashboardOnboardingProps {
  businessType:    string
  hasProducts:     boolean
  hasDresses:      boolean
  hasOrders:       boolean
  hasSales:        boolean
  hasBranding:     boolean
  hasPricingRules: boolean
}

export function DashboardOnboarding({
  businessType, hasProducts, hasDresses, hasOrders, hasSales, hasBranding, hasPricingRules,
}: DashboardOnboardingProps) {
  const isRental = businessType === 'dress_rental'

  const rentalSteps: SetupStep[] = [
    { id: 'dress',    label: 'أضف أول فستان',         desc: 'أضف فساتينك للبدء في استقبال الحجوزات',         href: '/dashboard/rentals/dresses',       action: 'إضافة فستان',     done: hasDresses },
    { id: 'booking',  label: 'أنشئ أول حجز',           desc: 'جرّب الحجز السريع المدمج بمحرك الأسعار',         href: '/dashboard/rentals/bookings/new',  action: 'حجز سريع',        done: hasOrders },
    { id: 'pricing',  label: 'إعداد قواعد التسعير',    desc: 'أضف باقات أو أسعار عطلة الأسبوع والمناسبات',    href: '/dashboard/rentals/pricing',       action: 'إعداد التسعير',   done: hasPricingRules },
    { id: 'branding', label: 'تخصيص العلامة التجارية', desc: 'أضف شعارك ولونك لتخصيص الإيصالات',              href: '/dashboard/settings',              action: 'تخصيص الإعدادات', done: hasBranding },
  ]

  const retailSteps: SetupStep[] = [
    { id: 'product',  label: 'أضف أول منتج',           desc: 'أضف منتجاتك لبدء البيع',                         href: '/dashboard/inventory',             action: 'إضافة منتج',      done: hasProducts },
    { id: 'sale',     label: 'سجّل أول عملية بيع',     desc: 'افتح نقطة البيع وسجّل أول فاتورة',              href: '/dashboard/pos',                   action: 'فتح POS',          done: hasSales },
    { id: 'branding', label: 'تخصيص العلامة التجارية', desc: 'أضف شعارك ولون علامتك التجارية',                href: '/dashboard/settings',              action: 'تخصيص',           done: hasBranding },
    { id: 'pricing',  label: 'إعداد قواعد التسعير',    desc: 'اضبط أسعار الجملة والخصومات إن وجدت',           href: '/dashboard/categories',            action: 'إعداد الفئات',    done: hasPricingRules },
  ]

  const steps    = isRental ? rentalSteps  : retailSteps
  const tourSteps = isRental ? RENTAL_TOUR : RETAIL_TOUR

  return (
    <>
      <OnboardingTour tourKey={businessType} steps={tourSteps} />
      <SetupProgress  steps={steps}          businessType={businessType} />
    </>
  )
}

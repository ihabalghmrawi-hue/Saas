'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock, Building2, User } from 'lucide-react'
import { generateSlug } from '@/lib/utils'
import { BUSINESS_TYPE_COOKIE } from '@/lib/features'

const BUSINESS_TYPE_OPTIONS = [
  { value: 'retail',       label: 'بقالة / سوبرماركت',    icon: '🛒', description: 'مبيعات بالتجزئة وإدارة المخزون' },
  { value: 'wholesale',    label: 'تجارة الجملة',           icon: '📦', description: 'بيع بالجملة وأسعار كميات' },
  { value: 'pharmacy',     label: 'صيدلية',                 icon: '💊', description: 'إدارة الأدوية وتواريخ الانتهاء' },
  { value: 'clothing',     label: 'ملابس وأزياء',           icon: '👗', description: 'ملابس مع متغيرات المقاسات والألوان' },
  { value: 'dress_rental', label: 'تأجير الفساتين',         icon: '👘', description: 'إدارة الحجوزات والتأجير' },
  { value: 'stationery',   label: 'قرطاسية ومكتبة',        icon: '📚', description: 'مواد مكتبية وتعليمية' },
  { value: 'tools',        label: 'أدوات وعدد',             icon: '🔧', description: 'معدات وأدوات صناعية' },
  { value: 'other',        label: 'أخرى',                   icon: '🏪', description: 'نشاط تجاري عام' },
]

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    currency: 'USD',
    language: 'ar',
    businessType: '',
  })

  const [showPassword, setShowPassword] = useState(false)

  const handleNext = () => {
    if (!formData.fullName || !formData.email || !formData.password) {
      setError('الرجاء ملء جميع الحقول المطلوبة')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    setError('')
    setStep(2)
  }

  const handleNextStep2 = () => {
    if (!formData.companyName) {
      setError('الرجاء إدخال اسم الشركة')
      return
    }
    setError('')
    setStep(3)
  }

  const handleSignup = async () => {
    if (!formData.businessType) {
      setError('الرجاء اختيار نوع النشاط التجاري')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    // 1. Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { full_name: formData.fullName },
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'حدث خطأ أثناء إنشاء الحساب')
      setLoading(false)
      return
    }

    // 2. Create company
    const slug = generateSlug(formData.companyName) + '-' + Date.now().toString(36)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: formData.companyName,
        slug,
        currency: formData.currency,
        language: formData.language,
      })
      .select()
      .single()

    if (companyError || !company) {
      setError('حدث خطأ أثناء إنشاء الشركة')
      setLoading(false)
      return
    }

    // 3. Create membership
    await supabase.from('memberships').insert({
      user_id: authData.user.id,
      company_id: company.id,
      role: 'owner',
      is_active: true,
    })

    // 4. Save business type cookie then redirect to onboarding
    document.cookie = `${BUSINESS_TYPE_COOKIE}=${formData.businessType}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-card rounded-2xl border shadow-xl p-8">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s, i) => (
          <>
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step >= s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>{s}</div>
            {i < 2 && <div className={`h-0.5 w-12 transition-colors ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {step === 1 ? 'إنشاء حساب جديد' : step === 2 ? 'معلومات الشركة' : 'نوع النشاط التجاري'}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {step === 1 ? 'أدخل بياناتك الشخصية' : step === 2 ? 'أدخل بيانات شركتك' : 'اختر ما يناسب نشاطك'}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <label className="form-label">الاسم الكامل</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="محمد أحمد"
                className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="form-label">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@email.com"
                className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="form-label">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                dir="ltr"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">تأكيد كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            التالي
          </button>
        </div>
      ) : step === 2 ? (
        <div className="space-y-4">
          <div>
            <label className="form-label">اسم الشركة أو المتجر</label>
            <div className="relative">
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="متجري / شركتي"
                className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="form-label">العملة الافتراضية</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="USD">دولار أمريكي (USD)</option>
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="EGP">جنيه مصري (EGP)</option>
              <option value="KWD">دينار كويتي (KWD)</option>
              <option value="EUR">يورو (EUR)</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={handleNextStep2}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {BUSINESS_TYPE_OPTIONS.map((bt) => (
              <button
                key={bt.value}
                type="button"
                onClick={() => setFormData({ ...formData, businessType: bt.value })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-right transition-all ${
                  formData.businessType === bt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-accent'
                }`}
              >
                <span className="text-2xl">{bt.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-foreground">{bt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{bt.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء الحساب'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          لديك حساب بالفعل؟{' '}
          <Link href="/auth/login" className="text-primary font-medium hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  )
}

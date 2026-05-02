'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock, Building2, User } from 'lucide-react'
import { generateSlug } from '@/lib/utils'

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.companyName) {
      setError('الرجاء إدخال اسم الشركة')
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
    })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-card rounded-2xl border shadow-xl p-8">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          step >= 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
        }`}>1</div>
        <div className={`h-0.5 w-12 transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          step >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
        }`}>2</div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {step === 1 ? 'إنشاء حساب جديد' : 'معلومات الشركة'}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {step === 1 ? 'أدخل بياناتك الشخصية' : 'أدخل بيانات شركتك'}
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
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="form-label">اسم الشركة أو المتجر</label>
            <div className="relative">
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="متجري / شركتي"
                required
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
              type="submit"
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
        </form>
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

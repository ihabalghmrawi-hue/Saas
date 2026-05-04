'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { Building2, Bell, Shield, Database, Loader2, CheckCircle, Moon, Sun, Globe, DollarSign, Store, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUSINESS_TYPES, getFeatures, type BusinessType } from '@/lib/features'
import { BrandingSettings } from '@/components/branding-settings'
import type { Company } from '@/types/database'

interface SettingsClientProps {
  company: Company
  user: any
  role: string
  currentBusinessType?: string
  branding?: any
}

export function SettingsClient({ company, user, role, currentBusinessType, branding }: SettingsClientProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [activeSection, setActiveSection] = useState('general')
  const [selectedBizType, setSelectedBizType] = useState<BusinessType>((currentBusinessType as BusinessType) || 'retail')
  const [savingBizType, setSavingBizType] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    name: company.name || '',
    name_ar: company.name_ar || '',
    email: company.email || '',
    phone: company.phone || '',
    address: company.address || '',
    tax_number: company.tax_number || '',
    currency: company.currency || 'USD',
    language: company.language || 'ar',
    timezone: company.timezone || 'Asia/Riyadh',
  })

  const [notifications, setNotifications] = useState(
    company.settings?.notifications_enabled ?? true
  )
  const [backupEnabled, setBackupEnabled] = useState(
    company.settings?.backup_enabled ?? true
  )

  const saveGeneral = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('companies').update({
      name: form.name,
      name_ar: form.name_ar || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      tax_number: form.tax_number || null,
      currency: form.currency,
      language: form.language,
      timezone: form.timezone,
    }).eq('id', company.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const saveNotifications = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('companies').update({
      settings: {
        ...company.settings,
        notifications_enabled: notifications,
        backup_enabled: backupEnabled,
      }
    }).eq('id', company.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [resetting, setResetting] = useState(false)

  const saveBizType = async () => {
    setSavingBizType(true)
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_type: selectedBizType }),
    })
    setSavingBizType(false)
    router.refresh()
  }

  const resetToTemplate = async () => {
    if (!confirm('سيتم مسح جميع المنتجات والفئات الحالية وإعادة التهيئة. هل أنت متأكد؟')) return
    setResetting(true)
    await fetch('/api/onboarding/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_type: selectedBizType, reset: true }),
    })
    setResetting(false)
    router.refresh()
  }

  const sections = [
    { key: 'branding', label: 'الهوية البصرية', icon: Palette },
    { key: 'business', label: 'نوع النشاط', icon: Store },
    { key: 'general', label: 'إعدادات عامة', icon: Building2 },
    { key: 'preferences', label: 'التفضيلات', icon: Globe },
    { key: 'notifications', label: 'الإشعارات', icon: Bell },
    { key: 'security', label: 'الأمان', icon: Shield },
    { key: 'backup', label: 'النسخ الاحتياطي', icon: Database },
  ]

  const canEdit = ['owner', 'admin'].includes(role)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">الإعدادات</h2>
        <p className="text-sm text-muted-foreground">إدارة إعدادات الشركة والحساب</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="bg-card rounded-xl border p-3 shadow-sm h-fit">
          {sections.map(s => {
            const Icon = s.icon
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-right',
                  activeSection === s.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
                <Icon className="w-4 h-4 shrink-0" />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 bg-card rounded-xl border shadow-sm p-6">
          {saved && (
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-sm p-3 rounded-lg border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
              تم حفظ الإعدادات بنجاح!
            </div>
          )}

          {/* Branding */}
          {activeSection === 'branding' && (
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground mb-4">الهوية البصرية</h3>
              <BrandingSettings initialData={branding} />
            </div>
          )}

          {/* Business Type */}
          {activeSection === 'business' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">نوع النشاط التجاري</h3>
              <p className="text-sm text-muted-foreground">تغيير نوع نشاطك سيؤثر على الميزات والأدوات المتاحة في النظام</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BUSINESS_TYPES.map((type) => {
                  const f = getFeatures(type)
                  const isSelected = selectedBizType === type
                  return (
                    <button key={type} onClick={() => setSelectedBizType(type)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-center transition-all',
                        isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                      )}>
                      <span className="text-2xl">{f.icon}</span>
                      <span className="text-xs font-medium">{f.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={saveBizType} disabled={savingBizType}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                  {savingBizType ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  حفظ نوع النشاط
                </button>
                <button onClick={resetToTemplate} disabled={resetting}
                  className="px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 flex items-center gap-2">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  إعادة ضبط البيانات
                </button>
              </div>
            </div>
          )}

          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">معلومات الشركة</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">اسم الشركة (عربي)</label>
                  <input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})}
                    disabled={!canEdit} placeholder="اسم الشركة"
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="form-label">Company Name (English)</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    disabled={!canEdit} placeholder="Company Name"
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" dir="ltr" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">البريد الإلكتروني</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    disabled={!canEdit} placeholder="company@email.com"
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" dir="ltr" />
                </div>
                <div>
                  <label className="form-label">رقم الهاتف</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    disabled={!canEdit} placeholder="+966 XX XXX XXXX"
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="form-label">العنوان</label>
                <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                  disabled={!canEdit} rows={2} placeholder="عنوان الشركة"
                  className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed resize-none" />
              </div>

              <div>
                <label className="form-label">الرقم الضريبي</label>
                <input value={form.tax_number} onChange={e => setForm({...form, tax_number: e.target.value})}
                  disabled={!canEdit} placeholder="VAT/TAX Number"
                  className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" dir="ltr" />
              </div>

              {canEdit && (
                <button onClick={saveGeneral} disabled={saving}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ التغييرات'}
                </button>
              )}
            </div>
          )}

          {/* Preferences */}
          {activeSection === 'preferences' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">التفضيلات</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">العملة الافتراضية</label>
                  <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}
                    disabled={!canEdit}
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60">
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="KWD">دينار كويتي (KWD)</option>
                    <option value="EUR">يورو (EUR)</option>
                    <option value="GBP">جنيه إسترليني (GBP)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">اللغة</label>
                  <select value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                    disabled={!canEdit}
                    className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60">
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="form-label">المظهر</label>
                <div className="flex gap-3">
                  {[
                    { value: 'light', label: 'فاتح', icon: Sun },
                    { value: 'dark', label: 'داكن', icon: Moon },
                    { value: 'system', label: 'النظام', icon: Globe },
                  ].map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button" onClick={() => setTheme(value)}
                      className={cn('flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                        theme === value ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:border-muted-foreground text-muted-foreground')}>
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {canEdit && (
                <button onClick={saveGeneral} disabled={saving}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ التغييرات'}
                </button>
              )}
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">إعدادات الإشعارات</h3>
              <div className="space-y-4">
                {[
                  { key: 'notifications', label: 'تفعيل الإشعارات', desc: 'تلقي إشعارات عند إضافة معاملات جديدة', value: notifications, set: setNotifications },
                  { key: 'backup', label: 'النسخ الاحتياطي التلقائي', desc: 'حفظ نسخة احتياطية من بياناتك تلقائياً', value: backupEnabled, set: setBackupEnabled },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => item.set(!item.value)}
                      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                        item.value ? 'bg-primary' : 'bg-muted')}>
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        item.value ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={saveNotifications} disabled={saving}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ الإعدادات'}
              </button>
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">الأمان والخصوصية</h3>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">حسابك محمي</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        بريدك: <span dir="ltr">{user.email}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl border bg-muted/20">
                  <p className="text-sm font-medium text-foreground">تغيير كلمة المرور</p>
                  <p className="text-xs text-muted-foreground mt-0.5">سيتم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك</p>
                  <button
                    onClick={async () => {
                      if (!user?.email) return
                      const supabase = createClient()
                      await supabase.auth.resetPasswordForEmail(user.email)
                      alert('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني')
                    }}
                    className="mt-3 text-sm text-primary hover:underline font-medium">
                    إرسال رابط إعادة التعيين
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">منطقة الخطر</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">حذف الحساب سيؤدي إلى فقدان جميع البيانات بشكل دائم</p>
              </div>
            </div>
          )}

          {/* Backup */}
          {activeSection === 'backup' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-foreground">النسخ الاحتياطي</h3>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">النسخ الاحتياطي نشط</p>
                    <p className="text-xs text-muted-foreground mt-0.5">بياناتك محفوظة بأمان على Supabase Cloud</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'أمان عالي', desc: 'تشفير AES-256' },
                  { label: 'نسخ تلقائي', desc: 'يومياً' },
                  { label: 'استرداد سريع', desc: 'في أي وقت' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl border bg-muted/20">
                    <p className="font-semibold text-foreground text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-1">معلومات الحساب</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>معرف الشركة: <span className="font-mono text-foreground" dir="ltr">{company.id}</span></p>
                  <p>تاريخ الإنشاء: {new Date(company.created_at).toLocaleDateString('ar-SA')}</p>
                  <p>الإصدار: v1.0.0</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

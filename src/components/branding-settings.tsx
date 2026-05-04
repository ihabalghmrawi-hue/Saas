'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, Check, Palette, Building2, Image, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandingData {
  name_ar?: string
  name?: string
  phone?: string
  address?: string
  tax_number?: string
  logo_url?: string | null
  primary_color?: string
  secondary_color?: string
  receipt_footer?: string
  receipt_header?: string
}

const PRESET_COLORS = [
  { label: 'بنفسجي', value: '#6366f1' },
  { label: 'أزرق', value: '#3b82f6' },
  { label: 'أخضر', value: '#10b981' },
  { label: 'برتقالي', value: '#f59e0b' },
  { label: 'أحمر', value: '#ef4444' },
  { label: 'وردي', value: '#ec4899' },
  { label: 'سماوي', value: '#06b6d4' },
  { label: 'رمادي', value: '#6b7280' },
]

interface Props {
  initialData?: BrandingData
}

export function BrandingSettings({ initialData }: Props) {
  const [form, setForm] = useState<BrandingData>({
    name_ar: '', name: '', phone: '', address: '', tax_number: '',
    logo_url: null, primary_color: '#6366f1', secondary_color: '#8b5cf6',
    receipt_footer: 'شكراً لزيارتكم', receipt_header: '',
    ...initialData,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); window.location.reload() }, 1200)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    setLogoError('')
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/branding/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(f => ({ ...f, logo_url: data.url }))
    } catch (e: any) {
      setLogoError(e.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const set = (key: keyof BrandingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const inputCls = 'w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  return (
    <div className="space-y-6">
      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-sm p-3 rounded-xl border border-emerald-200">
          <Check className="w-4 h-4" /> تم حفظ الإعدادات — جاري إعادة التحميل...
        </div>
      )}

      {/* Logo Upload */}
      <div>
        <label className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Image className="w-4 h-4" /> شعار المتجر
        </label>
        <div className="flex items-center gap-4">
          {form.logo_url ? (
            <div className="relative">
              <img src={form.logo_url} alt="logo" className="w-20 h-20 object-contain rounded-xl border bg-white p-2" />
              <button onClick={() => setForm(f => ({ ...f, logo_url: null }))}
                className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
              <Building2 className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-50">
              {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingLogo ? 'جاري الرفع...' : 'رفع الشعار'}
            </button>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG — حتى 2MB</p>
            {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
          </div>
        </div>
      </div>

      {/* Brand Color */}
      <div>
        <label className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4" /> لون النظام
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COLORS.map(c => (
            <button key={c.value} onClick={() => setForm(f => ({ ...f, primary_color: c.value }))}
              title={c.label}
              className={cn('w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
                form.primary_color === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent')}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color || '#6366f1'}
              onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-8 h-8 rounded-full border-2 border-border cursor-pointer bg-transparent p-0.5" />
            <span className="text-xs text-muted-foreground">مخصص</span>
          </div>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: form.primary_color }}>ش</div>
          <button className="px-3 py-1.5 text-white text-xs rounded-lg font-medium"
            style={{ backgroundColor: form.primary_color }}>زر رئيسي</button>
          <span className="text-xs font-medium" style={{ color: form.primary_color }}>رابط ملون</span>
        </div>
      </div>

      {/* Business Info */}
      <div>
        <label className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4" /> بيانات المتجر
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الاسم بالعربي</label>
            <input value={form.name_ar || ''} onChange={set('name_ar')} placeholder="اسم المتجر" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Store Name</label>
            <input value={form.name || ''} onChange={set('name')} placeholder="Store name" className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">رقم الهاتف</label>
            <input value={form.phone || ''} onChange={set('phone')} placeholder="+966 5X XXX XXXX" className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الرقم الضريبي</label>
            <input value={form.tax_number || ''} onChange={set('tax_number')} placeholder="VAT Number" className={inputCls} dir="ltr" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">العنوان</label>
            <input value={form.address || ''} onChange={set('address')} placeholder="عنوان المتجر" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Receipt Customization */}
      <div>
        <label className="text-sm font-semibold mb-3 block">تخصيص الفاتورة / الإيصال</label>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">رأس الإيصال (اختياري)</label>
            <input value={form.receipt_header || ''} onChange={set('receipt_header')} placeholder="نص يظهر أعلى الإيصال" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">تذييل الإيصال</label>
            <input value={form.receipt_footer || ''} onChange={set('receipt_footer')} placeholder="شكراً لزيارتكم" className={inputCls} />
          </div>
        </div>

        {/* Receipt preview */}
        <div className="mt-3 border rounded-xl p-4 bg-white dark:bg-card text-center text-xs space-y-1 font-mono">
          {form.logo_url && <img src={form.logo_url} alt="logo" className="w-10 h-10 object-contain mx-auto mb-1" />}
          <p className="font-bold text-sm">{form.name_ar || 'اسم المتجر'}</p>
          {form.phone && <p className="text-muted-foreground">{form.phone}</p>}
          {form.receipt_header && <p className="text-muted-foreground italic">{form.receipt_header}</p>}
          <div className="border-t border-dashed my-2" />
          <p className="text-muted-foreground">... بنود الفاتورة ...</p>
          <div className="border-t border-dashed my-2" />
          {form.receipt_footer && <p className="text-muted-foreground">{form.receipt_footer}</p>}
          {form.tax_number && <p className="text-muted-foreground">الرقم الضريبي: {form.tax_number}</p>}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving || saved}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ!' : 'حفظ الهوية البصرية'}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Database, Plus, X, ChevronDown, ChevronUp, Search, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CustomAccount {
  code: string
  name: string
  type: string
}

interface ChartOfAccountsSetupProps {
  template: string
  onTemplateChange: (template: string) => void
  customAccounts: CustomAccount[]
  onCustomAccountsChange: (accounts: CustomAccount[]) => void
  className?: string
}

interface AccountTemplate {
  name: string
  description: string
  accounts: { type: string; code: string; name: string }[]
}

const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: 'asset', label: 'أصل' },
  { value: 'liability', label: 'خصم' },
  { value: 'equity', label: 'حقوق ملكية' },
  { value: 'revenue', label: 'إيراد' },
  { value: 'expense', label: 'مصروف' },
]

const ACCOUNT_TEMPLATES: Record<string, AccountTemplate> = {
  simple: {
    name: 'مبسط',
    description: 'دليل حسابات مبسط يحتوي على 30 حساباً',
    accounts: [
      { type: 'الأصول', code: '1100', name: 'نقدية' },
      { type: 'الأصول', code: '1200', name: 'بنوك' },
      { type: 'الأصول', code: '1300', name: 'عملاء' },
      { type: 'الأصول', code: '1400', name: 'مخزون' },
      { type: 'الأصول', code: '1500', name: 'أصول ثابتة' },
      { type: 'الخصوم', code: '2100', name: 'موردون' },
      { type: 'الخصوم', code: '2200', name: 'ضرائب مستحقة' },
      { type: 'الخصوم', code: '2300', name: 'قروض' },
      { type: 'حقوق الملكية', code: '3100', name: 'رأس المال' },
      { type: 'حقوق الملكية', code: '3200', name: 'أرباح مبقاة' },
      { type: 'الإيرادات', code: '4100', name: 'إيرادات مبيعات' },
      { type: 'الإيرادات', code: '4200', name: 'إيرادات أخرى' },
      { type: 'المصروفات', code: '5100', name: 'رواتب' },
      { type: 'المصروفات', code: '5200', name: 'إيجار' },
      { type: 'المصروفات', code: '5300', name: 'كهرباء' },
      { type: 'المصروفات', code: '5400', name: 'مصاريف تشغيل' },
    ],
  },
  medium: {
    name: 'متوسط',
    description: 'دليل حسابات متوسط يحتوي على 80 حساباً',
    accounts: [
      { type: 'الأصول', code: '1100', name: 'نقدية' },
      { type: 'الأصول', code: '1110', name: 'صندوق صغير' },
      { type: 'الأصول', code: '1200', name: 'بنوك' },
      { type: 'الأصول', code: '1210', name: 'بنك - جاري' },
      { type: 'الأصول', code: '1220', name: 'بنك - استثمار' },
      { type: 'الأصول', code: '1300', name: 'عملاء' },
      { type: 'الأصول', code: '1310', name: 'أوراق قبض' },
      { type: 'الأصول', code: '1400', name: 'مخزون' },
      { type: 'الأصول', code: '1410', name: 'مخزون مواد خام' },
      { type: 'الأصول', code: '1420', name: 'مخزون تام' },
      { type: 'الأصول', code: '1500', name: 'أصول ثابتة' },
      { type: 'الأصول', code: '1510', name: 'مباني' },
      { type: 'الأصول', code: '1520', name: 'معدات' },
      { type: 'الخصوم', code: '2100', name: 'موردون' },
      { type: 'الخصوم', code: '2110', name: 'أوراق دفع' },
      { type: 'الخصوم', code: '2200', name: 'ضرائب مستحقة' },
      { type: 'الخصوم', code: '2210', name: 'ضريبة دخل' },
      { type: 'الخصوم', code: '2220', name: 'ضريبة مبيعات' },
      { type: 'الخصوم', code: '2300', name: 'قروض' },
      { type: 'الخصوم', code: '2310', name: 'قروض قصيرة الأجل' },
      { type: 'الخصوم', code: '2320', name: 'قروض طويلة الأجل' },
      { type: 'حقوق الملكية', code: '3100', name: 'رأس المال' },
      { type: 'حقوق الملكية', code: '3200', name: 'أرباح مبقاة' },
      { type: 'حقوق الملكية', code: '3300', name: 'احتياطيات' },
      { type: 'الإيرادات', code: '4100', name: 'إيرادات مبيعات' },
      { type: 'الإيرادات', code: '4110', name: 'مبيعات المنتج أ' },
      { type: 'الإيرادات', code: '4120', name: 'مبيعات المنتج ب' },
      { type: 'الإيرادات', code: '4200', name: 'إيرادات أخرى' },
      { type: 'المصروفات', code: '5100', name: 'رواتب' },
      { type: 'المصروفات', code: '5110', name: 'رواتب إدارية' },
      { type: 'المصروفات', code: '5120', name: 'رواتب مبيعات' },
      { type: 'المصروفات', code: '5200', name: 'إيجار' },
      { type: 'المصروفات', code: '5300', name: 'كهرباء' },
      { type: 'المصروفات', code: '5310', name: 'ماء' },
      { type: 'المصروفات', code: '5400', name: 'مصاريف تشغيل' },
    ],
  },
  advanced: {
    name: 'متقدم',
    description: 'دليل حسابات متقدم يحتوي على 150+ حساباً',
    accounts: [
      { type: 'الأصول', code: '1100', name: 'نقدية' },
      { type: 'الأصول', code: '1110', name: 'صندوق صغير' },
      { type: 'الأصول', code: '1120', name: 'شيكات تحت التحصيل' },
      { type: 'الأصول', code: '1200', name: 'بنوك' },
      { type: 'الأصول', code: '1210', name: 'بنك - جاري' },
      { type: 'الأصول', code: '1220', name: 'بنك - استثمار' },
      { type: 'الأصول', code: '1230', name: 'بنك - ودائع' },
      { type: 'الأصول', code: '1300', name: 'عملاء' },
      { type: 'الأصول', code: '1310', name: 'أوراق قبض' },
      { type: 'الأصول', code: '1320', name: 'مخصص ديون مشكوك فيها' },
      { type: 'الأصول', code: '1400', name: 'مخزون' },
      { type: 'الأصول', code: '1410', name: 'مخزون مواد خام' },
      { type: 'الأصول', code: '1420', name: 'مخزون تحت التشغيل' },
      { type: 'الأصول', code: '1430', name: 'مخزون تام' },
      { type: 'الأصول', code: '1440', name: 'مخصص هبوط المخزون' },
      { type: 'الأصول', code: '1500', name: 'أصول ثابتة' },
      { type: 'الأصول', code: '1510', name: 'مباني' },
      { type: 'الأصول', code: '1520', name: 'معدات' },
      { type: 'الأصول', code: '1530', name: 'مركبات' },
      { type: 'الأصول', code: '1540', name: 'أثاث' },
      { type: 'الأصول', code: '1550', name: 'مجمع إهلاك المباني' },
      { type: 'الأصول', code: '1560', name: 'مجمع إهلاك المعدات' },
      { type: 'الأصول', code: '1600', name: 'أصول غير ملموسة' },
      { type: 'الأصول', code: '1610', name: 'شهرة' },
      { type: 'الخصوم', code: '2100', name: 'موردون' },
      { type: 'الخصوم', code: '2110', name: 'أوراق دفع' },
      { type: 'الخصوم', code: '2120', name: 'مصروفات مستحقة' },
      { type: 'الخصوم', code: '2200', name: 'ضرائب مستحقة' },
      { type: 'الخصوم', code: '2210', name: 'ضريبة دخل' },
      { type: 'الخصوم', code: '2220', name: 'ضريبة مبيعات' },
      { type: 'الخصوم', code: '2230', name: 'تأمينات اجتماعية' },
      { type: 'الخصوم', code: '2300', name: 'قروض' },
      { type: 'الخصوم', code: '2310', name: 'قروض قصيرة الأجل' },
      { type: 'الخصوم', code: '2320', name: 'قروض طويلة الأجل' },
      { type: 'الخصوم', code: '2400', name: 'إيرادات مؤجلة' },
      { type: 'حقوق الملكية', code: '3100', name: 'رأس المال' },
      { type: 'حقوق الملكية', code: '3200', name: 'أرباح مبقاة' },
      { type: 'حقوق الملكية', code: '3300', name: 'احتياطيات' },
      { type: 'حقوق الملكية', code: '3400', name: 'أرباح/خسائر السنة' },
      { type: 'الإيرادات', code: '4100', name: 'إيرادات مبيعات' },
      { type: 'الإيرادات', code: '4110', name: 'مبيعات المنتج أ' },
      { type: 'الإيرادات', code: '4120', name: 'مبيعات المنتج ب' },
      { type: 'الإيرادات', code: '4130', name: 'مبيعات المنتج ج' },
      { type: 'الإيرادات', code: '4140', name: 'مردودات المبيعات' },
      { type: 'الإيرادات', code: '4200', name: 'إيرادات أخرى' },
      { type: 'الإيرادات', code: '4210', name: 'إيرادات إيجار' },
      { type: 'الإيرادات', code: '4220', name: 'إيرادات استثمار' },
      { type: 'المصروفات', code: '5100', name: 'رواتب' },
      { type: 'المصروفات', code: '5110', name: 'رواتب إدارية' },
      { type: 'المصروفات', code: '5120', name: 'رواتب مبيعات' },
      { type: 'المصروفات', code: '5130', name: 'مكافآت' },
      { type: 'المصروفات', code: '5200', name: 'إيجار' },
      { type: 'المصروفات', code: '5210', name: 'إيجار مباني' },
      { type: 'المصروفات', code: '5220', name: 'إيجار معدات' },
      { type: 'المصروفات', code: '5300', name: 'كهرباء' },
      { type: 'المصروفات', code: '5310', name: 'ماء' },
      { type: 'المصروفات', code: '5320', name: 'اتصالات' },
      { type: 'المصروفات', code: '5400', name: 'مصاريف تشغيل' },
      { type: 'المصروفات', code: '5410', name: 'صيانة' },
      { type: 'المصروفات', code: '5420', name: 'تأمين' },
      { type: 'المصروفات', code: '5430', name: 'إهلاك' },
      { type: 'المصروفات', code: '5500', name: 'مصاريف تسويق' },
      { type: 'المصروفات', code: '5510', name: 'إعلان' },
    ],
  },
}

const TYPE_GROUP_LABELS: Record<string, string> = {
  'الأصول': 'الأصول',
  'الخصوم': 'الخصوم',
  'حقوق الملكية': 'حقوق الملكية',
  'الإيرادات': 'الإيرادات',
  'المصروفات': 'المصروفات',
}

const TYPE_GROUP_COLORS: Record<string, string> = {
  'الأصول': 'text-blue-600 bg-blue-50 border-blue-200',
  'الخصوم': 'text-red-600 bg-red-50 border-red-200',
  'حقوق الملكية': 'text-purple-600 bg-purple-50 border-purple-200',
  'الإيرادات': 'text-green-600 bg-green-50 border-green-200',
  'المصروفات': 'text-orange-600 bg-orange-50 border-orange-200',
}

export function ChartOfAccountsSetup({
  template,
  onTemplateChange,
  customAccounts,
  onCustomAccountsChange,
  className,
}: ChartOfAccountsSetupProps) {
  const [expanded, setExpanded] = useState(true)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('expense')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedTemplate = ACCOUNT_TEMPLATES[template]

  if (!selectedTemplate) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)} dir="rtl">
        <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">لم يتم اختيار قالب</p>
        <p className="text-xs mt-1">يرجى اختيار قالب دليل حسابات من الخيارات أعلاه</p>
      </div>
    )
  }

  const allAccounts = [
    ...selectedTemplate.accounts,
    ...customAccounts.map((a) => ({
      type: ACCOUNT_TYPES.find((t) => t.value === a.type)?.label || a.type,
      code: a.code,
      name: a.name,
      custom: true as const,
    })),
  ]

  const filtered = searchQuery
    ? allAccounts.filter(
        (a) =>
          a.code.includes(searchQuery) ||
          a.name.includes(searchQuery)
      )
    : allAccounts

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {})

  const handleAddAccount = () => {
    setError(null)

    if (!newCode.trim()) {
      setError('رمز الحساب مطلوب')
      return
    }

    if (!newName.trim()) {
      setError('اسم الحساب مطلوب')
      return
    }

    if (!/^\d{4}$/.test(newCode.trim())) {
      setError('رمز الحساب يجب أن يكون 4 أرقام')
      return
    }

    const exists = allAccounts.some((a) => a.code === newCode.trim())
    if (exists) {
      setError('رمز الحساب موجود مسبقاً')
      return
    }

    onCustomAccountsChange([
      ...customAccounts,
      { code: newCode.trim(), name: newName.trim(), type: newType },
    ])
    setNewCode('')
    setNewName('')
    setNewType('expense')
  }

  const handleRemoveAccount = (index: number) => {
    onCustomAccountsChange(customAccounts.filter((_, i) => i !== index))
  }

  const templateKeys = Object.keys(ACCOUNT_TEMPLATES)

  return (
    <div className={cn('w-full space-y-6', className)} dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">دليل الحسابات</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        اختر قالب دليل الحسابات المناسب لشركتك، يمكنك إضافة حسابات مخصصة لاحقاً
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templateKeys.map((key) => {
          const tmpl = ACCOUNT_TEMPLATES[key]
          const isSelected = template === key
          return (
            <button
              key={key}
              onClick={() => onTemplateChange(key)}
              className={cn(
                'text-right border-2 rounded-xl p-5 transition-all hover:shadow-md',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                  )}
                >
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                </div>
                <Database className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <h4 className="font-bold text-base mb-1">{tmpl.name}</h4>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tmpl.description}</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {tmpl.accounts.length} حساب
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full p-4 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            معاينة الحسابات ({allAccounts.length})
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                placeholder="بحث عن حساب بالرمز أو الاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir="rtl"
              />
            </div>

            {Object.keys(grouped).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد نتائج للبحث</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([type, accts]) => (
                  <div key={type}>
                    <h4
                      className={cn(
                        'text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block border',
                        TYPE_GROUP_COLORS[type] || 'text-muted-foreground bg-muted border-border'
                      )}
                    >
                      {TYPE_GROUP_LABELS[type] || type} ({accts.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {accts.map((a, i) => {
                        const isCustom = 'custom' in a && !!a.custom
                        return (
                          <div
                            key={`${a.code}-${i}`}
                            className={cn(
                              'flex items-center gap-2 text-xs p-2 rounded-md border transition-colors',
                              isCustom
                                ? 'bg-primary/5 border-primary/20'
                                : 'bg-muted/30 border-transparent'
                            )}
                          >
                            <span className="font-mono font-medium text-primary w-10 shrink-0">{a.code}</span>
                            <span className="truncate">{a.name}</span>
                            {isCustom && (
                              <button
                                onClick={() => {
                                  const idx = customAccounts.findIndex(
                                    (ca) => ca.code === a.code && ca.name === a.name
                                  )
                                  if (idx >= 0) handleRemoveAccount(idx)
                                }}
                                className="mr-auto text-destructive hover:text-destructive/80 shrink-0"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {customAccounts.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    حسابات مخصصة: {customAccounts.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border rounded-xl p-5">
        <h4 className="text-sm font-semibold mb-1">إضافة حساب مخصص</h4>
        <p className="text-xs text-muted-foreground mb-4">أضف حسابات إضافية غير موجودة في القالب</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">رمز الحساب</label>
            <input
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors font-mono"
              placeholder="6100"
              value={newCode}
              onChange={(e) => { setNewCode(e.target.value); setError(null) }}
              dir="rtl"
              maxLength={4}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">اسم الحساب</label>
            <input
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              placeholder="مصاريف إدارية"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(null) }}
              dir="rtl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">نوع الحساب</label>
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Button
              size="sm"
              className="w-full gap-1"
              onClick={handleAddAccount}
            >
              <Plus className="h-4 w-4" />
              إضافة
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 mt-3 text-sm text-destructive bg-destructive/5 px-3 py-2 rounded-lg">
            <X className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {customAccounts.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t pt-4">
            <span className="text-xs text-muted-foreground font-medium">الحسابات المخصصة المضافة:</span>
            {customAccounts.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm p-2 rounded-lg bg-primary/5 border border-primary/10"
              >
                <span className="font-mono text-primary font-medium">{a.code}</span>
                <span>{a.name}</span>
                <span className="text-xs text-muted-foreground">({ACCOUNT_TYPES.find(t => t.value === a.type)?.label || a.type})</span>
                <button
                  onClick={() => handleRemoveAccount(i)}
                  className="mr-auto text-destructive hover:text-destructive/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

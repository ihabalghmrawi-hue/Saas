'use client'

import { useState, useMemo, useCallback, useReducer } from 'react'
import { cn } from '@/lib/utils'
import {
  Building2, CheckCircle2, Circle, ArrowLeft, ArrowRight,
  Save, FileText, Calendar, Users, Package, Wallet,
  Globe, Upload, Check, AlertTriangle, Loader2,
  Plus, X, Search, ChevronDown, ChevronUp, Download, Database, Settings, Rocket
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'

interface CustomAccount {
  code: string
  name: string
  type: string
}

interface Warehouse {
  name: string
  location: string
  type: string
  capacity: string
}

interface WizardState {
  step: number
  company: {
    name: string
    taxId: string
    crNumber: string
    address: string
    phone: string
    email: string
    logo: string | null
  }
  financial: {
    fiscalYearStart: string
    currency: string
    vatRate: string
    standards: string
    periods: string
  }
  accounts: {
    template: string
    customAccounts: CustomAccount[]
  }
  warehouses: Warehouse[]
  importData: {
    customers: boolean
    suppliers: boolean
    employees: boolean
    balances: boolean
  }
  confirmed: boolean
}

type WizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_COMPANY'; payload: Partial<WizardState['company']> }
  | { type: 'UPDATE_FINANCIAL'; payload: Partial<WizardState['financial']> }
  | { type: 'SET_TEMPLATE'; payload: string }
  | { type: 'ADD_CUSTOM_ACCOUNT'; payload: CustomAccount }
  | { type: 'REMOVE_CUSTOM_ACCOUNT'; payload: number }
  | { type: 'ADD_WAREHOUSE'; payload: Warehouse }
  | { type: 'REMOVE_WAREHOUSE'; payload: number }
  | { type: 'UPDATE_WAREHOUSE'; payload: { index: number; value: Partial<Warehouse> } }
  | { type: 'UPDATE_IMPORT'; payload: Partial<WizardState['importData']> }
  | { type: 'SET_CONFIRMED'; payload: boolean }
  | { type: 'RESET' }

const initialState: WizardState = {
  step: 1,
  company: { name: '', taxId: '', crNumber: '', address: '', phone: '', email: '', logo: null },
  financial: { fiscalYearStart: '', currency: 'SAR', vatRate: '15', standards: 'ifrs', periods: '12' },
  accounts: { template: 'simple', customAccounts: [] },
  warehouses: [],
  importData: { customers: false, suppliers: false, employees: false, balances: false },
  confirmed: false,
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }
    case 'UPDATE_COMPANY':
      return { ...state, company: { ...state.company, ...action.payload } }
    case 'UPDATE_FINANCIAL':
      return { ...state, financial: { ...state.financial, ...action.payload } }
    case 'SET_TEMPLATE':
      return { ...state, accounts: { ...state.accounts, template: action.payload } }
    case 'ADD_CUSTOM_ACCOUNT':
      return { ...state, accounts: { ...state.accounts, customAccounts: [...state.accounts.customAccounts, action.payload] } }
    case 'REMOVE_CUSTOM_ACCOUNT':
      return { ...state, accounts: { ...state.accounts, customAccounts: state.accounts.customAccounts.filter((_, i) => i !== action.payload) } }
    case 'ADD_WAREHOUSE':
      return { ...state, warehouses: [...state.warehouses, action.payload] }
    case 'REMOVE_WAREHOUSE':
      return { ...state, warehouses: state.warehouses.filter((_, i) => i !== action.payload) }
    case 'UPDATE_WAREHOUSE':
      return {
        ...state,
        warehouses: state.warehouses.map((w, i) =>
          i === action.payload.index ? { ...w, ...action.payload.value } : w
        )
      }
    case 'UPDATE_IMPORT':
      return { ...state, importData: { ...state.importData, ...action.payload } }
    case 'SET_CONFIRMED':
      return { ...state, confirmed: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const ACCOUNT_TEMPLATES = {
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
    ]
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
    ]
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
    ]
  }
}

const WAREHOUSE_TYPES = [
  { value: 'general', label: 'عام' },
  { value: 'cold', label: 'مبرد' },
  { value: 'hazardous', label: 'مواد خطرة' },
  { value: 'raw', label: 'مواد خام' },
  { value: 'finished', label: 'منتجات تامة' },
]

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'أصل' },
  { value: 'liability', label: 'خصم' },
  { value: 'equity', label: 'حقوق ملكية' },
  { value: 'revenue', label: 'إيراد' },
  { value: 'expense', label: 'مصروف' },
]

const CURRENCIES = [
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'AED', label: 'درهم إماراتي (AED)' },
  { value: 'QAR', label: 'ريال قطري (QAR)' },
  { value: 'KWD', label: 'دينار كويتي (KWD)' },
  { value: 'OMR', label: 'ريال عماني (OMR)' },
  { value: 'BHD', label: 'دينار بحريني (BHD)' },
  { value: 'EGP', label: 'جنيه مصري (EGP)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
  { value: 'EUR', label: 'يورو (EUR)' },
]

const STANDARDS = [
  { value: 'ifrs', label: 'المعايير الدولية (IFRS)' },
  { value: 'socpa', label: 'الهيئة السعودية (SOCPA)' },
  { value: 'gaap', label: 'مبادئ المحاسبة (GAAP)' },
  { value: 'local', label: 'محلي' },
]

const MONTHS = [
  { value: '1', label: 'يناير' },
  { value: '2', label: 'فبراير' },
  { value: '3', label: 'مارس' },
  { value: '4', label: 'أبريل' },
  { value: '5', label: 'مايو' },
  { value: '6', label: 'يونيو' },
  { value: '7', label: 'يوليو' },
  { value: '8', label: 'أغسطس' },
  { value: '9', label: 'سبتمبر' },
  { value: '10', label: 'أكتوبر' },
  { value: '11', label: 'نوفمبر' },
  { value: '12', label: 'ديسمبر' },
]

function validateEmail(email: string): string {
  if (!email) return ''
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'البريد الإلكتروني غير صالح'
  return ''
}

function validatePhone(phone: string): string {
  if (!phone) return ''
  const re = /^[\d\s\+\-\(\)]{7,20}$/
  if (!re.test(phone)) return 'رقم الهاتف غير صالح'
  return ''
}

interface StepIndicatorProps {
  current: number
  total: number
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="text-sm text-muted-foreground mb-2">
      الخطوة {current} من {total}
    </div>
  )
}

interface ProgressBarProps {
  current: number
  total: number
}

function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round(((current - 1) / total) * 100)
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium">اكتمال الإعداد: {pct}%</span>
        <span className="text-muted-foreground">{current}/{total}</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface StepNavButtonsProps {
  onPrevious?: () => void
  onNext?: () => void
  isFirst: boolean
  isLast: boolean
  canNext: boolean
  nextLabel?: string
  loading?: boolean
}

function StepNavButtons({ onPrevious, onNext, isFirst, isLast, canNext, nextLabel, loading }: StepNavButtonsProps) {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={isFirst}
        className="gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        السابق
      </Button>
      {isLast ? (
        <Button
          onClick={onNext}
          disabled={!canNext}
          loading={loading}
          className="gap-2"
        >
          {loading ? 'جاري الحفظ...' : 'إنهاء الإعداد'}
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={onNext}
          disabled={!canNext}
          className="gap-2"
        >
          التالي
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function CompanyStep({ data, onChange, errors, onLogoUpload }: {
  data: WizardState['company']
  onChange: (val: Partial<WizardState['company']>) => void
  errors: Record<string, string>
  onLogoUpload: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">معلومات الشركة</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">أدخل البيانات الأساسية للشركة</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">اسم الشركة *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.name ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="أدخل اسم الشركة"
            dir="rtl"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">الرقم الضريبي *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.taxId ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.taxId}
            onChange={(e) => onChange({ taxId: e.target.value })}
            placeholder="أدخل الرقم الضريبي"
            dir="rtl"
          />
          {errors.taxId && <p className="text-sm text-destructive">{errors.taxId}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">رقم السجل التجاري *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.crNumber ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.crNumber}
            onChange={(e) => onChange({ crNumber: e.target.value })}
            placeholder="أدخل رقم السجل التجاري"
            dir="rtl"
          />
          {errors.crNumber && <p className="text-sm text-destructive">{errors.crNumber}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">الهاتف *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.phone ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="أدخل رقم الهاتف"
            dir="rtl"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">البريد الإلكتروني *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.email ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="info@company.com"
            dir="rtl"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">العنوان *</label>
          <input
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.address ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="أدخل عنوان الشركة"
            dir="rtl"
          />
          {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">شعار الشركة</label>
        <div
          onClick={onLogoUpload}
          className={cn(
            'flex flex-col items-center justify-center h-32 w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            data.logo ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 bg-muted/30'
          )}
        >
          {data.logo ? (
            <div className="flex flex-col items-center gap-2">
              <img src={data.logo} alt="شعار الشركة" className="h-16 w-16 object-contain rounded" />
              <span className="text-xs text-muted-foreground">انقر لتغيير الشعار</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">انقر لرفع شعار الشركة</span>
              <span className="text-xs text-muted-foreground">PNG, JPG - حد أقصى 2MB</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FinancialStep({ data, onChange, errors }: {
  data: WizardState['financial']
  onChange: (val: Partial<WizardState['financial']>) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">الإعدادات المالية</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">اضبط الإعدادات المالية الأساسية للشركة</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">شهر بدء السنة المالية *</label>
          <select
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.fiscalYearStart ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.fiscalYearStart}
            onChange={(e) => onChange({ fiscalYearStart: e.target.value })}
          >
            <option value="" disabled>اختر الشهر</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {errors.fiscalYearStart && <p className="text-sm text-destructive">{errors.fiscalYearStart}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">العملة الأساسية *</label>
          <select
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.currency ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.currency && <p className="text-sm text-destructive">{errors.currency}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">نسبة ضريبة القيمة المضافة (%) *</label>
          <input
            type="number"
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.vatRate ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.vatRate}
            onChange={(e) => onChange({ vatRate: e.target.value })}
            placeholder="15"
            min="0"
            max="100"
            dir="rtl"
          />
          {errors.vatRate && <p className="text-sm text-destructive">{errors.vatRate}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">المعايير المحاسبية *</label>
          <select
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.standards ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.standards}
            onChange={(e) => onChange({ standards: e.target.value })}
          >
            {STANDARDS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {errors.standards && <p className="text-sm text-destructive">{errors.standards}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">عدد الفترات المحاسبية *</label>
          <select
            className={cn(
              'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              errors.periods ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
            value={data.periods}
            onChange={(e) => onChange({ periods: e.target.value })}
          >
            <option value="12">12 فترة (شهرية)</option>
            <option value="6">6 فترات (نصف سنوية)</option>
            <option value="4">4 فترات (ربع سنوية)</option>
            <option value="2">2 فترة (نصف سنوية)</option>
            <option value="1">1 فترة (سنوية)</option>
          </select>
          {errors.periods && <p className="text-sm text-destructive">{errors.periods}</p>}
        </div>
      </div>
    </div>
  )
}

function Checkbox({ label, checked, onChange, id }: {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
  id: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
      <div
        className={cn(
          'flex items-center justify-center h-5 w-5 rounded border-2 transition-colors',
          checked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 group-hover:border-primary/60'
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}

function ImportStep({ data, onChange }: {
  data: WizardState['importData']
  onChange: (val: Partial<WizardState['importData']>) => void
}) {
  const [files, setFiles] = useState<Record<string, string | null>>({
    customers: null,
    suppliers: null,
    employees: null,
    balances: null,
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">استيراد البيانات</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">اختر البيانات التي ترغب في استيرادها</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-3">
          <Checkbox
            id="import-customers"
            label="العملاء"
            checked={data.customers}
            onChange={(v) => onChange({ customers: v })}
          />
          {data.customers && (
            <div className="pr-7 space-y-2">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Download className="h-3 w-3" />
                تحميل نموذج العملاء (CSV)
              </button>
              <div className="flex items-center gap-2 p-2 rounded border border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{files.customers || 'انقر لرفع ملف العملاء'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <Checkbox
            id="import-suppliers"
            label="الموردين"
            checked={data.suppliers}
            onChange={(v) => onChange({ suppliers: v })}
          />
          {data.suppliers && (
            <div className="pr-7 space-y-2">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Download className="h-3 w-3" />
                تحميل نموذج الموردين (CSV)
              </button>
              <div className="flex items-center gap-2 p-2 rounded border border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{files.suppliers || 'انقر لرفع ملف الموردين'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <Checkbox
            id="import-employees"
            label="الموظفين"
            checked={data.employees}
            onChange={(v) => onChange({ employees: v })}
          />
          {data.employees && (
            <div className="pr-7 space-y-2">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Download className="h-3 w-3" />
                تحميل نموذج الموظفين (CSV)
              </button>
              <div className="flex items-center gap-2 p-2 rounded border border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{files.employees || 'انقر لرفع ملف الموظفين'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <Checkbox
            id="import-balances"
            label="الأرصدة الافتتاحية"
            checked={data.balances}
            onChange={(v) => onChange({ balances: v })}
          />
          {data.balances && (
            <div className="pr-7 space-y-2">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Download className="h-3 w-3" />
                تحميل نموذج الأرصدة (CSV)
              </button>
              <div className="flex items-center gap-2 p-2 rounded border border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{files.balances || 'انقر لرفع ملف الأرصدة'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ state }: { state: WizardState }) {
  const selectedTemplate = ACCOUNT_TEMPLATES[state.accounts.template as keyof typeof ACCOUNT_TEMPLATES]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">مراجعة وتأكيد</h2>
      </div>
      <p className="text-sm text-muted-foreground">يرجى مراجعة جميع البيانات قبل التأكيد</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">معلومات الشركة</h3>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">الاسم:</dt><dd>{state.company.name || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">الرقم الضريبي:</dt><dd>{state.company.taxId || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">السجل التجاري:</dt><dd>{state.company.crNumber || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">الهاتف:</dt><dd>{state.company.phone || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">البريد:</dt><dd>{state.company.email || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">العنوان:</dt><dd>{state.company.address || '—'}</dd></div>
          </dl>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">الإعدادات المالية</h3>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">بداية السنة:</dt><dd>{MONTHS.find(m => m.value === state.financial.fiscalYearStart)?.label || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">العملة:</dt><dd>{CURRENCIES.find(c => c.value === state.financial.currency)?.label || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">الضريبة:</dt><dd>{state.financial.vatRate}%</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">المعايير:</dt><dd>{STANDARDS.find(s => s.value === state.financial.standards)?.label || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">الفترات:</dt><dd>{state.financial.periods} فترات</dd></div>
          </dl>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">دليل الحسابات</h3>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">القالب:</dt><dd>{selectedTemplate?.name || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">عدد الحسابات:</dt><dd>{(selectedTemplate?.accounts?.length || 0) + state.accounts.customAccounts.length}</dd></div>
            {state.accounts.customAccounts.length > 0 && (
              <div className="flex justify-between"><dt className="text-muted-foreground">حسابات مخصصة:</dt><dd>{state.accounts.customAccounts.length}</dd></div>
            )}
          </dl>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">المستودعات</h3>
          </div>
          {state.warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم يتم إضافة أي مستودعات</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {state.warehouses.map((w, i) => (
                <li key={i} className="flex justify-between">
                  <span>{w.name}</span>
                  <span className="text-muted-foreground">{w.type === 'general' ? 'عام' : w.type === 'cold' ? 'مبرد' : w.type === 'hazardous' ? 'مواد خطرة' : w.type === 'raw' ? 'مواد خام' : w.type === 'finished' ? 'منتجات تامة' : w.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">استيراد البيانات</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className={cn('px-2 py-1 rounded', state.importData.customers ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>العملاء</span>
          <span className={cn('px-2 py-1 rounded', state.importData.suppliers ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>الموردين</span>
          <span className={cn('px-2 py-1 rounded', state.importData.employees ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>الموظفين</span>
          <span className={cn('px-2 py-1 rounded', state.importData.balances ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>الأرصدة الافتتاحية</span>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
        <label className="flex items-start gap-3 cursor-pointer">
          <div
            className={cn(
              'flex items-center justify-center h-5 w-5 rounded border-2 mt-0.5 shrink-0 transition-colors',
              state.confirmed
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40'
            )}
          >
            {state.confirmed && <Check className="h-3.5 w-3.5" />}
          </div>
          <input
            type="checkbox"
            checked={state.confirmed}
            onChange={() => {}}
            className="sr-only"
          />
          <span className="text-sm">
            أؤكد أن جميع البيانات المدخلة صحيحة وأوافق على الشروط والأحكام
          </span>
        </label>
      </div>
    </div>
  )
}

function WarehouseStep({ warehouses, onAdd, onRemove, onUpdate, errors }: {
  warehouses: Warehouse[]
  onAdd: (w: Warehouse) => void
  onRemove: (i: number) => void
  onUpdate: (i: number, v: Partial<Warehouse>) => void
  errors: Record<string, string>
}) {
  const [newWarehouse, setNewWarehouse] = useState<Warehouse>({ name: '', location: '', type: 'general', capacity: '' })

  const handleAdd = () => {
    if (!newWarehouse.name.trim()) return
    onAdd({ ...newWarehouse })
    setNewWarehouse({ name: '', location: '', type: 'general', capacity: '' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Package className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">المستودعات</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">أضف المستودعات الخاصة بشركتك</p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-1">
          <label className="text-xs font-medium">اسم المستودع *</label>
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newWarehouse.name}
            onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
            placeholder="المستودع الرئيسي"
            dir="rtl"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">الموقع</label>
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newWarehouse.location}
            onChange={(e) => setNewWarehouse({ ...newWarehouse, location: e.target.value })}
            placeholder="الرياض"
            dir="rtl"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">النوع</label>
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newWarehouse.type}
            onChange={(e) => setNewWarehouse({ ...newWarehouse, type: e.target.value })}
          >
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">السعة</label>
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newWarehouse.capacity}
            onChange={(e) => setNewWarehouse({ ...newWarehouse, capacity: e.target.value })}
            placeholder="1000 م²"
            dir="rtl"
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleAdd}
            disabled={!newWarehouse.name.trim()}
            size="sm"
            className="w-full gap-1"
          >
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
      </div>

      {warehouses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">لم يتم إضافة أي مستودعات بعد</p>
          <p className="text-xs">يمكنك إضافة مستودع واحد أو أكثر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {warehouses.map((w, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 grid grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">الاسم</span>
                  <span>{w.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">الموقع</span>
                  <span>{w.location || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">النوع</span>
                  <span>{WAREHOUSE_TYPES.find(t => t.value === w.type)?.label || w.type}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">السعة</span>
                  <span>{w.capacity || '—'}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemove(i)} className="text-destructive shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CompanySetupWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [accountsExpanded, setAccountsExpanded] = useState(true)

  const totalSteps = 6
  const step = state.step

  const validateStep = useCallback((s: number): boolean => {
    const newErrors: Record<string, string> = {}
    switch (s) {
      case 1: {
        if (!state.company.name.trim()) newErrors.name = 'اسم الشركة مطلوب'
        if (!state.company.taxId.trim()) newErrors.taxId = 'الرقم الضريبي مطلوب'
        if (!state.company.crNumber.trim()) newErrors.crNumber = 'رقم السجل التجاري مطلوب'
        if (!state.company.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب'
        else {
          const phoneErr = validatePhone(state.company.phone)
          if (phoneErr) newErrors.phone = phoneErr
        }
        if (!state.company.email.trim()) newErrors.email = 'البريد الإلكتروني مطلوب'
        else {
          const emailErr = validateEmail(state.company.email)
          if (emailErr) newErrors.email = emailErr
        }
        if (!state.company.address.trim()) newErrors.address = 'العنوان مطلوب'
        break
      }
      case 2: {
        if (!state.financial.fiscalYearStart) newErrors.fiscalYearStart = 'شهر بدء السنة المالية مطلوب'
        if (!state.financial.currency) newErrors.currency = 'العملة الأساسية مطلوبة'
        if (!state.financial.vatRate) newErrors.vatRate = 'نسبة ضريبة القيمة المضافة مطلوبة'
        else if (isNaN(Number(state.financial.vatRate)) || Number(state.financial.vatRate) < 0 || Number(state.financial.vatRate) > 100)
          newErrors.vatRate = 'يجب أن تكون النسبة بين 0 و 100'
        if (!state.financial.standards) newErrors.standards = 'المعايير المحاسبية مطلوبة'
        if (!state.financial.periods) newErrors.periods = 'عدد الفترات مطلوب'
        break
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [state])

  const handleNext = useCallback(() => {
    if (!validateStep(step)) return
    if (step < totalSteps) {
      dispatch({ type: 'SET_STEP', payload: step + 1 })
    } else if (step === totalSteps) {
      handleFinish()
    }
  }, [step, validateStep])

  const handlePrevious = useCallback(() => {
    if (step > 1) {
      dispatch({ type: 'SET_STEP', payload: step - 1 })
      setErrors({})
    }
  }, [step])

  const handleFinish = useCallback(() => {
    if (!state.confirmed) return
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
    }, 2000)
  }, [state.confirmed])

  const handleLogoUpload = useCallback(() => {
    dispatch({ type: 'UPDATE_COMPANY', payload: { logo: '/logo-placeholder.png' } })
  }, [])

  const stepIcons = [Building2, Wallet, Database, Package, FileText, Rocket]
  const stepLabels = ['معلومات الشركة', 'الإعدادات المالية', 'دليل الحسابات', 'المستودعات', 'استيراد البيانات', 'مراجعة وتأكيد']

  return (
    <div className="w-full max-w-4xl mx-auto" dir="rtl">
      <EnterpriseBreadcrumbs
        items={[
          { label: 'الرئيسية', href: '/dashboard' },
          { label: 'الإعداد' },
          { label: stepLabels[step - 1] },
        ]}
        className="mb-4"
      />

      <ProgressBar current={step} total={totalSteps} />
      <StepIndicator current={step} total={totalSteps} />

      <div className="flex gap-6 mb-6">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1
          const isActive = stepNum === step
          const isComplete = stepNum < step
          const Icon = stepIcons[i]
          return (
            <button
              key={i}
              onClick={() => { if (isComplete) dispatch({ type: 'SET_STEP', payload: stepNum }) }}
              className={cn(
                'flex items-center gap-2 text-sm transition-colors',
                isActive ? 'text-primary font-medium' : isComplete ? 'text-primary/70 hover:text-primary cursor-pointer' : 'text-muted-foreground cursor-default'
              )}
              disabled={!isComplete && !isActive}
            >
              <div className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full border-2 transition-colors',
                isComplete ? 'bg-primary border-primary text-primary-foreground' : isActive ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
              )}>
                {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className="hidden md:inline">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="border rounded-xl bg-card p-6 shadow-sm">
        {step === 1 && (
          <CompanyStep
            data={state.company}
            onChange={(v) => dispatch({ type: 'UPDATE_COMPANY', payload: v })}
            errors={errors}
            onLogoUpload={handleLogoUpload}
          />
        )}

        {step === 2 && (
          <FinancialStep
            data={state.financial}
            onChange={(v) => dispatch({ type: 'UPDATE_FINANCIAL', payload: v })}
            errors={errors}
          />
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold">دليل الحسابات</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">اختر قالب دليل الحسابات المناسب لشركتك</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(ACCOUNT_TEMPLATES).map(([key, tmpl]) => {
                const isSelected = state.accounts.template === key
                return (
                  <button
                    key={key}
                    onClick={() => dispatch({ type: 'SET_TEMPLATE', payload: key })}
                    className={cn(
                      'text-right border rounded-lg p-4 transition-all hover:shadow-md',
                      isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-input hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn(
                        'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold mb-1">{tmpl.name}</h3>
                    <p className="text-xs text-muted-foreground">{tmpl.description}</p>
                    <p className="text-xs text-primary mt-2">{tmpl.accounts.length} حساب</p>
                  </button>
                )
              })}
            </div>

            <div className="border rounded-lg">
              <button
                onClick={() => setAccountsExpanded(!accountsExpanded)}
                className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
              >
                <span>معاينة الحسابات</span>
                {accountsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {accountsExpanded && (
                <div className="px-3 pb-3">
                  {(() => {
                    const template = ACCOUNT_TEMPLATES[state.accounts.template as keyof typeof ACCOUNT_TEMPLATES]
                    const grouped = template.accounts.reduce<Record<string, typeof template.accounts>>((acc, a) => {
                      if (!acc[a.type]) acc[a.type] = []
                      acc[a.type].push(a)
                      return acc
                    }, {})
                    return Object.entries(grouped).map(([type, accts]) => (
                      <div key={type} className="mb-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{type}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                          {accts.map((a) => (
                            <div key={a.code} className="text-xs p-1.5 rounded bg-muted/50 flex gap-2">
                              <span className="font-mono text-primary">{a.code}</span>
                              <span>{a.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                  {state.accounts.customAccounts.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">حسابات مخصصة</h4>
                      <div className="space-y-1">
                        {state.accounts.customAccounts.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-primary/5">
                            <span className="font-mono text-primary">{a.code}</span>
                            <span>{a.name}</span>
                            <span className="text-muted-foreground">({ACCOUNT_TYPES.find(t => t.value === a.type)?.label || a.type})</span>
                            <button onClick={() => dispatch({ type: 'REMOVE_CUSTOM_ACCOUNT', payload: i })} className="mr-auto text-destructive hover:text-destructive/80">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">إضافة حساب مخصص</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">رمز الحساب *</label>
                  <input
                    id="new-account-code"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="6100"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">اسم الحساب *</label>
                  <input
                    id="new-account-name"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="مصاريف إدارية"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">نوع الحساب</label>
                  <select
                    id="new-account-type"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => {
                      const codeInput = document.getElementById('new-account-code') as HTMLInputElement
                      const nameInput = document.getElementById('new-account-name') as HTMLInputElement
                      const typeInput = document.getElementById('new-account-type') as HTMLSelectElement
                      const code = codeInput?.value?.trim()
                      const name = nameInput?.value?.trim()
                      const type = typeInput?.value
                      if (!code || !name) return
                      const exists = state.accounts.customAccounts.some(a => a.code === code)
                      if (exists) return
                      dispatch({ type: 'ADD_CUSTOM_ACCOUNT', payload: { code, name, type } })
                      codeInput.value = ''
                      nameInput.value = ''
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    إضافة
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <WarehouseStep
            warehouses={state.warehouses}
            onAdd={(w) => dispatch({ type: 'ADD_WAREHOUSE', payload: w })}
            onRemove={(i) => dispatch({ type: 'REMOVE_WAREHOUSE', payload: i })}
            onUpdate={(i, v) => dispatch({ type: 'UPDATE_WAREHOUSE', payload: { index: i, value: v } })}
            errors={{}}
          />
        )}

        {step === 5 && (
          <ImportStep
            data={state.importData}
            onChange={(v) => dispatch({ type: 'UPDATE_IMPORT', payload: v })}
          />
        )}

        {step === 6 && (
          <ReviewStep state={state} />
        )}

        <StepNavButtons
          onPrevious={handlePrevious}
          onNext={handleNext}
          isFirst={step === 1}
          isLast={step === totalSteps}
          canNext={step === totalSteps ? state.confirmed : true}
          loading={submitting}
        />
      </div>
    </div>
  )
}

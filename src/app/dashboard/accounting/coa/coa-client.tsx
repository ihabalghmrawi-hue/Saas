'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, Plus, Edit2, Eye, EyeOff,
  RefreshCw, Loader2, AlertCircle, CheckCircle, X, List,
} from 'lucide-react'

interface Account {
  id:              string
  code:            string
  name:            string
  name_ar:         string
  type:            string
  subtype?:        string
  parent_id?:      string | null
  level:           number
  is_postable:     boolean
  is_header:       boolean
  normal_balance:  string
  current_balance: number
  account_group?:  string
  is_active:       boolean
  is_system?:      boolean
  description?:    string
  children?:       Account[]
}

const TYPE_COLORS: Record<string, string> = {
  asset:     'text-blue-700 bg-blue-50 border-blue-200',
  liability: 'text-orange-700 bg-orange-50 border-orange-200',
  equity:    'text-purple-700 bg-purple-50 border-purple-200',
  revenue:   'text-green-700 bg-green-50 border-green-200',
  cogs:      'text-yellow-700 bg-yellow-50 border-yellow-200',
  expense:   'text-red-700 bg-red-50 border-red-200',
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
  revenue: 'إيرادات', cogs: 'تكلفة', expense: 'مصروفات',
}

function formatBalance(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AccountNodeProps {
  account: Account
  depth:   number
  onEdit:  (account: Account) => void
  onToggle: (id: string, is_active: boolean) => void
}

function AccountNode({ account, depth, onEdit, onToggle }: AccountNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = account.children && account.children.length > 0
  const typeColor   = TYPE_COLORS[account.type] || 'text-gray-600 bg-gray-50 border-gray-200'

  const levelStyles = [
    'text-base font-bold text-gray-900',
    'text-sm font-semibold text-gray-800',
    'text-sm font-normal text-gray-700',
  ][Math.min(depth, 2)] || 'text-sm text-gray-700'

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg group transition-colors ${
          !account.is_active ? 'opacity-50' : ''
        }`}
        style={{ paddingRight: `${12 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded ${
            hasChildren ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'cursor-default'
          }`}
        >
          {hasChildren
            ? expanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            : <span className="w-4 h-4 border-r-2 border-b-2 border-gray-200 rounded-br inline-block opacity-0 group-hover:opacity-100" />
          }
        </button>

        {/* Code */}
        <span className="font-mono text-xs text-blue-700 w-12 flex-shrink-0">{account.code}</span>

        {/* Name */}
        <span className={`flex-1 ${levelStyles}`}>
          {account.name_ar}
          {account.name !== account.name_ar && (
            <span className="text-xs text-gray-400 mr-2 font-normal">({account.name})</span>
          )}
        </span>

        {/* Type badge */}
        <span className={`hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${typeColor} flex-shrink-0`}>
          {TYPE_LABELS[account.type] || account.type}
        </span>

        {/* Balance (postable accounts only) */}
        {account.is_postable && (
          <span className={`text-xs font-medium w-28 text-left flex-shrink-0 ${
            account.current_balance < 0 ? 'text-red-600' : 'text-gray-700'
          }`}>
            {formatBalance(account.current_balance)}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!account.is_system && (
            <button
              onClick={() => onEdit(account)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="تعديل"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onToggle(account.id, account.is_active)}
            className={`p-1 rounded ${account.is_active
              ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title={account.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
          >
            {account.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {account.children!.map(child => (
            <AccountNode
              key={child.id}
              account={child}
              depth={depth + 1}
              onEdit={onEdit}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CoaClient({
  tree, flatAccounts, isEmpty, company_id, currency,
}: {
  tree:         Account[]
  flatAccounts: Account[]
  isEmpty:      boolean
  company_id:   string
  currency:     string
}) {
  const [accounts, setAccounts]     = useState<Account[]>(tree)
  const [showModal, setShowModal]   = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [loading, setLoading]       = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  const [form, setForm] = useState({
    code:           '',
    name:           '',
    name_ar:        '',
    type:           'asset' as string,
    normal_balance: 'debit' as string,
    parent_id:      '',
    description:    '',
    account_group:  '',
  })

  function openAddModal() {
    setEditAccount(null)
    setForm({ code: '', name: '', name_ar: '', type: 'asset', normal_balance: 'debit', parent_id: '', description: '', account_group: '' })
    setShowModal(true)
    setError(null)
  }

  function openEditModal(account: Account) {
    setEditAccount(account)
    setForm({
      code:           account.code,
      name:           account.name,
      name_ar:        account.name_ar,
      type:           account.type,
      normal_balance: account.normal_balance,
      parent_id:      account.parent_id || '',
      description:    account.description || '',
      account_group:  account.account_group || '',
    })
    setShowModal(true)
    setError(null)
  }

  async function handleToggle(id: string, is_active: boolean) {
    try {
      await fetch('/api/accounting/coa', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body:    JSON.stringify({ id, is_active: !is_active }),
      })
      // Refresh
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleSeed() {
    setSeedLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/coa?seed=true', {
        headers: { 'x-tenant-id': company_id },
      })
      if (res.ok) {
        setSuccess('تم إنشاء دليل الحسابات الافتراضي بنجاح')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setError('فشل إنشاء دليل الحسابات')
      }
    } finally {
      setSeedLoading(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!form.code || !form.name || !form.type) {
      setError('رمز الحساب والاسم والنوع مطلوبة')
      return
    }
    setLoading(true)
    try {
      const isEdit = !!editAccount
      const res = await fetch('/api/accounting/coa', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body:    JSON.stringify(isEdit ? { id: editAccount!.id, ...form } : form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل حفظ الحساب')
      } else {
        setSuccess(isEdit ? 'تم تحديث الحساب' : 'تم إنشاء الحساب')
        setShowModal(false)
        setTimeout(() => { setSuccess(null); window.location.reload() }, 1200)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">شجرة الحسابات</h1>
          <p className="text-sm text-gray-500 mt-1">دليل الحسابات المحاسبية للشركة</p>
        </div>
        <div className="flex items-center gap-2">
          {isEmpty && (
            <button
              onClick={handleSeed}
              disabled={seedLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <List className="h-4 w-4" />}
              إنشاء الدليل الافتراضي
            </button>
          )}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            حساب جديد
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="mr-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`inline-flex items-center px-2 py-1 rounded border text-xs ${cls}`}>
            {TYPE_LABELS[type]}
          </span>
        ))}
        <span className="text-xs text-gray-400 self-center mr-2">
          * العمود الأيسر: الرصيد الحالي (للحسابات القابلة للترحيل فقط)
        </span>
      </div>

      {/* Table Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium">
          <span className="w-5" />
          <span className="w-12">رمز</span>
          <span className="flex-1">اسم الحساب</span>
          <span className="hidden md:block w-24">النوع</span>
          <span className="w-28 text-left">الرصيد</span>
          <span className="w-16">إجراءات</span>
        </div>

        {accounts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <List className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">لا يوجد دليل حسابات. اضغط "إنشاء الدليل الافتراضي"</p>
          </div>
        ) : (
          <div className="p-2">
            {accounts.map(account => (
              <AccountNode
                key={account.id}
                account={account}
                depth={0}
                onEdit={openEditModal}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editAccount ? 'تعديل حساب' : 'حساب جديد'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">رمز الحساب *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    disabled={!!editAccount?.is_system}
                    placeholder="مثال: 1101"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">نوع الحساب *</label>
                  <select
                    value={form.type}
                    onChange={e => {
                      const t = e.target.value
                      setForm(p => ({
                        ...p,
                        type:           t,
                        normal_balance: ['asset', 'cogs', 'expense'].includes(t) ? 'debit' : 'credit',
                      }))
                    }}
                    disabled={!!editAccount?.is_system}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  >
                    <option value="asset">أصول</option>
                    <option value="liability">خصوم</option>
                    <option value="equity">حقوق ملكية</option>
                    <option value="revenue">إيرادات</option>
                    <option value="cogs">تكلفة المبيعات</option>
                    <option value="expense">مصروفات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الاسم (عربي) *</label>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))}
                    placeholder="اسم الحساب بالعربية"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الاسم (إنجليزي)</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Account name in English"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الرصيد الطبيعي</label>
                  <select
                    value={form.normal_balance}
                    onChange={e => setForm(p => ({ ...p, normal_balance: e.target.value }))}
                    disabled={!!editAccount?.is_system}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  >
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الحساب الأب</label>
                  <select
                    value={form.parent_id}
                    onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">بدون حساب أب (مستوى أول)</option>
                    {flatAccounts.filter(a => !a.is_postable || a.is_header).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">الوصف</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="وصف اختياري للحساب"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {editAccount ? 'حفظ التعديلات' : 'إنشاء الحساب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

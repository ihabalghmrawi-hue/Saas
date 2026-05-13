'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Edit2, Trash2, CheckCircle, AlertCircle, X,
  RefreshCw, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'

interface Account {
  id: string; code: string; name: string; name_ar: string; type: string
}

interface PostingRuleLine {
  id?: string
  sequence: number
  debit_account_id?: string
  credit_account_id?: string
  condition_field?: string
  condition_operator?: string
  condition_value?: string
  amount_percent: number
  amount_fixed: number
  description?: string
}

interface PostingRule {
  id: string
  name: string
  name_ar?: string
  event_type: string
  description?: string
  is_active: boolean
  priority: number
  posting_rule_lines?: PostingRuleLine[]
}

const EVENT_TYPES = [
  'sale_cash', 'sale_credit', 'sale_cogs', 'sale_payment',
  'sale_return_cash', 'sale_return_credit', 'sale_return_cogs',
  'purchase_cash', 'purchase_credit', 'purchase_payment',
  'expense_cash', 'expense_accrual',
  'rental_revenue', 'inventory_adjustment',
  'customer_payment', 'supplier_payment',
  'payroll', 'treasury_transfer',
]

const EVENT_LABELS: Record<string, string> = {
  sale_cash: 'مبيعات نقدية', sale_credit: 'مبيعات آجلة', sale_cogs: 'تكلفة مبيعات',
  sale_payment: 'تحصيل', sale_return_cash: 'مرتجع نقدي', sale_return_credit: 'مرتجع آجل',
  purchase_cash: 'مشتريات نقدية', purchase_credit: 'مشتريات آجلة', purchase_payment: 'دفع مورد',
  expense_cash: 'مصروف نقدي', expense_accrual: 'مصروف مستحق',
  rental_revenue: 'إيراد تأجير', inventory_adjustment: 'تسوية مخزون',
  customer_payment: 'دفعة عميل', supplier_payment: 'دفعة مورد',
  payroll: 'رواتب', treasury_transfer: 'تحويل خزينة',
}

function emptyLine(): PostingRuleLine {
  return { sequence: 0, amount_percent: 100, amount_fixed: 0 }
}

export function PostingRulesClient({
  initialRules, accounts, company_id,
}: {
  initialRules: PostingRule[]
  accounts: Account[]
  company_id: string
}) {
  const [rules, setRules] = useState(initialRules)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    event_type: 'sale_cash',
    description: '',
    priority: 0,
    lines: [emptyLine(), emptyLine()] as PostingRuleLine[],
  })

  async function fetchRules() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/posting-rules', {
        headers: { 'x-tenant-id': company_id },
      })
      if (res.ok) {
        const data = await res.json()
        setRules(data.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditId(null)
    setForm({ name: '', name_ar: '', event_type: 'sale_cash', description: '', priority: 0, lines: [emptyLine(), emptyLine()] })
    setShowModal(true)
    setError(null)
  }

  function openEdit(rule: PostingRule) {
    setEditId(rule.id)
    setForm({
      name: rule.name,
      name_ar: rule.name_ar || '',
      event_type: rule.event_type,
      description: rule.description || '',
      priority: rule.priority,
      lines: (rule.posting_rule_lines || []).length > 0
        ? rule.posting_rule_lines!.map(l => ({ ...l }))
        : [emptyLine(), emptyLine()],
    })
    setShowModal(true)
    setError(null)
  }

  function updateLine(index: number, field: keyof PostingRuleLine, value: any) {
    setForm(prev => {
      const lines = [...prev.lines]
      lines[index] = { ...lines[index], [field]: value }
      return { ...prev, lines }
    })
  }

  function addLine() {
    setForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }))
  }

  function removeLine(index: number) {
    if (form.lines.length <= 2) return
    setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }))
  }

  async function handleToggle(id: string, is_active: boolean) {
    const res = await fetch('/api/accounting/posting-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    if (res.ok) await fetchRules()
  }

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذه القاعدة؟')) return
    await fetch(`/api/accounting/posting-rules?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': company_id },
    })
    await fetchRules()
  }

  async function handleSubmit() {
    setError(null)
    if (!form.name || !form.event_type) {
      setError('الاسم ونوع الحدث مطلوبان')
      return
    }
    setLoading(true)
    try {
      const method = editId ? 'PATCH' : 'POST'
      const body: any = editId
        ? { id: editId, name: form.name, name_ar: form.name_ar, description: form.description, priority: form.priority, is_active: true }
        : { name: form.name, name_ar: form.name_ar, event_type: form.event_type, description: form.description, priority: form.priority, lines: form.lines.filter(l => l.debit_account_id || l.credit_account_id) }

      const res = await fetch('/api/accounting/posting-rules', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل الحفظ')
      } else {
        setSuccess(editId ? 'تم تحديث القاعدة' : 'تم إنشاء القاعدة')
        setShowModal(false)
        await fetchRules()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">قواعد الترحيل</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة قواعد الترحيل المحاسبي للمعاملات</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus className="h-4 w-4" /> قاعدة جديدة
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /><span>{error}</span>
          <button onClick={() => setError(null)} className="mr-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="h-4 w-4" /><span>{success}</span>
        </div>
      )}

      <div className="grid gap-3">
        {rules.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p>لا توجد قواعد ترحيل. اضغط "قاعدة جديدة" لإنشاء أول قاعدة.</p>
          </div>
        ) : rules.map(rule => (
          <div key={rule.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{rule.name_ar || rule.name}</h3>
                  <p className="text-xs text-gray-500">
                    {EVENT_LABELS[rule.event_type] || rule.event_type}
                    {rule.description && ` — ${rule.description}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 ml-2">الأولوية: {rule.priority}</span>
                <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => handleToggle(rule.id, rule.is_active)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded">
                  {rule.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {rule.posting_rule_lines && rule.posting_rule_lines.length > 0 && (
              <div className="px-5 pb-4">
                <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-3 py-1.5 text-right">#</th>
                      <th className="px-3 py-1.5 text-right">حساب مدين</th>
                      <th className="px-3 py-1.5 text-right">حساب دائن</th>
                      <th className="px-3 py-1.5 text-left">%</th>
                      <th className="px-3 py-1.5 text-left">ثابت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rule.posting_rule_lines.map((line, i) => {
                      const dr = accounts.find(a => a.id === line.debit_account_id)
                      const cr = accounts.find(a => a.id === line.credit_account_id)
                      return (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-400">{line.sequence}</td>
                          <td className="px-3 py-1.5">{dr ? `${dr.code} - ${dr.name_ar}` : '—'}</td>
                          <td className="px-3 py-1.5">{cr ? `${cr.code} - ${cr.name_ar}` : '—'}</td>
                          <td className="px-3 py-1.5 text-left">{line.amount_percent}%</td>
                          <td className="px-3 py-1.5 text-left">{line.amount_fixed || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'تعديل قاعدة' : 'قاعدة ترحيل جديدة'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الاسم (عربي) *</label>
                  <input type="text" value={form.name_ar} onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الاسم (إنجليزي)</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">نوع الحدث *</label>
                  <select value={form.event_type}
                    onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}
                    disabled={!!editId}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                    {EVENT_TYPES.map(et => (
                      <option key={et} value={et}>{EVENT_LABELS[et] || et}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الأولوية</label>
                  <input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">الوصف</label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Lines */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                      <th className="px-3 py-2 text-right font-medium">#</th>
                      <th className="px-3 py-2 text-right font-medium w-48">حساب مدين</th>
                      <th className="px-3 py-2 text-right font-medium w-48">حساب دائن</th>
                      <th className="px-3 py-2 text-left font-medium w-20">%</th>
                      <th className="px-3 py-2 text-left font-medium w-24">مبلغ ثابت</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.lines.map((line, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.debit_account_id || ''}
                            onChange={e => updateLine(i, 'debit_account_id', e.target.value || undefined)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">—</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name_ar}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.credit_account_id || ''}
                            onChange={e => updateLine(i, 'credit_account_id', e.target.value || undefined)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">—</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name_ar}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={line.amount_percent}
                            onChange={e => updateLine(i, 'amount_percent', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={line.amount_fixed}
                            onChange={e => updateLine(i, 'amount_fixed', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeLine(i)} disabled={form.lines.length <= 2}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
                            <X className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <button onClick={addLine} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                    <Plus className="h-3 w-3" /> إضافة سطر
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">إلغاء</button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {editId ? 'حفظ التعديلات' : 'إنشاء القاعدة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

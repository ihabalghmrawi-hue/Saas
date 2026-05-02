'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'
import type { Category, Party, Wallet, Transaction } from '@/types/database'

interface TransactionFormProps {
  companyId: string
  currency: string
  categories: Category[]
  parties: Party[]
  wallets: Wallet[]
  initialData?: Transaction
}

export function TransactionForm({
  companyId,
  currency,
  categories,
  parties,
  wallets,
  initialData,
}: TransactionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    type: initialData?.type || 'expense' as 'income' | 'expense' | 'transfer',
    amount: initialData?.amount?.toString() || '',
    description: initialData?.description || '',
    description_ar: initialData?.description_ar || '',
    category_id: initialData?.category_id || '',
    party_id: initialData?.party_id || '',
    account_id: initialData?.account_id || '',
    transaction_date: initialData?.transaction_date || today,
    payment_method: initialData?.payment_method || 'cash',
    status: initialData?.status || 'completed',
    reference_number: initialData?.reference_number || '',
  })

  const filteredCategories = categories.filter(c =>
    c.type === form.type || c.type === 'both'
  )

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('الرجاء إدخال مبلغ صحيح')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const payload = {
      company_id: companyId,
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description || null,
      description_ar: form.description_ar || null,
      category_id: form.category_id || null,
      party_id: form.party_id || null,
      account_id: form.account_id || null,
      transaction_date: form.transaction_date,
      payment_method: form.payment_method,
      status: form.status,
      reference_number: form.reference_number || null,
      currency,
    }

    let result
    if (initialData) {
      result = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', initialData.id)
    } else {
      result = await supabase.from('transactions').insert(payload)
    }

    if (result.error) {
      setError('حدث خطأ أثناء حفظ المعاملة')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard/transactions')
      router.refresh()
    }, 1000)
  }

  if (success) {
    return (
      <div className="bg-card rounded-xl border p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="font-semibold text-foreground">تم حفظ القيد بنجاح!</h3>
        <p className="text-sm text-muted-foreground mt-1">جاري التوجيه...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border shadow-sm p-6 space-y-5">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Transaction Type */}
      <div>
        <label className="form-label">نوع القيد</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'income', label: 'قبض / دخل', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
            { value: 'expense', label: 'صرف / مصروف', color: 'border-red-200 bg-red-50 text-red-700' },
            { value: 'transfer', label: 'تحويل', color: 'border-blue-200 bg-blue-50 text-blue-700' },
          ].map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => update('type', value)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                form.type === value ? color + ' border-opacity-100' : 'border-input bg-background text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="form-label">المبلغ <span className="text-red-500">*</span></label>
        <div className="relative">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
            className="w-full border border-input bg-background rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
            dir="ltr"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            {currency}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">الوصف (عربي)</label>
          <input
            type="text"
            value={form.description_ar}
            onChange={(e) => update('description_ar', e.target.value)}
            placeholder="وصف المعاملة..."
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="form-label">Description (English)</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Transaction description..."
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            dir="ltr"
          />
        </div>
      </div>

      {/* Category & Party */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">الفئة</label>
          <select
            value={form.category_id}
            onChange={(e) => update('category_id', e.target.value)}
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">اختر الفئة</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name_ar || cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">الطرف</label>
          <select
            value={form.party_id}
            onChange={(e) => update('party_id', e.target.value)}
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">اختر الطرف</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_ar || p.name} ({p.type === 'customer' ? 'عميل' : 'مورد'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date & Payment Method */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">التاريخ</label>
          <input
            type="date"
            value={form.transaction_date}
            onChange={(e) => update('transaction_date', e.target.value)}
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            dir="ltr"
          />
        </div>
        <div>
          <label className="form-label">طريقة الدفع</label>
          <select
            value={form.payment_method}
            onChange={(e) => update('payment_method', e.target.value)}
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="cash">نقداً</option>
            <option value="bank">تحويل بنكي</option>
            <option value="card">بطاقة</option>
            <option value="check">شيك</option>
          </select>
        </div>
      </div>

      {/* Status & Reference */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">الحالة</label>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="completed">مكتملة</option>
            <option value="pending">معلقة</option>
            <option value="draft">مسودة</option>
          </select>
        </div>
        <div>
          <label className="form-label">رقم المرجع</label>
          <input
            type="text"
            value={form.reference_number}
            onChange={(e) => update('reference_number', e.target.value)}
            placeholder="INV-001"
            className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            dir="ltr"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            initialData ? 'تحديث القيد' : 'حفظ القيد'
          )}
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Building2, Smartphone, Plus, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Wallet as WalletType, Transaction } from '@/types/database'

interface WalletClientProps {
  wallets: WalletType[]
  recentTransactions: Transaction[]
  currency: string
  companyId: string
}

const walletIcons = { cash: Wallet, bank: Building2, digital: Smartphone }
const walletBg = {
  cash: 'from-emerald-500 to-emerald-600',
  bank: 'from-blue-500 to-blue-600',
  digital: 'from-purple-500 to-purple-600',
}

export function WalletClient({ wallets, recentTransactions, currency, companyId }: WalletClientProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(wallets[0] || null)
  const [form, setForm] = useState({
    name: '', name_ar: '', type: 'cash' as 'cash' | 'bank' | 'digital',
    currency, initial_balance: '0', bank_name: '', account_number: '',
  })

  const totalBalance = wallets.reduce((s, w) => s + Number(w.current_balance), 0)

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const balance = parseFloat(form.initial_balance) || 0
    await supabase.from('wallets').insert({
      company_id: companyId,
      name: form.name,
      name_ar: form.name_ar || null,
      type: form.type,
      currency: form.currency,
      initial_balance: balance,
      current_balance: balance,
      bank_name: form.bank_name || null,
      account_number: form.account_number || null,
    })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">الصندوق والمحافظ</h2>
          <p className="text-sm text-muted-foreground">إجمالي: {formatCurrency(totalBalance, currency)}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          محفظة جديدة
        </button>
      </div>

      {/* Add Wallet Form */}
      {showForm && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">إضافة محفظة جديدة</h3>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الاسم (عربي)</label>
                <input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})}
                  placeholder="الصندوق الرئيسي" required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="form-label">Name (English)</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Main Cash" required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">النوع</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="cash">نقدي</option>
                  <option value="bank">بنكي</option>
                  <option value="digital">رقمي</option>
                </select>
              </div>
              <div>
                <label className="form-label">الرصيد الابتدائي</label>
                <input type="number" value={form.initial_balance} onChange={e => setForm({...form, initial_balance: e.target.value})}
                  placeholder="0.00" step="0.01" min="0"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
              <div>
                <label className="form-label">العملة</label>
                <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="USD">USD</option><option value="SAR">SAR</option>
                  <option value="AED">AED</option><option value="EGP">EGP</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {form.type === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">اسم البنك</label>
                  <input value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})}
                    placeholder="اسم البنك"
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="form-label">رقم الحساب</label>
                  <input value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})}
                    placeholder="IBAN / رقم الحساب"
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors">إلغاء</button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ المحفظة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => {
          const Icon = walletIcons[wallet.type] || Wallet
          const grad = walletBg[wallet.type] || walletBg.cash
          const isSelected = selectedWallet?.id === wallet.id
          return (
            <button key={wallet.id} onClick={() => setSelectedWallet(wallet)}
              className={cn('text-right p-5 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md',
                isSelected ? 'ring-2 ring-primary border-primary/30' : 'bg-card')}>
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{wallet.type === 'cash' ? 'نقدي' : wallet.type === 'bank' ? 'بنكي' : 'رقمي'}</p>
                  <p className="font-semibold text-foreground">{wallet.name_ar || wallet.name}</p>
                </div>
                {wallet.is_default && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">افتراضي</span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground mt-3">{formatCurrency(wallet.current_balance, wallet.currency)}</p>
              {wallet.bank_name && <p className="text-xs text-muted-foreground mt-1">{wallet.bank_name}</p>}
            </button>
          )
        })}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-5 border-b">
          <h3 className="font-semibold text-foreground">حركة الصندوق</h3>
          <p className="text-xs text-muted-foreground mt-0.5">آخر المعاملات</p>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">لا توجد معاملات</div>
        ) : (
          <div className="divide-y">
            {recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  txn.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                  {txn.type === 'income'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {txn.description_ar || txn.description || (txn.type === 'income' ? 'دخل' : 'مصروف')}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</p>
                </div>
                <p className={cn('text-sm font-semibold shrink-0',
                  txn.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                  {txn.type === 'expense' ? '-' : '+'}{formatCurrency(txn.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Wallet, Building2, Smartphone, Plus, ArrowUpRight, ArrowDownRight, Loader2, Star, Trash2, CreditCard } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface WalletRow {
  id: string
  name: string
  name_ar: string
  type: 'cash' | 'bank' | 'digital'
  current_balance: number
  initial_balance: number
  is_default: boolean
  is_active: boolean
  bank_name?: string | null
  account_number?: string | null
}

interface TxnRow {
  id: string
  wallet_id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  description_ar?: string
  transaction_date: string
  payment_method?: string
  reference_type?: string
}

interface WalletClientProps {
  wallets: WalletRow[]
  recentTransactions: TxnRow[]
  currency: string
  companyId: string
}

type ModalMode = 'none' | 'create' | 'deposit' | 'withdrawal'

const walletIcons = { cash: Wallet, bank: Building2, digital: Smartphone }
const walletBg   = {
  cash:    'from-emerald-500 to-emerald-600',
  bank:    'from-blue-500    to-blue-600',
  digital: 'from-purple-500  to-purple-600',
}

const EMPTY_FORM = {
  name: '', name_ar: '', type: 'cash' as 'cash' | 'bank' | 'digital',
  initial_balance: '0', bank_name: '', account_number: '',
}
const EMPTY_TXN = { wallet_id: '', amount: '', description: '', payment_method: 'cash' }

export function WalletClient({ wallets: initial, recentTransactions: initialTxns, currency }: WalletClientProps) {
  const [wallets,  setWallets]  = useState<WalletRow[]>(initial)
  const [txns,     setTxns]     = useState<TxnRow[]>(initialTxns)
  const [modal,    setModal]    = useState<ModalMode>('none')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<WalletRow | null>(initial.find(w => w.is_default) || initial[0] || null)

  const [form,     setForm]     = useState(EMPTY_FORM)
  const [txnForm,  setTxnForm]  = useState(EMPTY_TXN)

  const totalBalance = wallets.reduce((s, w) => s + Number(w.current_balance), 0)

  const openTxnModal = (mode: 'deposit' | 'withdrawal', walletId?: string) => {
    setTxnForm({ ...EMPTY_TXN, wallet_id: walletId || selected?.id || '' })
    setError('')
    setModal(mode)
  }

  // ── Create wallet ─────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...form }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'حدث خطأ'); setLoading(false); return }
    setWallets(prev => [...prev, data])
    setSelected(data)
    setModal('none')
    setForm(EMPTY_FORM)
    setLoading(false)
  }

  // ── Deposit / Withdrawal ──────────────────────────────────────────────────────
  const handleTxn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:         modal,
        wallet_id:      txnForm.wallet_id,
        amount:         parseFloat(txnForm.amount),
        description:    txnForm.description,
        payment_method: txnForm.payment_method,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'حدث خطأ'); setLoading(false); return }

    // Update local balance
    setWallets(prev => prev.map(w =>
      w.id === txnForm.wallet_id ? { ...w, current_balance: data.new_balance } : w
    ))
    // Add to txn list
    const amt = parseFloat(txnForm.amount)
    setTxns(prev => [{
      id:               Date.now().toString(),
      wallet_id:        txnForm.wallet_id,
      type:             modal === 'deposit' ? 'income' : 'expense',
      amount:           amt,
      description:      txnForm.description || (modal === 'deposit' ? 'إيداع' : 'سحب'),
      description_ar:   txnForm.description || (modal === 'deposit' ? 'إيداع' : 'سحب'),
      transaction_date: new Date().toISOString().slice(0, 10),
      payment_method:   txnForm.payment_method,
      reference_type:   modal,
    }, ...prev])

    setModal('none')
    setTxnForm(EMPTY_TXN)
    setLoading(false)
  }

  // ── Set default wallet ────────────────────────────────────────────────────────
  const handleSetDefault = async (walletId: string) => {
    await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_default', wallet_id: walletId }),
    })
    setWallets(prev => prev.map(w => ({ ...w, is_default: w.id === walletId })))
  }

  // ── Delete wallet ─────────────────────────────────────────────────────────────
  const handleDelete = async (walletId: string) => {
    if (!confirm('هل تريد حذف هذا الصندوق؟')) return
    const res = await fetch('/api/wallet', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: walletId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setWallets(prev => prev.filter(w => w.id !== walletId))
    if (selected?.id === walletId) setSelected(wallets.find(w => w.id !== walletId) || null)
  }

  const filteredTxns = selected ? txns.filter(t => t.wallet_id === selected.id) : txns

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">الصناديق والمحافظ</h2>
          <p className="text-sm text-muted-foreground">
            الإجمالي: <span className="font-semibold text-foreground">{formatCurrency(totalBalance, currency)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openTxnModal('deposit')}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <ArrowUpRight className="w-4 h-4" />إيداع
          </button>
          <button onClick={() => openTxnModal('withdrawal')}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
            <ArrowDownRight className="w-4 h-4" />سحب
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setError(''); setModal('create') }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />صندوق جديد
          </button>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => {
          const Icon  = walletIcons[wallet.type] || Wallet
          const grad  = walletBg[wallet.type]    || walletBg.cash
          const isSel = selected?.id === wallet.id
          return (
            <div key={wallet.id}
              className={cn('relative text-right p-5 rounded-xl border bg-card transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer',
                isSel && 'ring-2 ring-primary border-primary/30')}
              onClick={() => setSelected(wallet)}>

              {/* Top-right actions */}
              <div className="absolute top-3 left-3 flex gap-1" onClick={e => e.stopPropagation()}>
                {!wallet.is_default && (
                  <button onClick={() => handleSetDefault(wallet.id)}
                    title="تعيين كافتراضي"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => openTxnModal('deposit', wallet.id)}
                  title="إيداع"
                  className="p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-muted-foreground hover:text-emerald-600 transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openTxnModal('withdrawal', wallet.id)}
                  title="سحب"
                  className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </button>
                {wallets.length > 1 && (
                  <button onClick={() => handleDelete(wallet.id)}
                    title="حذف"
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Icon */}
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm mb-3`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {wallet.type === 'cash' ? 'نقدي' : wallet.type === 'bank' ? 'بنكي' : 'رقمي'}
                  </p>
                  <p className="font-semibold text-foreground">{wallet.name_ar || wallet.name}</p>
                </div>
                {wallet.is_default && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                    افتراضي
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground mt-3">{formatCurrency(wallet.current_balance, currency)}</p>
              {wallet.bank_name && <p className="text-xs text-muted-foreground mt-1">{wallet.bank_name}</p>}
            </div>
          )
        })}

        {/* Add wallet card */}
        <button onClick={() => { setForm(EMPTY_FORM); setError(''); setModal('create') }}
          className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 min-h-[160px]">
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">إضافة صندوق</span>
        </button>
      </div>

      {/* Transactions for selected wallet */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">
              {selected ? `حركة: ${selected.name_ar || selected.name}` : 'جميع الحركات'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">آخر المعاملات</p>
          </div>
          {selected && (
            <button onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors">
              عرض الكل
            </button>
          )}
        </div>
        {filteredTxns.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">لا توجد معاملات</div>
        ) : (
          <div className="divide-y">
            {filteredTxns.map((txn) => (
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</p>
                    {txn.reference_type && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {txn.reference_type === 'sale' ? 'مبيعات' :
                         txn.reference_type === 'purchase' ? 'مشتريات' :
                         txn.reference_type === 'opening' ? 'رصيد افتتاحي' :
                         txn.reference_type === 'deposit' ? 'إيداع' :
                         txn.reference_type === 'withdrawal' ? 'سحب' : txn.reference_type}
                      </span>
                    )}
                  </div>
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

      {/* ── Modal: Create Wallet ──────────────────────────────────────────────── */}
      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border w-full max-w-md">
            <div className="p-6 border-b flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">إضافة صندوق جديد</h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1.5">الاسم (عربي)</label>
                  <input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})}
                    placeholder="الصندوق الرئيسي" required
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1.5">Name (English)</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Main Cash"
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1.5">النوع</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="cash">نقدي</option>
                    <option value="bank">بنكي</option>
                    <option value="digital">رقمي</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1.5">الرصيد الابتدائي</label>
                  <input type="number" value={form.initial_balance} onChange={e => setForm({...form, initial_balance: e.target.value})}
                    placeholder="0.00" step="0.01" min="0"
                    className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
                </div>
              </div>

              {form.type === 'bank' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1.5">اسم البنك</label>
                    <input value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})}
                      placeholder="اسم البنك"
                      className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1.5">رقم الحساب</label>
                    <input value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})}
                      placeholder="IBAN / رقم الحساب"
                      className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal('none')}
                  className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ الصندوق'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Deposit / Withdrawal ───────────────────────────────────────── */}
      {(modal === 'deposit' || modal === 'withdrawal') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border w-full max-w-md">
            <div className="p-6 border-b flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                modal === 'deposit' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                {modal === 'deposit'
                  ? <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                  : <ArrowDownRight className="w-5 h-5 text-red-600" />}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {modal === 'deposit' ? 'إيداع في الصندوق' : 'سحب من الصندوق'}
              </h3>
            </div>
            <form onSubmit={handleTxn} className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>}

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">الصندوق</label>
                <select value={txnForm.wallet_id} onChange={e => setTxnForm({...txnForm, wallet_id: e.target.value})}
                  required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">اختر الصندوق...</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name_ar || w.name} — {formatCurrency(w.current_balance, currency)}
                      {w.is_default ? ' (افتراضي)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">المبلغ</label>
                <input type="number" value={txnForm.amount} onChange={e => setTxnForm({...txnForm, amount: e.target.value})}
                  placeholder="0.00" step="0.01" min="0.01" required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-left" dir="ltr" />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">الوصف</label>
                <input value={txnForm.description} onChange={e => setTxnForm({...txnForm, description: e.target.value})}
                  placeholder={modal === 'deposit' ? 'سبب الإيداع...' : 'سبب السحب...'}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">طريقة الدفع</label>
                <div className="flex gap-2">
                  {[
                    { v: 'cash',     l: 'نقدي' },
                    { v: 'bank',     l: 'تحويل بنكي' },
                    { v: 'card',     l: 'بطاقة' },
                  ].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setTxnForm({...txnForm, payment_method: v})}
                      className={cn('flex-1 py-2 rounded-lg text-sm border transition-colors',
                        txnForm.payment_method === v
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-accent')}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal('none')}
                  className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={loading}
                  className={cn('flex-1 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-colors',
                    modal === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700')}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري...</> :
                   modal === 'deposit' ? 'تأكيد الإيداع' : 'تأكيد السحب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

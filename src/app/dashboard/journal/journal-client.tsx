'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, BookOpen, CheckCircle2, XCircle, BarChart3, Scale, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { JournalEntry, Account } from '@/types/database'

interface JournalClientProps {
  entries: JournalEntry[]
  accounts: Account[]
  companyId: string
  currency: string
}

interface EntryLine {
  account_id: string
  debit: string
  credit: string
  description: string
}

type Tab = 'journal' | 'income' | 'balance'

export function JournalClient({ entries, accounts, companyId, currency }: JournalClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('journal')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  // ── Compute account balances from journal lines ───────────────────────────────
  const accountBalances = useMemo(() => {
    const map: Record<string, { debit: number; credit: number }> = {}
    for (const entry of entries) {
      const lines = (entry as any).journal_entry_lines || []
      for (const line of lines) {
        if (!line.account_id) continue
        if (!map[line.account_id]) map[line.account_id] = { debit: 0, credit: 0 }
        map[line.account_id].debit  += Number(line.debit  || 0)
        map[line.account_id].credit += Number(line.credit || 0)
      }
    }
    return map
  }, [entries])

  // Net balance per account (debit-normal accounts: debit-credit; credit-normal: credit-debit)
  const netBalance = (account: Account) => {
    const b = accountBalances[account.id] || { debit: 0, credit: 0 }
    if (account.type === 'asset' || account.type === 'expense') return b.debit - b.credit
    return b.credit - b.debit
  }

  const today = new Date().toISOString().split('T')[0]
  const nextEntryNumber = `JE-${String(entries.length + 1).padStart(4, '0')}`

  const [form, setForm] = useState({
    entry_number: nextEntryNumber,
    date: today,
    description: '',
    description_ar: '',
    reference: '',
  })

  const [lines, setLines] = useState<EntryLine[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const addLine = () => {
    setLines([...lines, { account_id: '', debit: '', credit: '', description: '' }])
  }

  const removeLine = (i: number) => {
    if (lines.length <= 2) return
    setLines(lines.filter((_, idx) => idx !== i))
  }

  const updateLine = (i: number, field: keyof EntryLine, value: string) => {
    const updated = [...lines]
    updated[i] = { ...updated[i], [field]: value }
    // If setting debit, clear credit and vice versa
    if (field === 'debit' && value) updated[i].credit = ''
    if (field === 'credit' && value) updated[i].debit = ''
    setLines(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isBalanced) {
      setError('القيد غير متوازن - يجب أن يتساوى إجمالي المدين مع إجمالي الدائن')
      return
    }

    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
    if (validLines.length < 2) {
      setError('يجب إضافة سطرين على الأقل')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_number: form.entry_number,
        date: form.date,
        description: form.description_ar || form.description,
        description_ar: form.description_ar,
        reference: form.reference || null,
        status: 'posted',
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .select()
      .single()

    if (entryError || !entry) {
      setError('حدث خطأ أثناء حفظ القيد')
      setLoading(false)
      return
    }

    // Insert lines
    const linesPayload = validLines.map((l, i) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description || null,
      line_number: i + 1,
    }))

    await supabase.from('journal_entry_lines').insert(linesPayload)

    // Update account balances
    for (const line of validLines) {
      const account = accounts.find(a => a.id === line.account_id)
      if (!account) continue
      const debit = parseFloat(line.debit) || 0
      const credit = parseFloat(line.credit) || 0
      const balanceChange = account.normal_balance === 'debit'
        ? debit - credit
        : credit - debit

      await supabase
        .from('accounts')
        .update({ current_balance: account.current_balance + balanceChange })
        .eq('id', account.id)
    }

    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  const accountTypeLabels: Record<string, string> = {
    asset: 'أصول',
    liability: 'التزامات',
    equity: 'حقوق ملكية',
    revenue: 'إيرادات',
    expense: 'مصروفات',
  }

  const revenueAccounts = accounts.filter(a => a.type === 'revenue')
  const expenseAccounts = accounts.filter(a => a.type === 'expense')
  const assetAccounts   = accounts.filter(a => a.type === 'asset')
  const liabAccounts    = accounts.filter(a => a.type === 'liability')
  const equityAccounts  = accounts.filter(a => a.type === 'equity')

  const totalRevenue  = revenueAccounts.reduce((s, a) => s + netBalance(a), 0)
  const totalExpenses = expenseAccounts.reduce((s, a) => s + netBalance(a), 0)
  const netIncome     = totalRevenue - totalExpenses
  const totalAssets   = assetAccounts.reduce((s, a) => s + netBalance(a), 0)
  const totalLiab     = liabAccounts.reduce((s, a) => s + netBalance(a), 0)
  const totalEquity   = equityAccounts.reduce((s, a) => s + netBalance(a), 0) + netIncome

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">القيود والقوائم المحاسبية</h2>
          <p className="text-sm text-muted-foreground">القيد المزدوج — يتم التحديث تلقائياً مع كل عملية</p>
        </div>
        {tab === 'journal' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            قيد جديد
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {([
          { key: 'journal', label: 'دفتر اليومية',    icon: BookOpen    },
          { key: 'income',  label: 'قائمة الدخل',     icon: TrendingUp  },
          { key: 'balance', label: 'الميزانية العمومية', icon: Scale    },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Income Statement ─────────────────────────────────────────────────── */}
      {tab === 'income' && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-gradient-to-l from-emerald-50 to-transparent dark:from-emerald-900/10">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-foreground">قائمة الدخل</h3>
                <p className="text-xs text-muted-foreground">الإيرادات والمصروفات</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Revenues */}
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                الإيرادات
              </h4>
              <div className="space-y-1.5">
                {revenueAccounts.length === 0
                  ? <p className="text-xs text-muted-foreground pr-4">لا توجد حسابات إيرادات</p>
                  : revenueAccounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between pr-4 text-sm">
                      <span className="text-muted-foreground">{a.name_ar || a.name}</span>
                      <span className="font-medium">{formatCurrency(netBalance(a), currency)}</span>
                    </div>
                  ))}
              </div>
              <div className="flex items-center justify-between pr-4 mt-2 pt-2 border-t font-semibold text-sm">
                <span>إجمالي الإيرادات</span>
                <span className="text-emerald-600">{formatCurrency(totalRevenue, currency)}</span>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                المصروفات
              </h4>
              <div className="space-y-1.5">
                {expenseAccounts.length === 0
                  ? <p className="text-xs text-muted-foreground pr-4">لا توجد حسابات مصروفات</p>
                  : expenseAccounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between pr-4 text-sm">
                      <span className="text-muted-foreground">{a.name_ar || a.name}</span>
                      <span className="font-medium">{formatCurrency(netBalance(a), currency)}</span>
                    </div>
                  ))}
              </div>
              <div className="flex items-center justify-between pr-4 mt-2 pt-2 border-t font-semibold text-sm">
                <span>إجمالي المصروفات</span>
                <span className="text-red-600">{formatCurrency(totalExpenses, currency)}</span>
              </div>
            </div>

            {/* Net Income */}
            <div className={cn('rounded-xl p-4 flex items-center justify-between',
              netIncome >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
              <span className="font-bold text-foreground">صافي الدخل</span>
              <span className={cn('text-xl font-bold', netIncome >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {formatCurrency(netIncome, currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Balance Sheet ─────────────────────────────────────────────────────── */}
      {tab === 'balance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assets */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-blue-50 dark:bg-blue-900/10">
              <h3 className="font-bold text-blue-700 dark:text-blue-400">الأصول</h3>
            </div>
            <div className="p-4 space-y-1.5">
              {assetAccounts.length === 0
                ? <p className="text-xs text-muted-foreground">لا توجد حسابات أصول</p>
                : assetAccounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{a.name_ar || a.name}</span>
                    <span className="font-medium">{formatCurrency(netBalance(a), currency)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between mt-2 pt-2 border-t font-bold text-sm">
                <span>إجمالي الأصول</span>
                <span className="text-blue-600">{formatCurrency(totalAssets, currency)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities + Equity */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-orange-50 dark:bg-orange-900/10">
                <h3 className="font-bold text-orange-700 dark:text-orange-400">الالتزامات</h3>
              </div>
              <div className="p-4 space-y-1.5">
                {liabAccounts.length === 0
                  ? <p className="text-xs text-muted-foreground">لا توجد التزامات</p>
                  : liabAccounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{a.name_ar || a.name}</span>
                      <span className="font-medium">{formatCurrency(netBalance(a), currency)}</span>
                    </div>
                  ))}
                <div className="flex items-center justify-between mt-2 pt-2 border-t font-bold text-sm">
                  <span>إجمالي الالتزامات</span>
                  <span className="text-orange-600">{formatCurrency(totalLiab, currency)}</span>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-purple-50 dark:bg-purple-900/10">
                <h3 className="font-bold text-purple-700 dark:text-purple-400">حقوق الملكية</h3>
              </div>
              <div className="p-4 space-y-1.5">
                {equityAccounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{a.name_ar || a.name}</span>
                    <span className="font-medium">{formatCurrency(netBalance(a), currency)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">صافي الدخل المحتجز</span>
                  <span className={cn('font-medium', netIncome >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCurrency(netIncome, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t font-bold text-sm">
                  <span>إجمالي حقوق الملكية</span>
                  <span className="text-purple-600">{formatCurrency(totalEquity, currency)}</span>
                </div>
              </div>
            </div>

            {/* Balance check */}
            <div className={cn('rounded-xl p-3 flex items-center justify-between text-sm',
              Math.abs(totalAssets - (totalLiab + totalEquity)) < 1
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : 'bg-red-50 dark:bg-red-900/20')}>
              <span className="font-bold">الميزانية</span>
              <span className={cn('font-bold', Math.abs(totalAssets - (totalLiab + totalEquity)) < 1 ? 'text-emerald-600' : 'text-red-600')}>
                {Math.abs(totalAssets - (totalLiab + totalEquity)) < 1 ? 'متوازنة ✓' : `فرق: ${formatCurrency(Math.abs(totalAssets - (totalLiab + totalEquity)), currency)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Journal Entries ───────────────────────────────────────────────────── */}
      {tab === 'journal' && <>

      {/* New Entry Form */}
      {showForm && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            قيد يومية جديد
          </h3>

          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">رقم القيد</label>
                <input
                  value={form.entry_number}
                  onChange={(e) => setForm({ ...form, entry_number: e.target.value })}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="form-label">التاريخ</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="form-label">المرجع</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="اختياري"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="form-label">البيان</label>
              <input
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                placeholder="وصف القيد..."
                required
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Lines Table */}
            <div>
              <label className="form-label">السطور</label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground w-2/5">الحساب</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">البيان</th>
                      <th className="text-center py-2.5 px-3 font-medium text-muted-foreground w-28">مدين</th>
                      <th className="text-center py-2.5 px-3 font-medium text-muted-foreground w-28">دائن</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          <select
                            value={line.account_id}
                            onChange={(e) => updateLine(i, 'account_id', e.target.value)}
                            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded p-1"
                          >
                            <option value="">-- اختر الحساب --</option>
                            {['asset', 'liability', 'equity', 'revenue', 'expense'].map(type => (
                              <optgroup key={type} label={accountTypeLabels[type]}>
                                {accounts.filter(a => a.type === type).map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name_ar || a.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            placeholder="بيان..."
                            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded p-1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={line.debit}
                            onChange={(e) => updateLine(i, 'debit', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary rounded p-1 text-blue-600 font-medium"
                            dir="ltr"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={line.credit}
                            onChange={(e) => updateLine(i, 'credit', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary rounded p-1 text-red-600 font-medium"
                            dir="ltr"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t">
                      <td colSpan={2} className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={addLine}
                          className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة سطر
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-600 text-sm">
                        {formatCurrency(totalDebit, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-red-600 text-sm">
                        {formatCurrency(totalCredit, currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance Indicator */}
              <div className={cn(
                'mt-2 flex items-center gap-2 text-sm font-medium',
                isBalanced ? 'text-emerald-600' : totalDebit > 0 ? 'text-red-600' : 'text-muted-foreground'
              )}>
                {isBalanced ? (
                  <><CheckCircle2 className="w-4 h-4" /> القيد متوازن</>
                ) : totalDebit > 0 ? (
                  <><XCircle className="w-4 h-4" /> الفرق: {formatCurrency(Math.abs(totalDebit - totalCredit), currency)}</>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading || !isBalanced}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ القيد'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries List */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-semibold text-foreground">دفتر اليومية</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{entries.length} قيد مسجل</p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-medium">لا توجد قيود</p>
            <p className="text-sm text-muted-foreground mt-1">ابدأ بإضافة قيودك المحاسبية</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => {
              const lines = (entry as any).journal_entry_lines || []
              return (
                <div key={entry.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {entry.entry_number}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.date)}
                        </span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          entry.is_balanced
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {entry.is_balanced ? 'متوازن' : 'غير متوازن'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">
                        {entry.description_ar || entry.description}
                      </p>

                      {/* Lines Preview */}
                      <div className="space-y-1">
                        {lines.slice(0, 3).map((line: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground w-32 truncate font-mono">
                              {line.accounts?.code} - {line.accounts?.name_ar || line.accounts?.name}
                            </span>
                            {line.debit > 0 && (
                              <span className="text-blue-600 font-medium">
                                مدين: {formatCurrency(line.debit, currency)}
                              </span>
                            )}
                            {line.credit > 0 && (
                              <span className="text-red-600 font-medium mr-6">
                                دائن: {formatCurrency(line.credit, currency)}
                              </span>
                            )}
                          </div>
                        ))}
                        {lines.length > 3 && (
                          <p className="text-xs text-muted-foreground">+ {lines.length - 3} سطور أخرى</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 mr-4">
                      <p className="text-sm font-bold text-foreground">
                        {formatCurrency(entry.total_debit, currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">إجمالي القيد</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      </> /* end tab === 'journal' */ }

    </div>
  )
}

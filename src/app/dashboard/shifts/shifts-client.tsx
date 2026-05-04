'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, User, DollarSign, TrendingUp, Check, X, AlertCircle, Loader2, LogIn, LogOut, ChevronDown } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  shifts: any[]
  openShift: any | null
  currency: string
  companyId: string
}

export function ShiftsClient({ shifts: initialShifts, openShift: initialOpenShift, currency, companyId }: Props) {
  const router = useRouter()
  const [shifts, setShifts] = useState(initialShifts)
  const [openShift, setOpenShift] = useState(initialOpenShift)
  const [view, setView] = useState<'main' | 'open' | 'close'>('main')
  const [cashierName, setCashierName] = useState('')
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [closeResult, setCloseResult] = useState<any>(null)

  const handleOpen = async () => {
    if (!cashierName.trim()) { setError('أدخل اسم الكاشير'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashier_name: cashierName, opening_cash: parseFloat(openingCash) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOpenShift(data.shift)
      setShifts(prev => [data.shift, ...prev])
      setView('main')
      setCashierName(''); setOpeningCash('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (!openShift) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: openShift.id, closing_cash: parseFloat(closingCash) || 0, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCloseResult(data)
      setOpenShift(null)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const duration = openShift ? (() => {
    const ms = Date.now() - new Date(openShift.opened_at).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}س ${m}د`
  })() : ''

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الورديات</h1>
          <p className="text-sm text-muted-foreground">{shifts.length} وردية</p>
        </div>
      </div>

      {/* Active Shift Banner */}
      {openShift ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-green-800 dark:text-green-300">وردية مفتوحة</p>
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                  {openShift.cashier_name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                  بدأت {new Date(openShift.opened_at).toLocaleTimeString('ar-SA')} · {duration}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-green-600">رصيد الافتتاح</p>
                <p className="font-bold text-green-800 dark:text-green-300">{formatCurrency(openShift.opening_cash, currency)}</p>
              </div>
              <button
                onClick={() => { setView('close'); setError(''); setCloseResult(null) }}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                إغلاق الوردية
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-8 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground mb-4">لا توجد وردية مفتوحة</p>
          <button
            onClick={() => { setView('open'); setError('') }}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 mx-auto"
          >
            <LogIn className="w-4 h-4" />
            فتح وردية جديدة
          </button>
        </div>
      )}

      {/* OPEN SHIFT FORM */}
      {view === 'open' && (
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">فتح وردية جديدة</h2>
          <div>
            <label className="text-sm font-medium mb-1 block">اسم الكاشير *</label>
            <input
              type="text"
              value={cashierName}
              onChange={e => setCashierName(e.target.value)}
              placeholder="اسم الكاشير"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">رصيد الصندوق الافتتاحي</label>
            <input
              type="number"
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              placeholder="0.00"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-center font-bold text-lg"
              step="0.01" min="0"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleOpen} disabled={loading} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              فتح الوردية
            </button>
            <button onClick={() => setView('main')} className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent">إلغاء</button>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT FORM */}
      {view === 'close' && openShift && !closeResult && (
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">إغلاق الوردية</h2>
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الكاشير</span>
              <span className="font-medium">{openShift.cashier_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">رصيد الافتتاح</span>
              <span className="font-medium">{formatCurrency(openShift.opening_cash, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">مدة الوردية</span>
              <span className="font-medium">{duration}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">النقد الفعلي في الصندوق</label>
            <input
              type="number"
              value={closingCash}
              onChange={e => setClosingCash(e.target.value)}
              placeholder="0.00"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
              step="0.01" min="0"
              autoFocus
            />
          </div>

          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..." className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none bg-background" />

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleClose} disabled={loading} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-red-600 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              إغلاق الوردية
            </button>
            <button onClick={() => setView('main')} className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent">إلغاء</button>
          </div>
        </div>
      )}

      {/* CLOSE RESULT */}
      {closeResult && (
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="font-bold text-lg">تم إغلاق الوردية</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'إجمالي المبيعات', value: formatCurrency(closeResult.total_sales, currency), color: 'text-green-600' },
              { label: 'النقد المتوقع', value: formatCurrency(closeResult.expected_cash, currency), color: 'text-foreground' },
              { label: 'النقد الفعلي', value: formatCurrency(parseFloat(closingCash) || 0, currency), color: 'text-foreground' },
              { label: 'الفرق', value: formatCurrency(Math.abs(closeResult.difference), currency), color: closeResult.difference === 0 ? 'text-green-600' : closeResult.difference > 0 ? 'text-blue-600' : 'text-red-600' },
            ].map((row, i) => (
              <div key={i} className={cn('flex justify-between items-center py-2', i === 3 && 'border-t font-bold text-base')}>
                <span className={cn('text-sm', i < 3 ? 'text-muted-foreground' : '')}>{row.label}</span>
                <span className={cn('font-medium', row.color)}>{row.value}</span>
              </div>
            ))}
          </div>
          {closeResult.difference !== 0 && (
            <div className={cn('rounded-xl p-3 text-sm text-center font-medium',
              closeResult.difference > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
            )}>
              {closeResult.difference > 0 ? '↑ زيادة في الصندوق' : '↓ عجز في الصندوق'}: {formatCurrency(Math.abs(closeResult.difference), currency)}
            </div>
          )}
          <button onClick={() => { setView('main'); setCloseResult(null); router.refresh() }} className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90">
            حسناً
          </button>
        </div>
      )}

      {/* SHIFTS HISTORY */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm">سجل الورديات</div>
        {shifts.filter(s => s.status === 'closed').length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">لا توجد ورديات مغلقة بعد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">الكاشير</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">الافتتاح</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">المبيعات</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">النقد المتوقع</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">الفعلي</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">الفرق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shifts.filter(s => s.status === 'closed').map(shift => (
                <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{shift.cashier_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(shift.opened_at).toLocaleString('ar-SA')}</td>
                  <td className="px-4 py-2.5 text-green-600 font-medium">{formatCurrency(shift.total_sales || 0, currency)}</td>
                  <td className="px-4 py-2.5">{formatCurrency(shift.expected_cash || 0, currency)}</td>
                  <td className="px-4 py-2.5">{formatCurrency(shift.closing_cash || 0, currency)}</td>
                  <td className={cn('px-4 py-2.5 font-medium',
                    (shift.difference || 0) === 0 ? 'text-green-600' :
                    (shift.difference || 0) > 0 ? 'text-blue-600' : 'text-red-600'
                  )}>
                    {(shift.difference || 0) > 0 ? '+' : ''}{formatCurrency(shift.difference || 0, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Calendar, Check, Loader2, ChevronRight,
  User, Phone, StickyNote, Shirt, AlertCircle, CheckCircle2,
  ArrowRight, Banknote, Shield
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Dress {
  id: string; name: string; code: string; category: string
  size: string; color: string; rental_price: number; deposit: number; status: string; image_url?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  wedding: 'زفاف', evening: 'سهرة', casual: 'كاجوال', other: 'أخرى'
}
const CATEGORY_COLORS: Record<string, string> = {
  wedding: 'bg-pink-100 text-pink-700',
  evening: 'bg-purple-100 text-purple-700',
  casual:  'bg-blue-100 text-blue-700',
  other:   'bg-gray-100 text-gray-600',
}

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

export function FastBookingClient({ dresses, currency }: { dresses: Dress[]; currency: string }) {
  const router = useRouter()

  // Step 1: Dress + dates
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [selectedDress, setSelectedDress] = useState<Dress | null>(null)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(tomorrow)

  // Availability
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [checkingAvail, setCheckingAvail] = useState(false)

  // Step 2: Customer + confirm
  const [step, setStep] = useState<1 | 2>(1)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [depositPaid, setDepositPaid] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
  const totalPrice = selectedDress ? selectedDress.rental_price * days : 0
  const remaining = totalPrice - (parseFloat(amountPaid) || 0)

  const checkAvailability = useCallback(async () => {
    if (!startDate || !endDate) return
    setCheckingAvail(true)
    try {
      const res = await fetch(`/api/rentals/availability?start=${startDate}&end=${endDate}`)
      const data = await res.json()
      const map: Record<string, boolean> = {}
      if (Array.isArray(data)) data.forEach((r: any) => { map[r.dress_id] = r.available })
      setAvailability(map)
      // deselect if no longer available
      if (selectedDress && map[selectedDress.id] === false) setSelectedDress(null)
    } finally {
      setCheckingAvail(false)
    }
  }, [startDate, endDate, selectedDress])

  useEffect(() => { checkAvailability() }, [startDate, endDate])

  const filteredDresses = dresses.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || d.color?.toLowerCase().includes(q)
    const matchCat = !filterCat || d.category === filterCat
    return matchSearch && matchCat
  })

  const handleConfirm = async () => {
    if (!selectedDress || !customerName) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/rentals/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dress_id: selectedDress.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          start_date: startDate,
          end_date: endDate,
          deposit_paid: depositPaid,
          amount_paid: parseFloat(amountPaid) || 0,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      setTimeout(() => router.replace('/dashboard/rentals/bookings'), 1800)
    } catch (e: any) { setError(e.message) } finally { setSubmitting(false) }
  }

  // ─── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700">تم الحجز بنجاح!</h2>
          <p className="text-muted-foreground text-sm">{selectedDress?.name} · {customerName}</p>
          <p className="text-xs text-muted-foreground">جاري التوجيه...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" dir="rtl">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={() => router.back()} className="p-2 hover:bg-accent rounded-lg">
          <ArrowRight className="w-4 h-4" />
        </button>
        <h1 className="font-bold text-lg">حجز سريع</h1>
        {selectedDress && (
          <>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-primary">{selectedDress.name}</span>
          </>
        )}
        <div className="flex-1" />
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', step === 1 ? 'bg-primary text-white' : 'bg-green-500 text-white')}>
            {step === 2 ? <Check className="w-3.5 h-3.5" /> : '1'}
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', step === 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>2</div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ STEP 1 ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            {/* Left: Dress grid */}
            <div className="flex-1 flex flex-col border-l overflow-hidden">
              {/* Search + filter */}
              <div className="p-3 border-b flex gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="بحث بالاسم أو اللون..."
                    className="w-full border border-input rounded-xl px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="border border-input rounded-xl px-3 py-2 text-sm bg-background">
                  <option value="">كل الفئات</option>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {checkingAvail && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 px-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري فحص التوفر...
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredDresses.map(d => {
                    const avail = availability[d.id]
                    const isUnavailable = Object.keys(availability).length > 0 && avail === false
                    const isSelected = selectedDress?.id === d.id
                    return (
                      <button
                        key={d.id}
                        disabled={isUnavailable}
                        onClick={() => setSelectedDress(isSelected ? null : d)}
                        className={cn(
                          'relative rounded-2xl border-2 p-3 text-right transition-all active:scale-95',
                          isSelected    ? 'border-primary bg-primary/5 shadow-md' :
                          isUnavailable ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed' :
                                          'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                        )}
                      >
                        {/* Availability badge */}
                        {Object.keys(availability).length > 0 && (
                          <div className={cn(
                            'absolute top-2 left-2 w-2.5 h-2.5 rounded-full',
                            avail ? 'bg-green-500' : 'bg-red-400'
                          )} />
                        )}
                        {isSelected && (
                          <div className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}

                        {/* Dress icon / image */}
                        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center mb-2 overflow-hidden">
                          {d.image_url
                            ? <img src={d.image_url} alt={d.name} className="w-full h-full object-cover" />
                            : <Shirt className="w-10 h-10 text-primary/30" />
                          }
                        </div>

                        <p className="font-semibold text-sm truncate">{d.name}</p>
                        {d.code && <p className="text-[10px] text-muted-foreground font-mono">{d.code}</p>}

                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {d.category && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[d.category] || 'bg-gray-100 text-gray-600')}>
                              {CATEGORY_LABELS[d.category] || d.category}
                            </span>
                          )}
                          {d.size && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{d.size}</span>}
                        </div>

                        <p className="text-sm font-bold text-primary mt-2">{formatCurrency(d.rental_price, currency)}<span className="text-[10px] font-normal text-muted-foreground">/يوم</span></p>
                      </button>
                    )
                  })}
                  {filteredDresses.length === 0 && (
                    <div className="col-span-full text-center py-16 text-muted-foreground">
                      <Shirt className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">لا توجد فساتين</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Date + summary */}
            <div className="w-72 xl:w-80 flex flex-col bg-card shrink-0 overflow-y-auto">
              {/* Date picker */}
              <div className="p-4 border-b space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">تاريخ الإيجار</p>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">من</label>
                  <input type="date" value={startDate} min={today}
                    onChange={e => { setStartDate(e.target.value); setAvailability({}) }}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">إلى</label>
                  <input type="date" value={endDate} min={startDate}
                    onChange={e => { setEndDate(e.target.value); setAvailability({}) }}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                {days > 0 && (
                  <div className="bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> المدة</span>
                    <span className="text-sm font-bold text-primary">{days} يوم</span>
                  </div>
                )}
              </div>

              {/* Selected dress summary */}
              <div className="flex-1 p-4">
                {selectedDress ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">الفستان المختار</p>
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                          <Shirt className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{selectedDress.name}</p>
                          {selectedDress.code && <p className="text-xs text-muted-foreground font-mono">{selectedDress.code}</p>}
                        </div>
                      </div>
                      <div className="border-t pt-2 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">سعر اليوم</span>
                          <span className="font-medium">{formatCurrency(selectedDress.rental_price, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">عدد الأيام</span>
                          <span className="font-medium">{days}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1.5">
                          <span className="font-semibold">الإجمالي</span>
                          <span className="font-bold text-primary text-base">{formatCurrency(totalPrice, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التأمين</span>
                          <span className="font-medium">{formatCurrency(selectedDress.deposit, currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3 py-8">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center">
                      <Shirt className="w-7 h-7 opacity-30" />
                    </div>
                    <p className="text-sm">اختر فستاناً من القائمة</p>
                  </div>
                )}
              </div>

              {/* Next button */}
              <div className="p-4 border-t">
                <button
                  disabled={!selectedDress}
                  onClick={() => setStep(2)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-bold text-base hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  التالي — بيانات العميلة
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 2 ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Customer form */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-lg mx-auto space-y-5">
                <div>
                  <h2 className="text-lg font-bold mb-1">بيانات العميلة</h2>
                  <p className="text-sm text-muted-foreground">أدخل معلومات العميلة لإتمام الحجز</p>
                </div>

                {/* Customer name */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                    <User className="w-4 h-4 text-primary" /> اسم العميلة *
                  </label>
                  <input
                    autoFocus
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="مثال: سارة أحمد"
                    className="w-full border border-input bg-background rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-primary" /> رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className="w-full border border-input bg-background rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Payment */}
                <div className="bg-card border rounded-2xl p-4 space-y-4">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><Banknote className="w-4 h-4 text-primary" /> الدفع</p>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">المبلغ المدفوع مقدماً</label>
                    <div className="relative">
                      <input
                        type="number" step="0.01"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-input bg-background rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                    </div>
                    {/* Quick payment buttons */}
                    <div className="flex gap-2 mt-2">
                      {[totalPrice * 0.5, totalPrice, totalPrice + (selectedDress?.deposit || 0)].map((amt, i) => (
                        <button key={i} type="button"
                          onClick={() => setAmountPaid(String(amt))}
                          className="flex-1 text-xs py-1.5 border rounded-lg hover:bg-primary/5 hover:border-primary/30 transition-colors">
                          {i === 0 ? '50%' : i === 1 ? 'الكل' : 'الكل + تأمين'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deposit toggle */}
                  <button
                    type="button"
                    onClick={() => setDepositPaid(!depositPaid)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all',
                      depositPaid ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-border hover:border-primary/30'
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Shield className={cn('w-4 h-4', depositPaid ? 'text-green-600' : 'text-muted-foreground')} />
                      التأمين مدفوع ({formatCurrency(selectedDress?.deposit || 0, currency)})
                    </span>
                    <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all', depositPaid ? 'bg-green-500 border-green-500' : 'border-border')}>
                      {depositPaid && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-primary" /> ملاحظات
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية..."
                    rows={3}
                    className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Booking summary + confirm */}
            <div className="w-72 xl:w-80 flex flex-col bg-card border-l shrink-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ملخص الحجز</p>

                {/* Dress */}
                <div className="bg-primary/5 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Shirt className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{selectedDress?.name}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[selectedDress?.category || ''] || ''}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="bg-muted/50 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">الفترة</p>
                      <p className="font-medium">{startDate} ← {endDate}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">{days} يوم × {formatCurrency(selectedDress?.rental_price || 0, currency)}</span>
                    <span className="font-bold text-primary">{formatCurrency(totalPrice, currency)}</span>
                  </div>
                </div>

                {/* Financials */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">الإجمالي</span>
                    <span className="font-bold">{formatCurrency(totalPrice, currency)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">التأمين</span>
                    <span className={cn('font-medium', depositPaid ? 'text-green-600' : 'text-muted-foreground')}>
                      {formatCurrency(selectedDress?.deposit || 0, currency)} {depositPaid ? '✓' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">مدفوع مقدماً</span>
                    <span className="font-medium text-green-600">{formatCurrency(parseFloat(amountPaid) || 0, currency)}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between py-1 border-t font-semibold text-amber-600">
                      <span>متبقي</span>
                      <span>{formatCurrency(remaining, currency)}</span>
                    </div>
                  )}
                  {remaining <= 0 && parseFloat(amountPaid) > 0 && (
                    <div className="flex items-center gap-1.5 text-green-600 text-xs py-1 border-t">
                      <CheckCircle2 className="w-3.5 h-3.5" /> مدفوع بالكامل
                    </div>
                  )}
                </div>

                {/* Customer */}
                {customerName && (
                  <div className="bg-muted/50 rounded-2xl p-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{customerName}</p>
                      {customerPhone && <p className="text-xs text-muted-foreground">{customerPhone}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t space-y-2">
                <button
                  onClick={handleConfirm}
                  disabled={submitting || !customerName}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحجز...</>
                    : <><Check className="w-5 h-5" /> تأكيد الحجز</>
                  }
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  رجوع
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronLeft, CalendarDays, X,
  User, Phone, Banknote, Info, Shirt
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dress {
  id: string; name: string; code: string; category: string
  size: string; color: string; status: string; rental_price: number; deposit: number
}
interface Order {
  id: string; dress_id: string; order_number: string
  customer_name: string; customer_phone: string
  start_date: string; end_date: string; days: number
  total_price: number; amount_paid: number; deposit: number
  deposit_paid: boolean; status: string; notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_W    = 44   // px per day cell
const ROW_H    = 56   // px per dress row
const LABEL_W  = 180  // px for dress label column

const STATUS_COLORS: Record<string, string> = {
  booked:    'bg-blue-500 border-blue-600 text-white',
  active:    'bg-green-500 border-green-600 text-white',
  late:      'bg-red-500 border-red-600 text-white',
}
const STATUS_LABELS: Record<string, string> = {
  booked: 'محجوز', active: 'نشط', late: 'متأخر',
}
const DRESS_STATUS_BG: Record<string, string> = {
  available:   'bg-green-50 dark:bg-green-900/10',
  rented:      'bg-blue-50 dark:bg-blue-900/10',
  maintenance: 'bg-amber-50 dark:bg-amber-900/10',
}

const ARABIC_DAYS   = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addDays(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RentalCalendarClient({
  dresses, orders, currency,
}: { dresses: Dress[]; orders: Order[]; currency: string }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Calendar window: 60 days starting from (today - 7)
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return toISO(d)
  })
  const VISIBLE_DAYS = 60

  const days = useMemo(() => {
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const d = addDays(new Date(windowStart), i)
      return { iso: toISO(d), date: d, dayOfWeek: d.getDay(), dayNum: d.getDate(), month: d.getMonth() }
    })
  }, [windowStart])

  const todayISO = toISO(new Date())

  // Jump: shift window
  const shiftWindow = (n: number) => {
    setWindowStart(prev => toISO(addDays(new Date(prev), n)))
  }
  const jumpToToday = () => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    setWindowStart(toISO(d))
    setTimeout(() => {
      const todayIdx = days.findIndex(d => d.iso === todayISO)
      if (scrollRef.current && todayIdx >= 0) {
        scrollRef.current.scrollLeft = Math.max(0, todayIdx * DAY_W - 200)
      }
    }, 50)
  }

  // Build order map: dress_id → orders[]
  const ordersByDress = useMemo(() => {
    const map: Record<string, Order[]> = {}
    dresses.forEach(d => { map[d.id] = [] })
    orders.forEach(o => { if (map[o.dress_id]) map[o.dress_id].push(o) })
    return map
  }, [dresses, orders])

  // Hover state
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null)
  const [tooltip, setTooltip]           = useState<{ order: Order; x: number; y: number } | null>(null)

  // Detail panel
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

  // New booking from click
  const handleSlotClick = (dressId: string, dayISO: string) => {
    const endISO = toISO(addDays(new Date(dayISO), 1))
    router.push(`/dashboard/rentals/bookings/new?dress=${dressId}&start=${dayISO}&end=${endISO}`)
  }

  // Month label groups for header
  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    days.forEach(d => {
      const label = `${ARABIC_MONTHS[d.month]}`
      if (!groups.length || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    })
    return groups
  }, [days])

  const windowEnd = days[days.length - 1].iso

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" dir="rtl">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-lg">تقويم التأجير</h1>
        <div className="flex-1" />

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
          {[['bg-blue-500','محجوز'],['bg-green-500','نشط'],['bg-red-500','متأخر'],['bg-amber-400','صيانة']].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${c}`} />{l}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 border rounded-xl overflow-hidden">
          <button onClick={() => shiftWindow(-14)} className="p-2 hover:bg-accent transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={jumpToToday} className="px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors border-x">
            اليوم
          </button>
          <button onClick={() => shiftWindow(14)} className="p-2 hover:bg-accent transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Calendar ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* Dress labels (fixed) */}
        <div className="shrink-0 border-l bg-card z-10 flex flex-col" style={{ width: LABEL_W }}>
          {/* Top-left corner */}
          <div className="border-b" style={{ height: 56 }}>
            <div className="px-3 py-1 h-7 border-b flex items-center">
              <span className="text-[10px] text-muted-foreground font-medium">الشهر</span>
            </div>
            <div className="px-3 h-[calc(56px-28px)] flex items-center">
              <span className="text-[10px] text-muted-foreground font-medium">{dresses.length} فستان</span>
            </div>
          </div>
          {/* Dress rows */}
          <div className="flex-1 overflow-y-hidden">
            {dresses.map(d => (
              <div key={d.id}
                className={cn(
                  'flex items-center gap-2 px-3 border-b transition-colors',
                  DRESS_STATUS_BG[d.status] || 'bg-card'
                )}
                style={{ height: ROW_H }}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Shirt className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {d.code && <span className="font-mono">{d.code}</span>}
                    {d.size && <span> · {d.size}</span>}
                  </p>
                </div>
                {d.status === 'maintenance' && (
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">صيانة</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: VISIBLE_DAYS * DAY_W, minWidth: '100%' }}>

            {/* ── Header: months ── */}
            <div className="flex sticky top-0 z-10 bg-card border-b" style={{ height: 28 }}>
              {monthGroups.map((g, i) => (
                <div key={i} className="border-l first:border-l-0 flex items-center px-2"
                  style={{ width: g.count * DAY_W, minWidth: g.count * DAY_W }}>
                  <span className="text-[11px] font-semibold text-muted-foreground">{g.label}</span>
                </div>
              ))}
            </div>

            {/* ── Header: days ── */}
            <div className="flex sticky top-7 z-10 bg-card border-b" style={{ height: 28 }}>
              {days.map(d => {
                const isToday   = d.iso === todayISO
                const isWeekend = d.dayOfWeek === 5 || d.dayOfWeek === 6
                return (
                  <div key={d.iso}
                    className={cn(
                      'border-l first:border-l-0 flex flex-col items-center justify-center shrink-0',
                      isToday   ? 'bg-primary/10' : isWeekend ? 'bg-muted/50' : ''
                    )}
                    style={{ width: DAY_W }}
                  >
                    <span className={cn('text-[9px] font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
                      {ARABIC_DAYS[d.dayOfWeek]}
                    </span>
                    <span className={cn(
                      'text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full',
                      isToday ? 'bg-primary text-white' : 'text-foreground'
                    )}>
                      {d.dayNum}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* ── Dress rows ── */}
            {dresses.map(d => {
              const dressOrders = ordersByDress[d.id] || []
              const isMaintenance = d.status === 'maintenance'

              return (
                <div key={d.id} className="relative border-b flex"
                  style={{ height: ROW_H }}>

                  {/* Day cells (clickable slots) */}
                  {days.map(day => {
                    const isPast = day.iso < todayISO
                    const isToday = day.iso === todayISO
                    const isWeekend = day.dayOfWeek === 5 || day.dayOfWeek === 6
                    const hasBooking = dressOrders.some(o =>
                      o.start_date <= day.iso && o.end_date >= day.iso
                    )
                    return (
                      <div key={day.iso}
                        onClick={() => !hasBooking && !isMaintenance && !isPast && handleSlotClick(d.id, day.iso)}
                        className={cn(
                          'border-l first:border-l-0 shrink-0 transition-colors',
                          isToday   ? 'bg-primary/5' :
                          isWeekend ? 'bg-muted/30' :
                          isPast    ? 'bg-muted/10' : 'bg-background',
                          !hasBooking && !isMaintenance && !isPast && 'hover:bg-primary/10 cursor-pointer group'
                        )}
                        style={{ width: DAY_W, height: ROW_H }}
                      >
                        {/* Hover "+" indicator */}
                        {!hasBooking && !isMaintenance && !isPast && (
                          <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-primary/60 text-lg font-light">+</span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Maintenance overlay */}
                  {isMaintenance && (
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(251,191,36,0.15) 8px, rgba(251,191,36,0.15) 16px)' }}
                    />
                  )}

                  {/* Today line */}
                  {days.some(day => day.iso === todayISO) && (() => {
                    const idx = days.findIndex(day => day.iso === todayISO)
                    return (
                      <div className="absolute top-0 bottom-0 w-0.5 bg-primary/40 z-10 pointer-events-none"
                        style={{ right: (VISIBLE_DAYS - idx) * DAY_W - DAY_W / 2 }} />
                    )
                  })()}

                  {/* Booking blocks */}
                  {dressOrders.map(o => {
                    const clampedStart = o.start_date < windowStart ? windowStart : o.start_date
                    const clampedEnd   = o.end_date   > windowEnd   ? windowEnd   : o.end_date
                    if (clampedEnd < windowStart || clampedStart > windowEnd) return null

                    const startIdx = diffDays(windowStart, clampedStart)
                    const blockDays = diffDays(clampedStart, clampedEnd) + 1
                    const leftPx   = startIdx * DAY_W
                    const widthPx  = blockDays * DAY_W - 2

                    const colorClass = STATUS_COLORS[o.status] || 'bg-gray-400 text-white'
                    const isHovered  = hoveredOrder === o.id
                    const paid       = Math.round((o.amount_paid / o.total_price) * 100)

                    return (
                      <div
                        key={o.id}
                        className={cn(
                          'absolute top-2 bottom-2 rounded-lg border cursor-pointer select-none transition-all z-20',
                          colorClass,
                          isHovered ? 'shadow-lg scale-y-105 z-30' : 'hover:shadow-md'
                        )}
                        style={{ right: leftPx, width: widthPx }}
                        onMouseEnter={e => {
                          setHoveredOrder(o.id)
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setTooltip({ order: o, x: rect.left, y: rect.bottom + 6 })
                        }}
                        onMouseLeave={() => { setHoveredOrder(null); setTooltip(null) }}
                        onClick={e => { e.stopPropagation(); setDetailOrder(o); setTooltip(null) }}
                      >
                        <div className="px-2 h-full flex items-center gap-1.5 overflow-hidden">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate leading-tight">{o.customer_name}</p>
                            {widthPx > 80 && (
                              <p className="text-[9px] opacity-80 truncate leading-tight">{o.order_number}</p>
                            )}
                          </div>
                          {/* Payment progress dot */}
                          {widthPx > 60 && (
                            <div className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              paid >= 100 ? 'bg-white' : 'bg-white/40'
                            )} title={`${paid}% مدفوع`} />
                          )}
                        </div>
                        {/* Payment bar at bottom */}
                        <div className="absolute bottom-0 right-0 left-0 h-1 rounded-b-lg overflow-hidden bg-black/20">
                          <div className="h-full bg-white/60 transition-all" style={{ width: `${Math.min(100, paid)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Empty state */}
            {dresses.length === 0 && (
              <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                <Shirt className="w-6 h-6 ml-2 opacity-30" /> لا توجد فساتين مضافة
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border shadow-xl rounded-xl p-3 text-sm min-w-52 pointer-events-none"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
          <p className="font-bold text-foreground">{tooltip.order.customer_name}</p>
          <p className="text-xs text-muted-foreground font-mono">{tooltip.order.order_number}</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">الفترة</span>
              <span>{tooltip.order.start_date} ← {tooltip.order.end_date}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">الإجمالي</span>
              <span className="font-semibold">{formatCurrency(tooltip.order.total_price, currency)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">الحالة</span>
              <span>{STATUS_LABELS[tooltip.order.status] || tooltip.order.status}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setDetailOrder(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={cn('px-5 py-4 flex items-center justify-between',
              detailOrder.status === 'booked' ? 'bg-blue-500' :
              detailOrder.status === 'active'  ? 'bg-green-500' : 'bg-red-500'
            )}>
              <div>
                <p className="text-white font-bold">{detailOrder.customer_name}</p>
                <p className="text-white/70 text-xs font-mono">{detailOrder.order_number}</p>
              </div>
              <button onClick={() => setDetailOrder(null)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow icon={<CalendarDays className="w-3.5 h-3.5" />} label="من" value={detailOrder.start_date} />
                <InfoRow icon={<CalendarDays className="w-3.5 h-3.5" />} label="إلى" value={detailOrder.end_date} />
                <InfoRow icon={<Info className="w-3.5 h-3.5" />} label="الأيام" value={`${detailOrder.days} يوم`} />
                <InfoRow icon={<Info className="w-3.5 h-3.5" />} label="الحالة" value={STATUS_LABELS[detailOrder.status] || detailOrder.status} />
                {detailOrder.customer_phone && (
                  <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="الهاتف" value={detailOrder.customer_phone} />
                )}
              </div>

              <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> الإجمالي</span>
                  <span className="font-bold">{formatCurrency(detailOrder.total_price, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">مدفوع</span>
                  <span className="text-green-600 font-medium">{formatCurrency(detailOrder.amount_paid, currency)}</span>
                </div>
                {detailOrder.total_price - detailOrder.amount_paid > 0 && (
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-muted-foreground">متبقي</span>
                    <span className="text-amber-600 font-medium">{formatCurrency(detailOrder.total_price - detailOrder.amount_paid, currency)}</span>
                  </div>
                )}
                {/* Payment bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round(detailOrder.amount_paid / detailOrder.total_price * 100))}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">التأمين</span>
                  <span className={detailOrder.deposit_paid ? 'text-green-600' : 'text-muted-foreground'}>
                    {formatCurrency(detailOrder.deposit, currency)} {detailOrder.deposit_paid ? '✓' : ''}
                  </span>
                </div>
              </div>

              {detailOrder.notes && (
                <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl">{detailOrder.notes}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setDetailOrder(null); router.push('/dashboard/rentals/returns') }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90"
                >
                  تسجيل إرجاع
                </button>
                <button onClick={() => setDetailOrder(null)}
                  className="px-4 py-2.5 border rounded-xl text-sm hover:bg-accent">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">{icon}{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

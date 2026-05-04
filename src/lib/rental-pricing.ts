// ─── Rental Pricing Engine ────────────────────────────────────────────────────

export type PricingType = 'per_day' | 'package' | 'weekend' | 'event'
export type DepositType = 'fixed' | 'percentage'

export interface PackageRule {
  days: number       // min days to qualify
  price: number      // total package price (not per-day)
  label: string      // e.g. "باقة نهاية الأسبوع"
}

export interface WeekendRule {
  days: number[]     // 0=Sun … 6=Sat  (e.g. [5,6] = Fri+Sat)
  multiplier: number // e.g. 1.5 = +50%
}

export interface EventRule {
  name: string
  start_date: string  // YYYY-MM-DD
  end_date:   string
  multiplier: number  // e.g. 2 = double price
}

export interface PricingRule {
  id:           string
  company_id:   string
  dress_id?:    string   // null = global
  name:         string
  type:         PricingType
  base_price:   number   // price per day (anchor)
  deposit_type: DepositType
  deposit_value: number  // amount or %
  packages?:    PackageRule[]
  weekend?:     WeekendRule
  events?:      EventRule[]
  active:       boolean
  created_at?:  string
}

// ─── Calculation output ───────────────────────────────────────────────────────
export interface PriceBreakdown {
  days:           number
  base_per_day:   number
  applied_rule:   string        // human label for what rule was applied
  subtotal:       number        // before deposit
  deposit:        number
  total:          number        // subtotal (deposit is separate — not added to total)
  line_items:     LineItem[]
}

export interface LineItem {
  label:  string
  amount: number
  note?:  string
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Enumerate all dates in [startISO, endISO] inclusive.
 */
function enumerateDates(startISO: string, endISO: string): Date[] {
  const dates: Date[] = []
  const cur = new Date(startISO)
  const end = new Date(endISO)
  while (cur <= end) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/**
 * Check if a date falls inside an event rule window.
 */
function findEventForDate(date: Date, events: EventRule[] = []): EventRule | null {
  const iso = date.toISOString().slice(0, 10)
  return events.find(e => e.start_date <= iso && iso <= e.end_date) || null
}

/**
 * Main calculation function.
 * Pass null rule to use dress.rental_price as flat per-day.
 */
export function calculateRentalPrice(params: {
  startDate:    string
  endDate:      string
  basePricePerDay: number  // dress.rental_price fallback
  baseDeposit:  number     // dress.deposit fallback
  rule?:        PricingRule | null
}): PriceBreakdown {
  const { startDate, endDate, basePricePerDay, baseDeposit, rule } = params

  const dates  = enumerateDates(startDate, endDate)
  const days   = Math.max(1, dates.length)
  const lineItems: LineItem[] = []

  // ── No rule: simple per-day ───────────────────────────────────────────────
  if (!rule) {
    const subtotal = basePricePerDay * days
    lineItems.push({ label: `${days} يوم × ${basePricePerDay}`, amount: subtotal })
    return {
      days, base_per_day: basePricePerDay, applied_rule: 'سعر يومي ثابت',
      subtotal, deposit: baseDeposit, total: subtotal, line_items: lineItems,
    }
  }

  const perDay    = rule.base_price
  const packages  = rule.packages  || []
  const weekend   = rule.weekend
  const events    = rule.events    || []

  // ── Package pricing: check if total days qualifies ────────────────────────
  if (rule.type === 'package' && packages.length > 0) {
    // Find best package (longest qualifying package ≤ days)
    const sorted = [...packages].sort((a, b) => b.days - a.days)
    const best = sorted.find(p => days >= p.days)
    if (best) {
      const fullPackages = Math.floor(days / best.days)
      const remainder    = days % best.days
      const pkgTotal     = fullPackages * best.price
      const remTotal     = remainder * perDay

      if (fullPackages > 0) lineItems.push({ label: `${fullPackages} × ${best.label}`, amount: pkgTotal, note: `${best.days} أيام بـ ${best.price}` })
      if (remainder > 0)    lineItems.push({ label: `${remainder} يوم إضافي`, amount: remTotal })

      const subtotal = pkgTotal + remTotal
      const deposit  = computeDeposit(rule, subtotal)
      return {
        days, base_per_day: perDay, applied_rule: best.label,
        subtotal, deposit, total: subtotal, line_items: lineItems,
      }
    }
  }

  // ── Per-day with weekend + event multipliers ──────────────────────────────
  let subtotal = 0
  const eventTotals: Record<string, number> = {}
  let weekendTotal = 0
  let normalTotal  = 0

  dates.forEach(date => {
    const dayOfWeek = date.getDay()
    const event = findEventForDate(date, events)
    let dayPrice = perDay

    if (event) {
      dayPrice = perDay * event.multiplier
      eventTotals[event.name] = (eventTotals[event.name] || 0) + dayPrice
    } else if (weekend && weekend.days.includes(dayOfWeek)) {
      dayPrice = perDay * weekend.multiplier
      weekendTotal += dayPrice
    } else {
      normalTotal += dayPrice
    }
    subtotal += dayPrice
  })

  if (normalTotal > 0)  lineItems.push({ label: 'أيام عادية', amount: normalTotal })
  if (weekendTotal > 0) lineItems.push({ label: 'عطلة نهاية الأسبوع', amount: weekendTotal, note: `×${weekend?.multiplier}` })
  Object.entries(eventTotals).forEach(([name, amt]) => {
    lineItems.push({ label: `مناسبة: ${name}`, amount: amt })
  })

  const deposit = computeDeposit(rule, subtotal)
  const appliedRule = rule.type === 'weekend' ? 'سعر عطلة الأسبوع'
    : rule.type === 'event' ? 'سعر المناسبة'
    : 'سعر يومي'

  return {
    days, base_per_day: perDay, applied_rule: appliedRule,
    subtotal, deposit, total: subtotal, line_items: lineItems,
  }
}

function computeDeposit(rule: PricingRule, subtotal: number): number {
  if (rule.deposit_type === 'percentage') return Math.round(subtotal * rule.deposit_value / 100 * 100) / 100
  return rule.deposit_value
}

/**
 * Apply extra fees (late return / damage) on top of a booking.
 */
export function applyExtraFees(base: PriceBreakdown, fees: { label: string; amount: number }[]): PriceBreakdown {
  const extra = fees.reduce((s, f) => s + f.amount, 0)
  return {
    ...base,
    total: base.total + extra,
    line_items: [...base.line_items, ...fees.map(f => ({ label: f.label, amount: f.amount }))],
  }
}

/**
 * Find the best matching rule for a dress on given dates.
 * Priority: dress-specific > global event > global weekend > global package > global per_day
 */
export function selectRule(
  dressId: string,
  startDate: string,
  endDate: string,
  rules: PricingRule[],
): PricingRule | null {
  const active = rules.filter(r => r.active)
  // Dress-specific first
  const specific = active.filter(r => r.dress_id === dressId)
  if (specific.length) return specific[0]
  // Global event rules that overlap
  const eventRule = active.find(r => r.type === 'event' && !r.dress_id &&
    r.events?.some(e => e.start_date <= endDate && e.end_date >= startDate))
  if (eventRule) return eventRule
  // Global weekend / package / per_day
  return active.find(r => !r.dress_id) || null
}

// ─── Report Engine — dynamic by business type ─────────────────────────────────

export type ReportMode = 'sales' | 'rental' | 'hybrid'

export function getDefaultReportMode(businessType: string): ReportMode {
  if (businessType === 'dress_rental') return 'rental'
  return 'sales'
}

export function getAvailableModes(businessType: string): ReportMode[] {
  if (businessType === 'dress_rental') return ['rental']
  return ['sales']
  // Future: hybrid when a business has both sales + rental tables
}

// ─── Sales report types ───────────────────────────────────────────────────────
export interface DailySalesPoint { day: string; revenue: number; count: number }
export interface TopProduct      { name: string; qty: number; revenue: number; cost: number; profit: number; margin: number }
export interface TopCustomer     { name: string; spent: number; debt: number }
export interface StockItem       { name: string; stock: number; value?: number }
export interface ReportInsight   { type: 'danger' | 'warning' | 'success' | 'info'; message: string }

export interface SalesReportData {
  mode:     'sales'
  days:     number
  period:   { from: string; to: string }
  totals:   { revenue: number; cost: number; expenses: number; grossProfit: number; netProfit: number; orders: number; avgOrder: number }
  dailySales:   DailySalesPoint[]
  topProducts:  TopProduct[]
  topCustomers: TopCustomer[]
  highDebt:     { name: string; debt: number }[]
  lowStock:     StockItem[]
  deadStock:    StockItem[]
  insights:     ReportInsight[]
}

// ─── Rental report types ──────────────────────────────────────────────────────
export interface DailyRevenuePoint { day: string; revenue: number; bookings: number }
export interface TopDress          { name: string; code: string; bookings: number; revenue: number; utilization: number }
export interface LateOrder         { customer_name: string; dress_name: string; days_late: number; amount_owed: number }

export interface RentalReportData {
  mode:    'rental'
  days:    number
  period:  { from: string; to: string }
  totals: {
    revenue:       number   // total from completed+active orders
    pending:       number   // unpaid amounts
    bookings:      number   // total orders in period
    activeNow:     number   // currently active
    lateCount:     number
    avgBookingDays: number
    utilizationRate: number // % of dresses currently rented
    totalDresses:  number
    availableDresses: number
  }
  dailyRevenue:  DailyRevenuePoint[]
  topDresses:    TopDress[]
  lateOrders:    LateOrder[]
  upcomingEnds:  { customer_name: string; dress_name: string; end_date: string; days_left: number }[]
  insights:      ReportInsight[]
}

export type ReportData = SalesReportData | RentalReportData

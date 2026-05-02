import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ar } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

// Format date
export function formatDate(
  date: string | Date,
  formatStr = 'dd/MM/yyyy',
  useArabic = false
): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, formatStr, { locale: useArabic ? ar : undefined })
}

// Get month range
export function getMonthRange(date: Date = new Date()) {
  return {
    start: startOfMonth(date).toISOString().split('T')[0],
    end: endOfMonth(date).toISOString().split('T')[0],
  }
}

// Get last N months
export function getLastNMonths(n: number): Array<{ start: string; end: string; label: string }> {
  return Array.from({ length: n }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      start: startOfMonth(date).toISOString().split('T')[0],
      end: endOfMonth(date).toISOString().split('T')[0],
      label: format(date, 'MMM yyyy'),
    }
  }).reverse()
}

// Calculate percentage change
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

// Generate slug
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// Month names in Arabic
export const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

// Transaction type colors
export const transactionColors = {
  income: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: 'text-emerald-600',
  },
  expense: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    icon: 'text-red-600',
  },
  transfer: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    icon: 'text-blue-600',
  },
}

// Account type colors
export const accountTypeColors = {
  asset: 'text-blue-600 bg-blue-50',
  liability: 'text-red-600 bg-red-50',
  equity: 'text-purple-600 bg-purple-50',
  revenue: 'text-green-600 bg-green-50',
  expense: 'text-orange-600 bg-orange-50',
}

// Status badge variants
export const statusVariants = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-800',
  posted: 'bg-blue-100 text-blue-800',
  reversed: 'bg-purple-100 text-purple-800',
}

// Payment method labels
export const paymentMethodLabels: Record<string, string> = {
  cash: 'نقداً',
  bank: 'بنكي',
  card: 'بطاقة',
  transfer: 'تحويل',
  check: 'شيك',
}

// Deep merge objects
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] as any, source[key] as any)
    } else {
      result[key] = source[key] as any
    }
  }
  return result
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

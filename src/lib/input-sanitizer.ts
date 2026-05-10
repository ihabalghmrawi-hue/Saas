/**
 * Input sanitization utilities.
 * Use at API route boundaries before passing data to Supabase or other systems.
 */

/** Strip HTML tags and dangerous characters from a string */
export function sanitizeText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[<>'"]/g, '')           // strip remaining dangerous chars
    .trim()
    .slice(0, maxLength)
}

/** Sanitize a search term — allow Arabic, Latin, numbers, spaces, dashes */
export function sanitizeSearch(input: unknown, maxLength = 100): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[^\w\s؀-ۿ\-_.]/g, '')
    .trim()
    .slice(0, maxLength)
}

/** Validate and return a safe UUID string, or null */
export function sanitizeUUID(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(input) ? input : null
}

/** Return a safe positive integer, or a default */
export function sanitizePositiveInt(input: unknown, defaultVal: number, max = 10000): number {
  const n = parseInt(String(input), 10)
  if (isNaN(n) || n < 1) return defaultVal
  return Math.min(n, max)
}

/** Return a safe non-negative number, or a default */
export function sanitizeAmount(input: unknown, defaultVal = 0): number {
  const n = parseFloat(String(input))
  if (isNaN(n) || n < 0) return defaultVal
  return Math.round(n * 100) / 100  // round to 2 decimal places
}

/** Return a safe ISO date string (YYYY-MM-DD), or today */
export function sanitizeDate(input: unknown): string {
  if (typeof input !== 'string') return new Date().toISOString().slice(0, 10)
  const match = input.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return new Date().toISOString().slice(0, 10)
  const d = new Date(input)
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return input
}

/** Sanitize a phone number — digits, +, -, spaces only */
export function sanitizePhone(input: unknown, maxLength = 20): string {
  if (typeof input !== 'string') return ''
  return input.replace(/[^\d+\-\s()]/g, '').trim().slice(0, maxLength)
}

/** Sanitize email */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.toLowerCase().trim().slice(0, 254)
}

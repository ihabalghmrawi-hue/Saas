/**
 * Runtime environment validation.
 * Imported once at app startup — fails fast if required vars are missing.
 * Server-only: never import from client components.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[env] Missing required environment variable: ${name}`)
  return v
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

// ── Validated env object ──────────────────────────────────────────────────────

export const env = {
  // Supabase (public — safe to use in middleware/edge)
  supabaseUrl:     required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),

  // Supabase service role — SERVER ONLY, never expose to browser
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  // Session signing
  sessionSecret: optional('SESSION_SECRET'),

  // App
  appUrl:         optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  nodeEnv:        optional('NODE_ENV', 'development'),
  isProduction:   process.env.NODE_ENV === 'production',

  // Super admins
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),

  // Optional integrations
  stripeSecretKey:      optional('STRIPE_SECRET_KEY'),
  stripeWebhookSecret:  optional('STRIPE_WEBHOOK_SECRET'),
  companyIdFallback:    optional('NEXT_PUBLIC_COMPANY_ID', 'default'),
  currencyFallback:     optional('NEXT_PUBLIC_CURRENCY_DEFAULT', 'SAR'),
} as const

// Production-only hard checks
if (env.isProduction) {
  const prodRequired = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SESSION_SECRET',
  ]
  const missing = prodRequired.filter(k => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production environment variables: ${missing.join(', ')}`
    )
  }

  if ((env.sessionSecret?.length ?? 0) < 32) {
    throw new Error('[env] SESSION_SECRET must be at least 32 characters in production')
  }

  if (env.superAdminEmails.length === 0) {
    console.warn('[env] SUPER_ADMIN_EMAILS is not set — no super admin access will be granted')
  }
}

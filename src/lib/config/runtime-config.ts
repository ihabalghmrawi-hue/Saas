import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('runtime-config')

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'jsonarray'

export interface ConfigDefinition {
  key: string
  type: ConfigValueType
  defaultValue: unknown
  description: string
  scope: 'global' | 'tenant' | 'environment'
  sensitive: boolean
  validation?: (value: unknown) => boolean
  options?: string[]
}

export interface ConfigEntry {
  key: string
  value: unknown
  type: ConfigValueType
  scope: 'global' | 'tenant' | 'environment'
  tenantId?: string
  environment?: string
  updatedAt: string
  updatedBy: string
  version: number
}

type ConfigChangeHandler = (entry: ConfigEntry, previousValue: unknown) => void

let definitions = new Map<string, ConfigDefinition>()
let entries = new Map<string, ConfigEntry>()
let changeHandlers = new Map<string, ConfigChangeHandler[]>()

export function configureConfigStores(stores: {
  definitions?: Map<string, ConfigDefinition>
  entries?: Map<string, ConfigEntry>
  changeHandlers?: Map<string, ConfigChangeHandler[]>
}): void {
  if (stores.definitions) definitions = stores.definitions
  if (stores.entries) entries = stores.entries
  if (stores.changeHandlers) changeHandlers = stores.changeHandlers
}

function entryKey(key: string, tenantId?: string, environment?: string): string {
  return `${key}:${tenantId || '*'}:${environment || '*'}`
}

export function defineConfig(def: ConfigDefinition): void {
  definitions.set(def.key, def)
}

export function defineConfigs(defs: ConfigDefinition[]): void {
  for (const def of defs) {
    defineConfig(def)
  }
}

export function getDefinition(key: string): ConfigDefinition | undefined {
  return definitions.get(key)
}

export function getAllDefinitions(): ConfigDefinition[] {
  return Array.from(definitions.values())
}

export function setConfig(
  key: string,
  value: unknown,
  scope: ConfigEntry['scope'],
  options?: { tenantId?: string; environment?: string; updatedBy?: string },
): { success: boolean; error?: string } {
  const def = definitions.get(key)
  if (!def) {
    return { success: false, error: `Unknown config key: ${key}` }
  }

  const validated = validateValue(value, def)
  if (!validated.valid) {
    return { success: false, error: validated.error }
  }

  const eKey = entryKey(key, options?.tenantId, options?.environment)
  const existing = entries.get(eKey)
  const previousValue = existing?.value

  const entry: ConfigEntry = {
    key,
    value: coerceValue(value, def.type),
    type: def.type,
    scope,
    tenantId: options?.tenantId,
    environment: options?.environment,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy || 'system',
    version: (existing?.version || 0) + 1,
  }

  entries.set(eKey, entry)

  const handlers = changeHandlers.get(key) || []
  for (const handler of handlers) {
    try {
      handler(entry, previousValue)
    } catch (error) {
      logger.error(`Config change handler failed for ${key}`, error instanceof Error ? error : undefined)
    }
  }

  return { success: true }
}

function validateValue(value: unknown, def: ConfigDefinition): { valid: boolean; error?: string } {
  if (value === undefined || value === null) {
    return { valid: false, error: `Value required for ${def.key}` }
  }

  if (def.options && !def.options.includes(String(value))) {
    return { valid: false, error: `Value must be one of: ${def.options.join(', ')}` }
  }

  if (def.validation && !def.validation(value)) {
    return { valid: false, error: `Validation failed for ${def.key}` }
  }

  return { valid: true }
}

function coerceValue(value: unknown, type: ConfigValueType): unknown {
  switch (type) {
    case 'string':
      return String(value)
    case 'number':
      return Number(value)
    case 'boolean':
      return value === 'true' || value === true
    case 'json':
      return typeof value === 'string' ? JSON.parse(value as string) : value
    case 'jsonarray':
      return typeof value === 'string' ? JSON.parse(value as string) : value
    default:
      return value
  }
}

export function getConfig<T = unknown>(
  key: string,
  options?: { tenantId?: string; environment?: string },
): T | undefined {
  const def = definitions.get(key)
  if (!def) return undefined

  const envKey = entryKey(key, options?.tenantId, options?.environment)
  const envEntry = entries.get(envKey)
  if (envEntry) return envEntry.value as T

  const tenantKey = entryKey(key, options?.tenantId)
  const tenantEntry = entries.get(tenantKey)
  if (tenantEntry) return tenantEntry.value as T

  const globalKey = entryKey(key)
  const globalEntry = entries.get(globalKey)
  if (globalEntry) return globalEntry.value as T

  return def.defaultValue as T
}

export function getConfigWithMeta<T = unknown>(
  key: string,
  options?: { tenantId?: string; environment?: string },
): { value: T | undefined; entry?: ConfigEntry; definition?: ConfigDefinition } {
  const def = definitions.get(key)
  if (!def) return { value: undefined }

  const envKey = entryKey(key, options?.tenantId, options?.environment)
  const envEntry = entries.get(envKey)
  if (envEntry) return { value: envEntry.value as T, entry: envEntry, definition: def }

  const tenantKey = entryKey(key, options?.tenantId)
  const tenantEntry = entries.get(tenantKey)
  if (tenantEntry) return { value: tenantEntry.value as T, entry: tenantEntry, definition: def }

  const globalKey = entryKey(key)
  const globalEntry = entries.get(globalKey)
  if (globalEntry) return { value: globalEntry.value as T, entry: globalEntry, definition: def }

  return { value: def.defaultValue as T, definition: def }
}

export function getAllConfigs(options?: { tenantId?: string; environment?: string }): ConfigEntry[] {
  const result: ConfigEntry[] = []

  for (const [, entry] of entries) {
    if (options?.tenantId && entry.tenantId && entry.tenantId !== options.tenantId) continue
    if (options?.environment && entry.environment && entry.environment !== options.environment) continue
    result.push(entry)
  }

  return result
}

export function onConfigChange(key: string, handler: ConfigChangeHandler): void {
  const existing = changeHandlers.get(key) || []
  existing.push(handler)
  changeHandlers.set(key, existing)
}

export function resetConfig(key: string, options?: { tenantId?: string; environment?: string }): void {
  const eKey = entryKey(key, options?.tenantId, options?.environment)
  entries.delete(eKey)
}

export function getSensitiveConfig(key: string, options?: { tenantId?: string; environment?: string }): string | undefined {
  const def = definitions.get(key)
  if (!def?.sensitive) {
    logger.warn(`Attempted to access non-sensitive config as sensitive: ${key}`)
    return undefined
  }
  return getConfig<string>(key, options)
}

const ENTERPRISE_CONFIGS: ConfigDefinition[] = [
  { key: 'accounting.autoReconcileThreshold', type: 'number', defaultValue: 100, description: 'Auto-reconciliation threshold amount', scope: 'tenant', sensitive: false },
  { key: 'accounting.maxJournalLines', type: 'number', defaultValue: 500, description: 'Maximum lines per journal entry', scope: 'tenant', sensitive: false },
  { key: 'accounting.requireApprovalAbove', type: 'number', defaultValue: 10000, description: 'Require approval for journal entries above this amount', scope: 'tenant', sensitive: false },
  { key: 'accounting.fiscalYearStartMonth', type: 'number', defaultValue: 1, description: 'Fiscal year start month (1-12)', scope: 'tenant', sensitive: false, validation: (v) => (v as number) >= 1 && (v as number) <= 12 },
  { key: 'accounting.defaultCurrency', type: 'string', defaultValue: 'SAR', description: 'Default accounting currency', scope: 'tenant', sensitive: false, options: ['SAR', 'USD', 'EUR', 'GBP', 'AED'] },
  { key: 'compliance.retentionDays', type: 'number', defaultValue: 3650, description: 'Data retention period in days', scope: 'global', sensitive: false },
  { key: 'compliance.auditLevel', type: 'string', defaultValue: 'standard', description: 'Audit logging level', scope: 'tenant', sensitive: false, options: ['minimal', 'standard', 'verbose'] },
  { key: 'security.maxLoginAttempts', type: 'number', defaultValue: 5, description: 'Maximum failed login attempts before lockout', scope: 'tenant', sensitive: false },
  { key: 'security.sessionTimeoutMinutes', type: 'number', defaultValue: 480, description: 'Session timeout in minutes', scope: 'tenant', sensitive: false },
  { key: 'security.mfaRequired', type: 'boolean', defaultValue: false, description: 'Require multi-factor authentication', scope: 'tenant', sensitive: false },
  { key: 'backup.schedule', type: 'string', defaultValue: 'daily', description: 'Backup schedule frequency', scope: 'global', sensitive: false, options: ['hourly', 'daily', 'weekly'] },
  { key: 'backup.retentionDays', type: 'number', defaultValue: 30, description: 'Backup retention in days', scope: 'global', sensitive: false },
  { key: 'performance.materializedViewRefreshInterval', type: 'number', defaultValue: 3600, description: 'Materialized view refresh interval in seconds', scope: 'global', sensitive: false },
  { key: 'api.rateLimitPerMinute', type: 'number', defaultValue: 200, description: 'API rate limit per minute per tenant', scope: 'tenant', sensitive: false },
  { key: 'api.maxBatchSize', type: 'number', defaultValue: 1000, description: 'Maximum batch operation size', scope: 'global', sensitive: false },
  { key: 'notifications.enabled', type: 'boolean', defaultValue: true, description: 'Enable notifications', scope: 'tenant', sensitive: false },
  { key: 'observability.tracingEnabled', type: 'boolean', defaultValue: false, description: 'Enable distributed tracing', scope: 'global', sensitive: false },
  { key: 'observability.logLevel', type: 'string', defaultValue: 'info', description: 'Log level', scope: 'environment', sensitive: false, options: ['debug', 'info', 'warn', 'error'] },
  { key: 'stripe.secretKey', type: 'string', defaultValue: '', description: 'Stripe secret key', scope: 'environment', sensitive: true },
  { key: 'smtp.password', type: 'string', defaultValue: '', description: 'SMTP password', scope: 'environment', sensitive: true },
]

export function registerEnterpriseConfigs(): void {
  defineConfigs(ENTERPRISE_CONFIGS)
  logger.info(`Registered ${ENTERPRISE_CONFIGS.length} enterprise runtime configs`)
}

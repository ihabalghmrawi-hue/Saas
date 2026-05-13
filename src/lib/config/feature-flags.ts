import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('feature-flags')

export interface FeatureFlag {
  key: string
  description: string
  enabled: boolean
  tenantOverrides: Map<string, boolean>
  environmentOverrides: Map<string, boolean>
  rolloutPercentage: number
  dependencies: string[]
}

export interface FlagEvaluation {
  key: string
  enabled: boolean
  reason: string
  source: 'default' | 'tenant' | 'environment' | 'rollout'
}

let flags = new Map<string, FeatureFlag>()
let tenantOverrideStore: Map<string, Map<string, boolean>> | null = null
let envOverrideStore: Map<string, Map<string, boolean>> | null = null

export function configureFlagStores(stores: {
  flags?: Map<string, FeatureFlag>
  tenantOverrides?: Map<string, Map<string, boolean>>
  environmentOverrides?: Map<string, Map<string, boolean>>
}): void {
  if (stores.flags) flags = stores.flags
  if (stores.tenantOverrides) tenantOverrideStore = stores.tenantOverrides
  if (stores.environmentOverrides) envOverrideStore = stores.environmentOverrides
}

function getTenantOverride(key: string, tenantId: string): boolean | undefined {
  if (!tenantOverrideStore) return undefined
  const overrides = tenantOverrideStore.get(key)
  if (!overrides) return undefined
  if (typeof (overrides as any).get === 'function') return (overrides as any).get(tenantId)
  return (overrides as any)[tenantId]
}

function setTenantOverrideStore(key: string, tenantId: string, enabled: boolean): void {
  if (!tenantOverrideStore) return
  let overrides = tenantOverrideStore.get(key)
  if (!overrides) {
    overrides = new Map() as any
    tenantOverrideStore.set(key, overrides)
  }
  if (typeof (overrides as any).set === 'function') (overrides as any).set(tenantId, enabled)
  else (overrides as any)[tenantId] = enabled
}

function getEnvOverride(key: string, env: string): boolean | undefined {
  if (!envOverrideStore) return undefined
  const overrides = envOverrideStore.get(key)
  if (!overrides) return undefined
  if (typeof (overrides as any).get === 'function') return (overrides as any).get(env)
  return (overrides as any)[env]
}

function setEnvOverrideStore(key: string, env: string, enabled: boolean): void {
  if (!envOverrideStore) return
  let overrides = envOverrideStore.get(key)
  if (!overrides) {
    overrides = new Map() as any
    envOverrideStore.set(key, overrides)
  }
  if (typeof (overrides as any).set === 'function') (overrides as any).set(env, enabled)
  else (overrides as any)[env] = enabled
}

export function defineFlag(key: string, description: string, enabled = false, dependencies: string[] = []): void {
  flags.set(key, {
    key,
    description,
    enabled,
    tenantOverrides: new Map(),
    environmentOverrides: new Map(),
    rolloutPercentage: 100,
    dependencies,
  })
}

export function defineFlags(flagDefs: Array<{ key: string; description: string; enabled?: boolean; dependencies?: string[] }>): void {
  for (const def of flagDefs) {
    defineFlag(def.key, def.description, def.enabled, def.dependencies)
  }
}

export function isEnabled(key: string, options?: { tenantId?: string; environment?: string }): FlagEvaluation {
  const flag = flags.get(key)
  if (!flag) {
    return { key, enabled: false, reason: `Unknown flag: ${key}`, source: 'default' }
  }

  for (const dep of flag.dependencies) {
    const depResult = isEnabled(dep, options)
    if (!depResult.enabled) {
      return { key, enabled: false, reason: `Dependency not met: ${dep}`, source: 'default' }
    }
  }

  if (options?.tenantId) {
    const tenantOverride = flag.tenantOverrides.get(options.tenantId) ?? getTenantOverride(key, options.tenantId)
    if (tenantOverride !== undefined) {
      return { key, enabled: tenantOverride, reason: `Tenant override: ${options.tenantId}`, source: 'tenant' }
    }
  }

  if (options?.environment) {
    const envOverride = flag.environmentOverrides.get(options.environment) ?? getEnvOverride(key, options.environment)
    if (envOverride !== undefined) {
      return { key, enabled: envOverride, reason: `Environment override: ${options.environment}`, source: 'environment' }
    }
  }

  if (flag.rolloutPercentage < 100 && options?.tenantId) {
    const hash = hashTenant(options.tenantId)
    const inRollout = (hash % 100) < flag.rolloutPercentage
    if (inRollout !== flag.enabled) {
      return { key, enabled: inRollout, reason: `Rollout: ${flag.rolloutPercentage}%`, source: 'rollout' }
    }
  }

  return { key, enabled: flag.enabled, reason: 'Default value', source: 'default' }
}

function hashTenant(tenantId: string): number {
  let hash = 0
  for (let i = 0; i < tenantId.length; i++) {
    const char = tenantId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

export function setTenantOverride(key: string, tenantId: string, enabled: boolean): void {
  const flag = flags.get(key)
  if (!flag) {
    logger.warn(`Cannot set tenant override for unknown flag: ${key}`)
    return
  }
  flag.tenantOverrides.set(tenantId, enabled)
  setTenantOverrideStore(key, tenantId, enabled)
  logger.info(`Flag ${key} set to ${enabled} for tenant ${tenantId}`)
}

export function setEnvironmentOverride(key: string, environment: string, enabled: boolean): void {
  const flag = flags.get(key)
  if (!flag) {
    logger.warn(`Cannot set environment override for unknown flag: ${key}`)
    return
  }
  flag.environmentOverrides.set(environment, enabled)
  setEnvOverrideStore(key, environment, enabled)
  logger.info(`Flag ${key} set to ${enabled} for environment ${environment}`)
}

export function setRolloutPercentage(key: string, percentage: number): void {
  const flag = flags.get(key)
  if (!flag) {
    logger.warn(`Cannot set rollout for unknown flag: ${key}`)
    return
  }
  flag.rolloutPercentage = Math.max(0, Math.min(100, percentage))
  logger.info(`Flag ${key} rollout set to ${percentage}%`)
}

export function getFlag(key: string): FeatureFlag | undefined {
  return flags.get(key)
}

export function getAllFlags(): FeatureFlag[] {
  return Array.from(flags.values())
}

export function getAllEvaluations(options?: { tenantId?: string; environment?: string }): FlagEvaluation[] {
  return Array.from(flags.keys()).map(key => isEnabled(key, options))
}

const ENTERPRISE_FLAGS: Array<{ key: string; description: string; enabled: boolean; dependencies: string[] }> = [
  { key: 'accounting.autoReconciliation', description: 'Enable auto-reconciliation of accounts', enabled: false, dependencies: [] },
  { key: 'accounting.multiCurrency', description: 'Enable multi-currency support', enabled: false, dependencies: [] },
  { key: 'accounting.costCenters', description: 'Enable cost center allocation', enabled: false, dependencies: [] },
  { key: 'accounting.branchAccounting', description: 'Enable branch-level accounting', enabled: false, dependencies: [] },
  { key: 'accounting.approvalWorkflow', description: 'Enable journal approval workflows', enabled: false, dependencies: [] },
  { key: 'accounting.recurringJournals', description: 'Enable recurring journal entries', enabled: true, dependencies: [] },
  { key: 'accounting.aiInsights', description: 'Enable AI-powered accounting insights', enabled: false, dependencies: [] },
  { key: 'compliance.ifrs', description: 'Enable IFRS compliance features', enabled: false, dependencies: [] },
  { key: 'compliance.vat', description: 'Enable VAT compliance features', enabled: false, dependencies: ['accounting.multiCurrency'] },
  { key: 'compliance.soc2', description: 'Enable SOC2 audit features', enabled: false, dependencies: [] },
  { key: 'security.advancedAudit', description: 'Enable advanced audit trail', enabled: false, dependencies: [] },
  { key: 'security.tamperDetection', description: 'Enable tamper detection', enabled: true, dependencies: [] },
  { key: 'security.sessionHardening', description: 'Enable session hardening', enabled: true, dependencies: [] },
  { key: 'observability.distributedTracing', description: 'Enable distributed tracing', enabled: false, dependencies: [] },
  { key: 'observability.metricsExport', description: 'Enable Prometheus metrics export', enabled: false, dependencies: [] },
  { key: 'multiRegion.activeActive', description: 'Enable active-active multi-region', enabled: false, dependencies: [] },
  { key: 'multiRegion.readReplicas', description: 'Enable read replica support', enabled: false, dependencies: [] },
  { key: 'performance.caching', description: 'Enable query result caching', enabled: true, dependencies: [] },
  { key: 'performance.materializedViews', description: 'Enable materialized view optimization', enabled: true, dependencies: [] },
  { key: 'backup.continuous', description: 'Enable continuous backup', enabled: false, dependencies: [] },
  { key: 'queue.priority', description: 'Enable priority queuing', enabled: false, dependencies: [] },
]

export function registerEnterpriseFlags(): void {
  defineFlags(ENTERPRISE_FLAGS)
  logger.info(`Registered ${ENTERPRISE_FLAGS.length} enterprise feature flags`)
}

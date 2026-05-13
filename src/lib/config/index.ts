export {
  defineConfig,
  defineConfigs,
  getDefinition,
  getAllDefinitions,
  setConfig,
  getConfig,
  getConfigWithMeta,
  getAllConfigs,
  onConfigChange,
  resetConfig,
  getSensitiveConfig,
  registerEnterpriseConfigs,
} from './runtime-config'

export type { ConfigValueType, ConfigDefinition, ConfigEntry } from './runtime-config'

export {
  defineFlag,
  defineFlags,
  isEnabled,
  setTenantOverride,
  setEnvironmentOverride,
  setRolloutPercentage,
  getFlag,
  getAllFlags,
  getAllEvaluations,
  registerEnterpriseFlags,
} from './feature-flags'

export type { FeatureFlag, FlagEvaluation } from './feature-flags'

export {
  loadDefaultRegions,
  registerRegion,
  getRegion,
  getAllRegions,
  getActiveRegions,
  getPrimaryRegion,
  assignTenantToRegion,
  getTenantAssignment,
  getTenantReadEndpoints,
  failoverTenant,
  performRegionHealthCheck,
  registerReplica,
  getReplicas,
  updateReplicaLag,
  selectReadReplica,
  getTenantRegionDistribution,
} from './region-manager'

export type { Region, ReplicaInfo, TenantRegionAssignment } from './region-manager'

export {
  defineRole,
  getRole,
  getAllRoles,
  assignRole,
  revokeRole,
  getUserRoles,
  checkPermission,
  hasPermission,
  filterByPermission,
  registerSystemRoles,
} from './advanced-rbac'

export type { Permission, PermissionCondition, Role, UserRole, PermissionEvaluation } from './advanced-rbac'

export {
  createSession,
  validateSession,
  touchSession,
  destroySession,
  destroyAllUserSessions,
  getActiveSessions,
  rotateToken,
  getLoginAnomalies,
  clearAnomalies,
} from './session-hardening'

export type { SessionPolicy, SessionInfo } from './session-hardening'

export {
  recordIntegrity,
  verifyIntegrity,
  getIntegrityChain,
  getTamperEvents,
  createTamperDetectionConfig,
  hashEntityData,
} from './tamper-detection'

export type { IntegrityRecord, TamperEvent, TamperDetectionConfig } from './tamper-detection'

export {
  checkRateLimit,
  recordAbuseEvent,
  trackPattern,
  isBlocked,
  blockIP,
  unblockIP,
  getBlockedIPs,
  getAbuseEvents,
  clearAbuseState,
} from './abuse-detection'

export type { RateLimitState, AbuseEvent, EscalationAction } from './abuse-detection'

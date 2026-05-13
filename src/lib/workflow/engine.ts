import {
  WorkflowInstance, WorkflowStep, WorkflowStatus, StepStatus, WorkflowEvent, ApprovalRequest,
  ApprovalDecision, AssignmentType, EntityLock, ActivityEntry, SLAConfig, SLAThreshold, EscalationPolicy,
  WorkflowDefinition,
} from './types'

export function createWorkflowInstance(def: WorkflowDefinition, context: Record<string, unknown> = {}): WorkflowInstance {
  return {
    id: `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    definitionId: def.id,
    name: def.name,
    status: 'draft',
    currentStepId: def.steps[0]?.id ?? null,
    steps: def.steps.map(s => ({ ...s, status: s.id === def.steps[0]?.id ? 'in_progress' as StepStatus : 'pending' as StepStatus })),
    context,
    owner: def.owner,
    createdAt: Date.now(),
    priority: 'medium',
    tags: [],
  }
}

export function transitionStep(instance: WorkflowInstance, stepId: string, newStatus: StepStatus): WorkflowInstance {
  const steps = instance.steps.map(s => s.id === stepId ? { ...s, status: newStatus, completionTime: (newStatus === 'completed' || newStatus === 'failed') ? Date.now() : s.completionTime } : s)
  const currentIdx = steps.findIndex(s => s.status === 'in_progress')
  const nextStep = steps.find((s, i) => s.status === 'pending' && (s.dependsOn.length === 0 || s.dependsOn.every(d => steps.find(st => st.id === d)?.status === 'completed')))
  return {
    ...instance,
    steps,
    currentStepId: nextStep?.id ?? (steps.every(s => s.status === 'completed' || s.status === 'skipped') ? null : instance.currentStepId),
    status: steps.every(s => s.status === 'completed' || s.status === 'skipped') ? 'completed' as WorkflowStatus : instance.status,
    completedAt: steps.every(s => s.status === 'completed' || s.status === 'skipped') ? Date.now() : instance.completedAt,
  }
}

export function createWorkflowEvent(instanceId: string, type: WorkflowEvent['type'], userId: string, userName: string, stepId?: string, data?: Record<string, unknown>): WorkflowEvent {
  return { id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, workflowInstanceId: instanceId, type, stepId, userId, userName, timestamp: Date.now(), data }
}

export function createApprovalRequest(instanceId: string, stepId: string, title: string, requestedBy: { id: string; name: string }, assignedTo: Array<{ id: string; name: string; type?: AssignmentType }>, slaMinutes: number): ApprovalRequest {
  return { id: `apr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, workflowInstanceId: instanceId, stepId, title, description: '', requestedBy: { ...requestedBy, type: 'user' }, assignedTo: assignedTo.map((a) => ({ ...a, type: a.type ?? 'user' })), decision: 'pending', slaMinutes, createdAt: Date.now(), priority: 'medium', escalationCount: 0 }
}

export function decideApproval(request: ApprovalRequest, decision: ApprovalDecision, userId: string, comments?: string): ApprovalRequest {
  return { ...request, decision, respondedAt: Date.now(), comments }
}

export function calculateSLARemaining(slaMinutes: number, createdAt: number): { remainingMs: number; pctElapsed: number; status: 'ok' | 'warning' | 'critical' | 'breached' } {
  const elapsed = Date.now() - createdAt
  const total = slaMinutes * 60 * 1000
  const pct = (elapsed / total) * 100
  const remaining = Math.max(0, total - elapsed)
  const status = pct >= 100 ? 'breached' : pct >= 85 ? 'critical' : pct >= 60 ? 'warning' : 'ok'
  return { remainingMs: remaining, pctElapsed: pct, status }
}

export function getSLAThresholds(config: SLAConfig, pctElapsed: number): SLAThreshold | null {
  for (let i = config.reminders.length - 1; i >= 0; i--) {
    if (pctElapsed >= (config.reminders[i].atMinutes / config.breachMinutes) * 100) return config.reminders[i]
  }
  return null
}

export function applyEscalationPolicy(request: ApprovalRequest, policy: EscalationPolicy): ApprovalRequest {
  if (request.escalationCount >= policy.maxEscalations) return request
  return { ...request, escalationCount: request.escalationCount + 1, priority: request.priority === 'low' ? 'medium' : request.priority === 'medium' ? 'high' : 'critical' }
}

export function createEntityLock(entityType: string, entityId: string, userId: string, userName: string, sessionId: string, purpose: EntityLock['purpose'], ttlMs = 300000): EntityLock {
  return { entityType, entityId, lockedBy: { id: userId, name: userName }, sessionId, lockedAt: Date.now(), expiresAt: Date.now() + ttlMs, purpose }
}

export function isLockExpired(lock: EntityLock): boolean {
  return Date.now() > lock.expiresAt
}

export function createActivityEntry(entityType: string, entityId: string, entityName: string, action: string, actor: { id: string; name: string }, details: string, category: ActivityEntry['category']): ActivityEntry {
  return { id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, entityType, entityId, entityName, action, actor, timestamp: Date.now(), details, category }
}

export function calculateSLADisplay(slaMinutes: number, createdAt: number) {
  const { remainingMs, pctElapsed, status } = calculateSLARemaining(slaMinutes, createdAt)
  const remainingMin = Math.floor(remainingMs / 60000)
  const remainingSec = Math.floor((remainingMs % 60000) / 1000)
  return { remainingDisplay: remainingMin > 0 ? `${remainingMin}د ${remainingSec}ث` : `${remainingSec}ث`, pctElapsed: Math.round(pctElapsed), status, isBreached: status === 'breached' }
}

export function canTransition(instance: WorkflowInstance, stepId: string, requiredRole?: string): boolean {
  const step = instance.steps.find(s => s.id === stepId)
  if (!step) return false
  if (step.status !== 'in_progress' && step.status !== 'pending') return false
  const depsMet = step.dependsOn.every(d => instance.steps.find(s => s.id === d)?.status === 'completed')
  return depsMet
}

export function findNextExecutableSteps(instance: WorkflowInstance): WorkflowStep[] {
  return instance.steps.filter(s =>
    s.status === 'pending' &&
    (s.dependsOn.length === 0 || s.dependsOn.every(d => instance.steps.find(st => st.id === d)?.status === 'completed'))
  )
}

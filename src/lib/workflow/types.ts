export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed'
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed' | 'escalated'
export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'conditional' | 'delegated'
export type AssignmentType = 'user' | 'role' | 'group' | 'queue'

export interface WorkflowStep {
  id: string
  name: string
  type: 'approval' | 'task' | 'notification' | 'condition' | 'sub_process' | 'escalation'
  status: StepStatus
  assignee?: WorkflowAssignee
  dependsOn: string[]
  slaMinutes?: number
  startTime?: number
  completionTime?: number
  metadata?: Record<string, unknown>
}

export interface WorkflowAssignee {
  type: AssignmentType
  id: string
  name: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  category: 'procure-to-pay' | 'order-to-cash' | 'inventory' | 'payroll' | 'financial-close' | 'reconciliation' | 'approval' | 'custom'
  steps: WorkflowStep[]
  version: number
  owner: WorkflowAssignee
  createdAt: number
  updatedAt: number
}

export interface WorkflowInstance {
  id: string
  definitionId: string
  name: string
  status: WorkflowStatus
  currentStepId: string | null
  steps: WorkflowStep[]
  context: Record<string, unknown>
  owner: WorkflowAssignee
  createdAt: number
  startedAt?: number
  completedAt?: number
  slaBreachAt?: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
}

export interface ApprovalRequest {
  id: string
  workflowInstanceId: string
  stepId: string
  title: string
  description: string
  requestedBy: WorkflowAssignee
  assignedTo: WorkflowAssignee[]
  delegatedTo?: WorkflowAssignee
  decision: ApprovalDecision
  comments?: string
  conditionalRules?: ApprovalCondition[]
  slaMinutes: number
  createdAt: number
  respondedAt?: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  attachments?: string[]
  escalationCount: number
}

export interface ApprovalCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in'
  value: unknown
}

export interface SLAConfig {
  warningMinutes: number
  criticalMinutes: number
  breachMinutes: number
  autoEscalate: boolean
  escalateToRole?: string
  reminders: SLAThreshold[]
}

export interface SLAThreshold {
  atMinutes: number
  action: 'notify' | 'escalate' | 'breach'
  message: string
}

export interface EscalationPolicy {
  id: string
  name: string
  triggers: EscalationTrigger[]
  actions: EscalationAction[]
  maxEscalations: number
}

export interface EscalationTrigger {
  type: 'sla_breach' | 'no_response' | 'rejection' | 'error_count' | 'manual'
  threshold?: number
  withinMinutes?: number
}

export interface EscalationAction {
  type: 'notify' | 'reassign' | 'notify_manager' | 'pause_workflow' | 'cancel_workflow'
  target?: WorkflowAssignee
  message?: string
}

export interface WorkflowEvent {
  id: string
  workflowInstanceId: string
  type: 'started' | 'step_completed' | 'step_failed' | 'approved' | 'rejected' | 'escalated' |
        'delegated' | 'paused' | 'resumed' | 'cancelled' | 'sla_breach' | 'reminder' | 'comment_added' | 'attachment_added'
  stepId?: string
  userId: string
  userName: string
  timestamp: number
  data?: Record<string, unknown>
}

export interface ActivityEntry {
  id: string
  entityType: string
  entityId: string
  entityName: string
  action: string
  actor: { id: string; name: string }
  timestamp: number
  details: string
  category: 'workflow' | 'approval' | 'edit' | 'comment' | 'system' | 'lock' | 'escalation' | 'notification'
  metadata?: Record<string, unknown>
  relatedEntities?: Array<{ type: string; id: string; name: string }>
}

export interface EntityLock {
  entityType: string
  entityId: string
  lockedBy: { id: string; name: string }
  sessionId: string
  lockedAt: number
  expiresAt: number
  purpose: 'edit' | 'approve' | 'process'
  metadata?: Record<string, unknown>
}

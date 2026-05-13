export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in'

export type TriggerEvent = 'workflow.created' | 'workflow.stage_changed' | 'workflow.completed' | 'workflow.failed' | 'approval.pending' | 'approval.decided' | 'approval.escalated' | 'sla.warning' | 'sla.breached' | 'entity.created' | 'entity.updated' | 'schedule.cron' | 'schedule.interval'

export type RuleActionType = 'send_notification' | 'escalate' | 'assign' | 'transition' | 'approve_auto' | 'reject_auto' | 'update_entity' | 'call_webhook' | 'pause_workflow' | 'cancel_workflow' | 'send_email' | 'log_event'

export interface Condition {
  id: string
  field: string
  operator: ConditionOperator
  value: string
  label: string
}

export interface RuleAction {
  id: string
  type: RuleActionType
  config: Record<string, string>
  label: string
  enabled: boolean
}

export interface ConditionGroup {
  id: string
  conditions: Condition[]
  logic: 'and' | 'or'
  label: string
}

export interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: TriggerEvent
  triggerConfig: Record<string, string>
  conditions: ConditionGroup[]
  actions: RuleAction[]
  enabled: boolean
  priority: number
  category: string
  createdAt: number
  updatedAt: number
  lastTriggered?: number
  executionCount: number
}

export interface TriggerOption {
  event: TriggerEvent
  label: string
  description: string
  icon: string
  category: 'workflow' | 'approval' | 'sla' | 'entity' | 'schedule'
}

export interface EscalationLevel {
  level: number
  afterMinutes: number
  action: 'notify' | 'reassign' | 'notify_manager' | 'escalate_to_director'
  target: string
  notifyChannels: ('in_app' | 'email')[]
}

export interface SimulationScenario {
  id: string
  name: string
  description: string
  rule: AutomationRule
  result: {
    triggered: boolean
    conditionsMet: boolean
    executionPath: string[]
    duration: number
    actionsExecuted: string[]
  }
}

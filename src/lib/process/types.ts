export interface ProcessStage {
  id: string
  name: string
  order: number
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed'
  assignee?: { id: string; name: string }
  slaMinutes?: number
  startedAt?: number
  completedAt?: number
}

export interface ProcessApproval {
  id: string
  stageId: string
  title: string
  requestedBy: { id: string; name: string }
  assignedTo: { id: string; name: string }
  decision: 'pending' | 'approved' | 'rejected'
  comments?: string
  createdAt: number
  respondedAt?: number
}

export interface ProcessActivity {
  id: string
  type: 'stage_change' | 'approval' | 'comment' | 'system' | 'escalation' | 'attachment'
  action: string
  actor: { id: string; name: string }
  timestamp: number
  details: string
  stageId?: string
}

export interface ProcessItem {
  id: string
  type: string
  title: string
  refNumber: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: ProcessStage['status']
  stages: ProcessStage[]
  currentStage: string
  approvals: ProcessApproval[]
  activities: ProcessActivity[]
  owner: { id: string; name: string }
  amount?: number
  currency?: string
  createdAt: number
  slaMinutes: number
  tags: string[]
  linkedModules: { label: string; href: string; icon: string }[]
  aiRecommendation?: string
}

export interface ProcessFlowMetrics {
  totalItems: number
  activeItems: number
  completedItems: number
  overdueItems: number
  avgCompletionTime: number
  totalAmount: number
  pendingApprovals: number
}

export type ProcessStageTemplate = {
  id: string
  name: string
  order: number
  slaMinutes: number
  assigneeRole: string
}

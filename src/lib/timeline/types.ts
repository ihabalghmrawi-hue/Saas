export interface TimelineEntry {
  id: string
  type: 'entity' | 'workflow' | 'audit' | 'approval' | 'operation' | 'system'
  action: string
  entityType: string
  entityId: string
  entityName: string
  actor: { id: string; name: string; avatar?: string }
  timestamp: number
  details: string
  severity?: 'info' | 'warning' | 'error' | 'success'
  category: string
  metadata?: Record<string, unknown>
  relatedEntities?: { type: string; id: string; name: string }[]
  source: string
}

export interface ActivityStream {
  id: string
  name: string
  entries: TimelineEntry[]
  unread: number
  lastActivity: number
}

export interface ApprovalHistoryEntry {
  id: string
  approvalId: string
  workflowInstanceId: string
  workflowName: string
  stepName: string
  title: string
  decision: 'pending' | 'approved' | 'rejected' | 'delegated' | 'escalated'
  requestedBy: { id: string; name: string }
  decidedBy?: { id: string; name: string }
  createdAt: number
  respondedAt?: number
  slaMinutes: number
  comments?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  escalationCount: number
}

export interface ActivityCorrelation {
  id: string
  correlationKey: string
  entries: TimelineEntry[]
  startTime: number
  endTime: number
  duration: number
  type: string
  status: 'in_progress' | 'completed' | 'failed'
}

export interface TimelineFilter {
  types?: TimelineEntry['type'][]
  categories?: string[]
  actors?: string[]
  dateFrom?: number
  dateTo?: number
  search?: string
  severity?: TimelineEntry['severity'][]
}

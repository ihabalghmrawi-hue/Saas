export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationCategory = 'approval' | 'escalation' | 'reminder' | 'alert' | 'system' | 'workflow'
export type NotificationStatus = 'unread' | 'read' | 'archived'

export interface NotificationAction {
  id: string
  label: string
  type: 'primary' | 'secondary' | 'danger'
  icon?: string
  handler?: () => void
}

export interface OperationalNotification {
  id: string
  title: string
  description: string
  category: NotificationCategory
  priority: NotificationPriority
  status: NotificationStatus
  timestamp: number
  actor?: { id: string; name: string }
  source: string
  relatedEntity?: { type: string; id: string; name: string }
  actions: NotificationAction[]
  slaMinutes?: number
  escalationCount?: number
  expiryDate?: number
  metadata?: Record<string, unknown>
  groupKey?: string
}

export interface NotificationGroup {
  key: string
  title: string
  notifications: OperationalNotification[]
  unread: number
  expanded: boolean
}

export interface NotificationInboxState {
  notifications: OperationalNotification[]
  filter: {
    category: NotificationCategory | 'all'
    priority: NotificationPriority | 'all'
    status: 'all' | 'unread' | 'read'
    search: string
  }
  selectedIds: Set<string>
  view: 'list' | 'detail'
  selectedNotification: OperationalNotification | null
}

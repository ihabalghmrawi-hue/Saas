'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Bell, BellRing, Filter, Search, CheckCheck, Archive,
  Trash2, AlertTriangle, Clock, Inbox, ChevronDown,
  Menu, X, Settings, List, Layers, Eye, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ActionableNotificationCard } from './ActionableNotificationCard'
import { EscalationAlert } from './EscalationAlert'
import { WorkflowReminderCard } from './WorkflowReminderCard'
import { generateMockNotifications, generateMockNotificationGroups } from '@/lib/notification/mock-data'
import type { OperationalNotification, NotificationCategory, NotificationGroup } from '@/lib/notification/types'

const categoryLabels: Record<NotificationCategory | 'all', string> = {
  all: 'الكل',
  approval: 'الموافقات',
  escalation: 'التصعيدات',
  reminder: 'التذكيرات',
  alert: 'التنبيهات',
  system: 'النظام',
  workflow: 'سير العمل',
}

const categoryColors: Record<NotificationCategory | 'all', string> = {
  all: 'bg-gray-100 text-gray-800 hover:bg-gray-200 data-[active=true]:bg-gray-800 data-[active=true]:text-white',
  approval: 'bg-blue-50 text-blue-700 hover:bg-blue-100 data-[active=true]:bg-blue-600 data-[active=true]:text-white',
  escalation: 'bg-red-50 text-red-700 hover:bg-red-100 data-[active=true]:bg-red-600 data-[active=true]:text-white',
  reminder: 'bg-amber-50 text-amber-700 hover:bg-amber-100 data-[active=true]:bg-amber-600 data-[active=true]:text-white',
  alert: 'bg-orange-50 text-orange-700 hover:bg-orange-100 data-[active=true]:bg-orange-600 data-[active=true]:text-white',
  system: 'bg-purple-50 text-purple-700 hover:bg-purple-100 data-[active=true]:bg-purple-600 data-[active=true]:text-white',
  workflow: 'bg-teal-50 text-teal-700 hover:bg-teal-100 data-[active=true]:bg-teal-600 data-[active=true]:text-white',
}

function relativeDay(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const dayOf = date.getTime()

  if (dayOf >= today) return 'اليوم'
  if (dayOf >= yesterday) return 'أمس'
  if (dayOf >= today - 6 * 86400000) return 'هذا الأسبوع'
  return 'سابقاً'
}

function groupByDate(items: OperationalNotification[]): Map<string, OperationalNotification[]> {
  const groups = new Map<string, OperationalNotification[]>()
  for (const item of items) {
    const day = relativeDay(item.timestamp)
    const existing = groups.get(day) ?? []
    existing.push(item)
    groups.set(day, existing)
  }
  return groups
}

export function OperationalNotificationInbox() {
  const [notifications, setNotifications] = useState(generateMockNotifications(30))
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'list' | 'groups'>('list')
  const [selectedNotification, setSelectedNotification] = useState<OperationalNotification | null>(null)
  const [notificationGroups] = useState(generateMockNotificationGroups)

  const filtered = useMemo(() => {
    let result = notifications

    if (filter !== 'all') {
      result = result.filter(n => n.category === filter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => b.timestamp - a.timestamp)
  }, [notifications, filter, searchQuery])

  const unreadCount = useMemo(() =>
    notifications.filter(n => n.status === 'unread').length,
    [notifications]
  )

  const criticalCount = useMemo(() =>
    notifications.filter(n => n.priority === 'critical').length,
    [notifications]
  )

  const escalationCount = useMemo(() =>
    notifications.filter(n => n.category === 'escalation').length,
    [notifications]
  )

  const pendingApprovalCount = useMemo(() =>
    notifications.filter(n => n.category === 'approval' && n.status === 'unread').length,
    [notifications]
  )

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)))
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id && n.status === 'unread'
          ? { ...n, status: 'read' as const }
          : n
      )
    )
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n =>
        n.status === 'unread' ? { ...n, status: 'read' as const } : n
      )
    )
    setSelectedIds(new Set())
  }

  const archive = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (selectedNotification?.id === id) {
      setSelectedNotification(null)
    }
  }

  const archiveSelected = () => {
    setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)))
    if (selectedNotification && selectedIds.has(selectedNotification.id)) {
      setSelectedNotification(null)
    }
    setSelectedIds(new Set())
  }

  const handleAction = (notificationId: string, actionId: string) => {
    if (actionId === 'dismiss' || actionId === 'archive') {
      archive(notificationId)
      return
    }
    if (actionId === 'acknowledge' || actionId === 'view-task' || actionId === 'view' || actionId === 'confirm') {
      markAsRead(notificationId)
      return
    }
    markAsRead(notificationId)
  }

  const handleNotificationClick = (n: OperationalNotification) => {
    setSelectedNotification(prev => prev?.id === n.id ? null : n)
    if (n.status === 'unread') {
      markAsRead(n.id)
    }
  }

  return (
    <div dir="rtl" className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">صندوق التنبيهات التشغيلية</h1>
          <p className="text-sm text-gray-500 mt-0.5">متابعة وإدارة التنبيهات والإشعارات</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">إجمالي التنبيهات</p>
            <p className="text-2xl font-bold text-blue-900">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 font-medium mb-1">غير مقروء</p>
            <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 font-medium mb-1">تنبيهات حرجة</p>
            <p className="text-2xl font-bold text-red-900">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <CardContent className="p-4">
            <p className="text-xs text-orange-600 font-medium mb-1">تصعيدات</p>
            <p className="text-2xl font-bold text-orange-900">{escalationCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">موافقات معلقة</p>
            <p className="text-2xl font-bold text-blue-900">{pendingApprovalCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(Object.keys(categoryLabels) as Array<NotificationCategory | 'all'>).map((cat) => (
          <button
            key={cat}
            data-active={filter === cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
              categoryColors[cat],
            )}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="بحث في التنبيهات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn('text-xs h-9 px-3', view === 'list' && 'bg-gray-100')}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4 ml-1" />
            قائمة
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('text-xs h-9 px-3', view === 'groups' && 'bg-gray-100')}
            onClick={() => setView('groups')}
          >
            <Layers className="h-4 w-4 ml-1" />
            مجموعات
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={markAllAsRead}
            className="text-xs h-8 px-3"
          >
            <CheckCheck className="h-4 w-4 ml-1" />
            تحديد الكل كمقروء
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={archiveSelected}
            className="text-xs h-8 px-3 text-red-600 hover:text-red-700"
          >
            <Archive className="h-4 w-4 ml-1" />
            أرشفة
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className={cn(
          'flex flex-col gap-2',
          selectedNotification ? 'w-1/2' : 'w-full',
        )}>
          {view === 'list' ? (
            <>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Inbox className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">
                    {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد تنبيهات'}
                  </p>
                </div>
              ) : (
                Array.from(groupByDate(filtered).entries()).map(([day, items]) => (
                  <div key={day}>
                    <h3 className="text-xs font-semibold text-gray-500 px-1 py-2 sticky top-0 bg-white z-10">
                      {day}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {items.map((n) => {
                        const isSelected = selectedNotification?.id === n.id
                        if (n.category === 'escalation') {
                          return (
                            <div key={n.id} className="relative">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(n.id)}
                                onChange={() => toggleSelect(n.id)}
                                className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <EscalationAlert
                                notification={n}
                                onAcknowledge={() => handleAction(n.id, 'acknowledge')}
                                onEscalate={() => handleAction(n.id, 'escalate')}
                                onAssign={() => handleAction(n.id, 'reassign')}
                              />
                            </div>
                          )
                        }
                        if (n.category === 'reminder') {
                          return (
                            <div key={n.id} className="relative">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(n.id)}
                                onChange={() => toggleSelect(n.id)}
                                className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <WorkflowReminderCard
                                notification={n}
                                onDismiss={() => handleAction(n.id, 'dismiss')}
                                onSnooze={() => handleAction(n.id, 'snooze')}
                                onAction={() => handleAction(n.id, 'view-task')}
                              />
                            </div>
                          )
                        }
                        return (
                          <div key={n.id} className="relative">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(n.id)}
                              onChange={() => toggleSelect(n.id)}
                              className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <ActionableNotificationCard
                              notification={n}
                              selected={isSelected}
                              onClick={() => handleNotificationClick(n)}
                              onAction={(actionId) => handleAction(n.id, actionId)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {notificationGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Inbox className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">لا توجد مجموعات</p>
                </div>
              ) : (
                notificationGroups.map((group) => (
                  <div key={group.key} className="rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">{group.title}</h3>
                      {group.unread > 0 && (
                        <Badge variant="default" className="bg-blue-600 text-xs px-2">
                          {group.unread} غير مقروء
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.notifications.map((n) => {
                        const isSelected = selectedNotification?.id === n.id
                        if (n.category === 'escalation') {
                          return (
                            <div key={n.id} className="relative">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(n.id)}
                                onChange={() => toggleSelect(n.id)}
                                className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <EscalationAlert
                                notification={n}
                                onAcknowledge={() => handleAction(n.id, 'acknowledge')}
                                onEscalate={() => handleAction(n.id, 'escalate')}
                                onAssign={() => handleAction(n.id, 'reassign')}
                              />
                            </div>
                          )
                        }
                        if (n.category === 'reminder') {
                          return (
                            <div key={n.id} className="relative">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(n.id)}
                                onChange={() => toggleSelect(n.id)}
                                className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <WorkflowReminderCard
                                notification={n}
                                onDismiss={() => handleAction(n.id, 'dismiss')}
                                onSnooze={() => handleAction(n.id, 'snooze')}
                                onAction={() => handleAction(n.id, 'view-task')}
                              />
                            </div>
                          )
                        }
                        return (
                          <div key={n.id} className="relative">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(n.id)}
                              onChange={() => toggleSelect(n.id)}
                              className="absolute top-3 right-3 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <ActionableNotificationCard
                              notification={n}
                              selected={isSelected}
                              onClick={() => handleNotificationClick(n)}
                              onAction={(actionId) => handleAction(n.id, actionId)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {selectedNotification && (
          <div className="w-1/2 space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">تفاصيل التنبيه</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSelectedNotification(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {selectedNotification.category === 'escalation' ? (
                  <EscalationAlert
                    notification={selectedNotification}
                    onAcknowledge={() => handleAction(selectedNotification.id, 'acknowledge')}
                    onEscalate={() => handleAction(selectedNotification.id, 'escalate')}
                    onAssign={() => handleAction(selectedNotification.id, 'reassign')}
                  />
                ) : selectedNotification.category === 'reminder' ? (
                  <WorkflowReminderCard
                    notification={selectedNotification}
                    onDismiss={() => handleAction(selectedNotification.id, 'dismiss')}
                    onSnooze={() => handleAction(selectedNotification.id, 'snooze')}
                    onAction={() => handleAction(selectedNotification.id, 'view-task')}
                  />
                ) : (
                  <ActionableNotificationCard
                    notification={selectedNotification}
                    selected
                    onAction={(actionId) => handleAction(selectedNotification.id, actionId)}
                  />
                )}

                {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">بيانات إضافية</h4>
                    <div className="space-y-1">
                      {Object.entries(selectedNotification.metadata).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{key}</span>
                          <span className="text-gray-800">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">معلومات إضافية</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <User className="h-3.5 w-3.5" />
                      <span>المصدر: {selectedNotification.source}</span>
                    </div>
                    {selectedNotification.relatedEntity && (
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Bell className="h-3.5 w-3.5" />
                        <span>الجهة: {selectedNotification.relatedEntity.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(selectedNotification.timestamp).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Eye className="h-3.5 w-3.5" />
                      <span>
                        {selectedNotification.status === 'unread' ? 'غير مقروء' :
                         selectedNotification.status === 'read' ? 'مقروء' : 'مؤرشف'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedNotification.status === 'unread' && selectedNotification.actions.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">الإجراءات</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNotification.actions.map((action) => (
                        <Button
                          key={action.id}
                          variant={
                            action.type === 'danger' ? 'destructive' :
                            action.type === 'primary' ? 'default' : 'outline'
                          }
                          size="sm"
                          className="text-xs"
                          onClick={() => handleAction(selectedNotification.id, action.id)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">التنبيهات ذات الصلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {notifications
                    .filter(n => n.id !== selectedNotification.id && n.groupKey === selectedNotification.groupKey)
                    .slice(0, 3)
                    .map((n) => (
                      <ActionableNotificationCard
                        key={n.id}
                        notification={n}
                        onClick={() => setSelectedNotification(n)}
                        onAction={(actionId) => handleAction(n.id, actionId)}
                      />
                    ))}
                  {notifications.filter(n => n.id !== selectedNotification.id && n.groupKey === selectedNotification.groupKey).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">لا توجد تنبيهات ذات صلة</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

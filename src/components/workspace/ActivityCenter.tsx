'use client'

import { cn } from '@/lib/utils'
import { Bell, X, CheckCheck, Info, AlertTriangle, AlertCircle, ChevronLeft } from 'lucide-react'
import { useGlobalWorkspaceActions } from '@/lib/workspace/provider'

const NOTIFICATIONS = [
  { id: '1', title: 'تم ترحيل قيد يومية', description: 'قيد رقم INV-2024-001 تم ترحيله بنجاح', time: 'منذ 5 دقائق', type: 'success', read: false },
  { id: '2', title: 'تنبيه مخزون', description: 'منتج "لابتوب HP" وصل للحد الأدنى', time: 'منذ 15 دقيقة', type: 'warning', read: false },
  { id: '3', title: 'فواتير معلقة', description: 'هناك 3 فواتير مبيعات بانتظار الاعتماد', time: 'منذ ساعة', type: 'info', read: false },
  { id: '4', title: 'خطأ في الترحيل', description: 'فشل ترحيل قيد اليومية - رصيد غير كافٍ', time: 'منذ ساعتين', type: 'error', read: true },
]

const ACTIVITIES = [
  { id: '1', user: 'أحمد محمد', action: 'أضاف قيد يومية جديد', target: 'INV-2024-001', time: 'قبل 10 دقائق' },
  { id: '2', user: 'سارة خالد', action: 'اعتمدت فاتورة مبيعات', target: 'SLS-2024-042', time: 'قبل 25 دقيقة' },
  { id: '3', user: 'محمد علي', action: 'حدث حركة مخزون', target: 'منتج لابتوب HP', time: 'قبل ساعة' },
  { id: '4', user: 'نورة أحمد', action: 'أضافت عميل جديد', target: 'شركة الأفق', time: 'قبل ساعتين' },
  { id: '5', user: 'خالد عمر', action: 'صدّر تقرير الميزانية', target: 'تقرير شهري', time: 'قبل 3 ساعات' },
]

const TYPE_ICONS: Record<string, typeof Bell> = {
  success: CheckCheck,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
}

const TYPE_CLASSES: Record<string, string> = {
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-destructive bg-destructive/10',
  info: 'text-primary bg-primary/10',
}

export function ActivityCenter() {
  const { state, toggleActivityCenter } = useGlobalWorkspaceActions()
  const isOpen = state.activityCenter.open

  return (
    <div
      className={cn(
        'fixed inset-y-0 left-0 z-[80] w-[420px] bg-card border-l shadow-2xl transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">مركز الأنشطة</h2>
        <button onClick={toggleActivityCenter} className="p-1 hover:bg-accent rounded">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
        <h3 className="text-xs font-medium text-muted-foreground">آخر النشاطات</h3>
        {ACTIVITIES.map(activity => (
          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {activity.user.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{activity.user}</span>{' '}
                {activity.action}{' '}
                <span className="font-medium text-primary">{activity.target}</span>
              </p>
              <span className="text-xs text-muted-foreground">{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NotificationCenter() {
  const { state, toggleNotificationCenter } = useGlobalWorkspaceActions()
  const isOpen = state.notificationCenter.open

  return (
    <div
      className={cn(
        'fixed inset-y-0 left-[420px] z-[80] w-[380px] bg-card border-l shadow-2xl transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">الإشعارات</h2>
          <span className="px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
            {NOTIFICATIONS.filter(n => !n.read).length}
          </span>
        </div>
        <button onClick={toggleNotificationCenter} className="p-1 hover:bg-accent rounded">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-56px)]">
        {NOTIFICATIONS.map(notification => {
          const Icon = TYPE_ICONS[notification.type]
          return (
            <div
              key={notification.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg transition-colors',
                !notification.read ? 'bg-accent/30' : 'hover:bg-accent/50'
              )}
            >
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', TYPE_CLASSES[notification.type])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">{notification.description}</p>
                <span className="text-xs text-muted-foreground">{notification.time}</span>
              </div>
              {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

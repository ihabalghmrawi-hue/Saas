'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, Info, AlertCircle, Package, Receipt, Users, BarChart3, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'error'
  created_at: string
  read: boolean
}

const ICONS: Record<string, React.ElementType> = {
  low_stock:       Package,
  out_of_stock:    Package,
  unpaid_invoices: Receipt,
  daily_summary:   BarChart3,
  customer_debt:   Users,
}

const SEVERITY_STYLES = {
  error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
}

const SEVERITY_ICON_STYLES = {
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
}

export function NotificationsPanel() {
  const [open, setOpen]                     = useState(false)
  const [notifications, setNotifications]   = useState<Notification[]>([])
  const [unread, setUnread]                 = useState(0)
  const [loading, setLoading]               = useState(false)
  const [readIds, setReadIds]               = useState<Set<string>>(new Set())
  const panelRef                            = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fetch on mount and every 2 minutes
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 120_000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res  = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnread(data.unread || 0)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id))
    setReadIds(allIds)
    setUnread(0)
  }

  const markRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setUnread(prev => Math.max(0, prev - 1))
  }

  const isRead = (n: Notification) => n.read || readIds.has(n.id)

  return (
    <div ref={panelRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications() }}
        className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="الإشعارات"
      >
        <Bell className={cn('w-4 h-4', loading && 'animate-pulse')} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-card border rounded-2xl shadow-2xl z-50 overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">الإشعارات</span>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary hover:underline px-2"
                >
                  قراءة الكل
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded-lg">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = ICONS[n.type] || Info
                const read = isRead(n)
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'w-full text-right flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-accent/50',
                      !read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      SEVERITY_STYLES[n.severity]
                    )}>
                      <Icon className={cn('w-3.5 h-3.5', SEVERITY_ICON_STYLES[n.severity])} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-xs font-semibold', !read && 'text-foreground', read && 'text-muted-foreground')}>
                          {n.title}
                        </p>
                        {!read && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t bg-muted/20 text-center">
            <button
              onClick={fetchNotifications}
              className="text-xs text-primary hover:underline"
            >
              تحديث الإشعارات
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

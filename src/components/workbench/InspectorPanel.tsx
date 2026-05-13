'use client'

import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  X, Pin, PinOff, Info, Activity, FileText,
  MessageSquare, Paperclip, AlertTriangle, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InspectorTab } from '@/lib/workbench/types'

export interface InspectorPanelProps {
  open: boolean
  pinned: boolean
  onClose: () => void
  onPin: () => void
  tabs: InspectorTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children?: ReactNode
  title?: string
  width?: number
}

const tabIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  activity: Activity,
  file: FileText,
  message: MessageSquare,
  paperclip: Paperclip,
  alert: AlertTriangle,
}

export function InspectorPanel({
  open,
  pinned,
  onClose,
  onPin,
  tabs,
  activeTab,
  onTabChange,
  children,
  title = 'التفاصيل',
  width = 480,
}: InspectorPanelProps) {
  return (
    <div
      className={cn(
        'border-r bg-background flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out',
        open ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden border-r-0',
      )}
      style={{ width: open ? width : 0, minWidth: open ? width : 0 }}
    >
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPin}
          className={cn('h-8 w-8', pinned && 'text-primary')}
          title={pinned ? 'تثبيت' : 'إلغاء التثبيت'}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
      </div>

      {tabs.length > 0 && (
        <div className="flex border-b shrink-0 overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon ? tabIcons[tab.icon] : undefined
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                  'border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {TabIcon && <TabIcon className="h-4 w-4" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  )
}

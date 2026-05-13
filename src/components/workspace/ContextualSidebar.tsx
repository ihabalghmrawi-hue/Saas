'use client'

import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/provider'
import { useWorkspaceActions } from '@/lib/workspace/provider'
import { X, Pin, PinOff } from 'lucide-react'
import * as React from 'react'

interface ContextualSidebarProps {
  workspaceId: string
  width?: number
}

export function ContextualSidebar({ workspaceId, width = 380 }: ContextualSidebarProps) {
  const { state } = useWorkspace()
  const { toggleContextualSidebar } = useWorkspaceActions(workspaceId)
  const ws = state.workspaces[workspaceId]
  if (!ws) return null

  const { contextualSidebar } = ws
  if (!contextualSidebar.open && !contextualSidebar.pinned) return null

  return (
    <div
      className={cn(
        'border-l bg-card h-full flex flex-col transition-all duration-300',
        contextualSidebar.open ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
      )}
      style={{ width: contextualSidebar.open ? width : 0, minWidth: contextualSidebar.open ? width : 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">التفاصيل</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleContextualSidebar()}
            className="p-1 hover:bg-accent rounded"
          >
            {contextualSidebar.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            onClick={() => toggleContextualSidebar()}
            className="p-1 hover:bg-accent rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ContextualSidebarPlaceholder />
      </div>
    </div>
  )
}

function ContextualSidebarPlaceholder() {
  return (
    <>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">معلومات</h4>
        <div className="space-y-2">
          {['تاريخ الإنشاء', 'آخر تعديل', 'الحالة', 'المنشئ'].map(label => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">-</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">إجراءات سريعة</h4>
        <div className="space-y-1">
          {['عرض التفاصيل', 'طباعة', 'تصدير PDF', 'إرسال بالبريد'].map(action => (
            <button key={action} className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
              {action}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

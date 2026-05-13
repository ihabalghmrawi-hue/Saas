'use client'

import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/provider'
import { useWorkspaceActions } from '@/lib/workspace/provider'
import { X, Pin } from 'lucide-react'

interface WorkspaceTabsProps {
  workspaceId: string
  className?: string
}

export function WorkspaceTabs({ workspaceId, className }: WorkspaceTabsProps) {
  const { state } = useWorkspace()
  const { setActiveTab, closeTab } = useWorkspaceActions(workspaceId)
  const workspace = state.workspaces[workspaceId]
  if (!workspace) return null

  return (
    <div className={cn('flex items-center gap-px bg-muted/30 border-b overflow-x-auto no-scrollbar', className)}>
      {workspace.tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          onMouseDown={(e) => { if (e.button === 1) closeTab(tab.id) }}
          className={cn(
            'group flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-all whitespace-nowrap',
            'hover:bg-accent/50',
            workspace.activeTabId === tab.id
              ? 'border-primary bg-background text-foreground font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.pinned ? <Pin className="h-3 w-3" /> : null}
          <span>{tab.title}</span>
          {tab.dirty && <span className="h-2 w-2 rounded-full bg-warning" />}
          {!tab.pinned && (
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

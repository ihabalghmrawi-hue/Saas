'use client'

import { cn } from '@/lib/utils'
import { DockablePanel } from '@/lib/workspace/types'
import { useWorkspaceActions } from '@/lib/workspace/provider'
import { X, GripHorizontal, Minimize } from 'lucide-react'

interface DockablePanelProps {
  panel: DockablePanel
  workspaceId: string
  children?: React.ReactNode
}

export function DockablePanelContainer({ panel, workspaceId, children }: DockablePanelProps) {
  const { closePanel, togglePanel } = useWorkspaceActions(workspaceId)

  return (
    <div
      className={cn(
        'border rounded-lg bg-card shadow-sm flex flex-col overflow-hidden',
        panel.minimized && 'h-10',
      )}
      style={panel.width ? { width: panel.width } : undefined}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b cursor-move">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <GripHorizontal className="h-3 w-3" />
          <span>{panel.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel(panel.id)}
            className="p-0.5 hover:bg-accent rounded"
          >
            <Minimize className="h-3 w-3" />
          </button>
          <button
            onClick={() => closePanel(panel.id)}
            className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      {!panel.minimized && <div className="flex-1 overflow-auto p-3">{children}</div>}
    </div>
  )
}

export function PanelGroup({ position, panels, workspaceId, children }: {
  position: string
  panels: DockablePanel[]
  workspaceId: string
  children: (panel: DockablePanel) => React.ReactNode
}) {
  if (panels.length === 0) return null

  return (
    <div
      className={cn(
        'flex gap-2 p-2 bg-muted/20',
        position === 'bottom' ? 'flex-row flex-wrap' : 'flex-col',
      )}
    >
      {panels.map(panel => children(panel))}
    </div>
  )
}

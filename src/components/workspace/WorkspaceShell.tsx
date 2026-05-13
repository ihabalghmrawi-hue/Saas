'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { WorkspaceProvider, useGlobalWorkspaceActions } from '@/lib/workspace/provider'
import { CommandPalette } from '@/components/workspace/CommandPalette'
import { EnterpriseSearch } from '@/components/workspace/EnterpriseSearch'
import { ActivityCenter, NotificationCenter } from '@/components/workspace/ActivityCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { AICopilotSidebar } from '@/components/ai/AICopilotSidebar'
import {
  Command, Search, Bell, Activity, Bot, ChevronLeft,
} from 'lucide-react'

interface WorkspaceShellProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

function WorkspaceShellInner({ children, sidebar }: WorkspaceShellProps) {
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false)
  const { state, openCommandPalette, openSearch, toggleActivityCenter, toggleNotificationCenter } = useGlobalWorkspaceActions()
  useKeyboardShortcuts()

  useEffect(() => {
    const handler = () => openCommandPalette()
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [openCommandPalette])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Enterprise Toolbar */}
      <header className="h-12 border-b bg-card flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={openCommandPalette}
            className="flex items-center gap-2 px-3 h-8 text-sm text-muted-foreground bg-muted/50 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Command className="h-4 w-4" />
            <span>أوامر...</span>
            <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded mr-2">⌘K</kbd>
          </button>
          <button
            onClick={openSearch}
            className="flex items-center gap-2 px-3 h-8 text-sm text-muted-foreground hover:bg-accent/50 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">بحث...</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setAiCopilotOpen(true)}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <Bot className="h-5 w-5" />
          </button>
          <button
            onClick={toggleActivityCenter}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <Activity className="h-5 w-5" />
            {state.activityCenter.unread > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={toggleNotificationCenter}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            {state.notificationCenter.unread > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebar && (
          <aside className="w-60 border-l bg-card shrink-0 overflow-y-auto hidden lg:block">
            {sidebar}
          </aside>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>

      {/* Overlays */}
      <CommandPalette />
      <EnterpriseSearch />
      <ActivityCenter />
      <NotificationCenter />
      <AICopilotSidebar open={aiCopilotOpen} onClose={() => setAiCopilotOpen(false)} />
    </div>
  )
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <WorkspaceProvider>
      <WorkspaceShellInner {...props} />
    </WorkspaceProvider>
  )
}

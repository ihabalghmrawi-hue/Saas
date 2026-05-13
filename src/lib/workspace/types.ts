import { createContext, useContext } from 'react'

export type PanelPosition = 'left' | 'right' | 'bottom' | 'float'

export interface Tab {
  id: string
  title: string
  icon?: string
  path?: string
  pinned?: boolean
  dirty?: boolean
  createdAt: number
}

export interface DockablePanel {
  id: string
  title: string
  position: PanelPosition
  width?: number
  height?: number
  minimized?: boolean
  component: string
  props?: Record<string, unknown>
}

export interface ContextualSidebarState {
  open: boolean
  pinned: boolean
  component: string | null
  props?: Record<string, unknown>
}

export interface CommandPaletteState {
  open: boolean
  query: string
}

export interface EnterpriseSearchState {
  open: boolean
  query: string
  results: unknown[]
  loading: boolean
}

export interface ActivityCenterState {
  open: boolean
  unread: number
}

export interface NotificationCenterState {
  open: boolean
  unread: number
}

export interface Workspace {
  id: string
  title: string
  icon?: string
  route?: string
  tabs: Tab[]
  activeTabId: string | null
  panels: DockablePanel[]
  contextualSidebar: ContextualSidebarState
}

export interface WorkspaceLayout {
  workspaceId: string
  tabOrder: string[]
  activeTabId: string | null
  panelLayout: Record<string, { position: PanelPosition; minimized: boolean }>
  sidebarPinned: boolean
}

export interface WorkspaceState {
  workspaces: Record<string, Workspace>
  activeWorkspaceId: string | null
  commandPalette: CommandPaletteState
  enterpriseSearch: EnterpriseSearchState
  activityCenter: ActivityCenterState
  notificationCenter: NotificationCenterState
  recentEntities: Array<{ id: string; type: string; title: string; path: string }>
  pinnedWorkflows: Array<{ id: string; title: string; icon: string; path: string }>
}

export type WorkspaceAction =
  | { type: 'REGISTER_WORKSPACE'; id: string; title: string; icon?: string; route?: string }
  | { type: 'SET_ACTIVE_WORKSPACE'; id: string }
  | { type: 'OPEN_TAB'; workspaceId: string; tab: Tab }
  | { type: 'CLOSE_TAB'; workspaceId: string; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; workspaceId: string; tabId: string }
  | { type: 'PIN_TAB'; workspaceId: string; tabId: string }
  | { type: 'OPEN_PANEL'; workspaceId: string; panel: DockablePanel }
  | { type: 'CLOSE_PANEL'; workspaceId: string; panelId: string }
  | { type: 'TOGGLE_PANEL'; workspaceId: string; panelId: string }
  | { type: 'SET_PANEL_POSITION'; workspaceId: string; panelId: string; position: PanelPosition }
  | { type: 'TOGGLE_CONTEXTUAL_SIDEBAR'; workspaceId: string }
  | { type: 'PIN_CONTEXTUAL_SIDEBAR'; workspaceId: string }
  | { type: 'SET_CONTEXTUAL_SIDEBAR_CONTENT'; workspaceId: string; component: string | null; props?: Record<string, unknown> }
  | { type: 'OPEN_COMMAND_PALETTE' }
  | { type: 'CLOSE_COMMAND_PALETTE' }
  | { type: 'SET_COMMAND_QUERY'; query: string }
  | { type: 'OPEN_SEARCH' }
  | { type: 'CLOSE_SEARCH' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_RESULTS'; results: unknown[]; loading: boolean }
  | { type: 'TOGGLE_ACTIVITY_CENTER' }
  | { type: 'SET_ACTIVITY_UNREAD'; count: number }
  | { type: 'TOGGLE_NOTIFICATION_CENTER' }
  | { type: 'SET_NOTIFICATION_UNREAD'; count: number }
  | { type: 'ADD_RECENT_ENTITY'; entity: { id: string; type: string; title: string; path: string } }
  | { type: 'PIN_WORKFLOW'; workflow: { id: string; title: string; icon: string; path: string } }
  | { type: 'UNPIN_WORKFLOW'; id: string }
  | { type: 'RESTORE_LAYOUT'; layout: WorkspaceLayout }

export interface WorkspaceContextType {
  state: WorkspaceState
  dispatch: React.Dispatch<WorkspaceAction>
}

export const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

export function useWorkspaceContext(): WorkspaceContextType {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceContext must be used within WorkspaceProvider')
  return ctx
}

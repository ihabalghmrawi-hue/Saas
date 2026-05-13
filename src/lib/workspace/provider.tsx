'use client'

import { useReducer, useCallback, useEffect, useRef, useContext } from 'react'
import { WorkspaceContext, WorkspaceState, WorkspaceAction, Tab, DockablePanel } from './types'
import { workspaceReducer, createInitialState, saveLayout, loadLayout } from './reducer'

interface WorkspaceProviderProps {
  children: React.ReactNode
  defaultWorkspaceId?: string
}

export function WorkspaceProvider({ children, defaultWorkspaceId }: WorkspaceProviderProps) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, () => {
    const initial = createInitialState()
    return initial
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveLayout(state), 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [state])

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}

export function useWorkspaceActions(workspaceId: string) {
  const { state, dispatch } = useWorkspace()

  const workspace: WorkspaceState['workspaces'][string] | undefined = state.workspaces[workspaceId]

  const register = useCallback((title: string, icon?: string, route?: string) => {
    dispatch({ type: 'REGISTER_WORKSPACE', id: workspaceId, title, icon, route })
  }, [workspaceId, dispatch])

  const openTab = useCallback((tab: Tab) => {
    dispatch({ type: 'OPEN_TAB', workspaceId, tab })
  }, [workspaceId, dispatch])

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', workspaceId, tabId })
  }, [workspaceId, dispatch])

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', workspaceId, tabId })
  }, [workspaceId, dispatch])

  const openPanel = useCallback((panel: DockablePanel) => {
    dispatch({ type: 'OPEN_PANEL', workspaceId, panel })
  }, [workspaceId, dispatch])

  const closePanel = useCallback((panelId: string) => {
    dispatch({ type: 'CLOSE_PANEL', workspaceId, panelId })
  }, [workspaceId, dispatch])

  const togglePanel = useCallback((panelId: string) => {
    dispatch({ type: 'TOGGLE_PANEL', workspaceId, panelId })
  }, [workspaceId, dispatch])

  const toggleContextualSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_CONTEXTUAL_SIDEBAR', workspaceId })
  }, [workspaceId, dispatch])

  const setContextualSidebarContent = useCallback((component: string | null, props?: Record<string, unknown>) => {
    dispatch({ type: 'SET_CONTEXTUAL_SIDEBAR_CONTENT', workspaceId, component, props })
  }, [workspaceId, dispatch])

  return {
    workspace,
    register,
    openTab,
    closeTab,
    setActiveTab,
    openPanel,
    closePanel,
    togglePanel,
    toggleContextualSidebar,
    setContextualSidebarContent,
    activeTab: workspace?.tabs.find(t => t.id === workspace.activeTabId) ?? null,
  }
}

export function useGlobalWorkspaceActions() {
  const { state, dispatch } = useWorkspace()

  const setActiveWorkspace = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_WORKSPACE', id })
  }, [dispatch])

  const openCommandPalette = useCallback(() => {
    dispatch({ type: 'OPEN_COMMAND_PALETTE' })
  }, [dispatch])

  const closeCommandPalette = useCallback(() => {
    dispatch({ type: 'CLOSE_COMMAND_PALETTE' })
  }, [dispatch])

  const openSearch = useCallback(() => {
    dispatch({ type: 'OPEN_SEARCH' })
  }, [dispatch])

  const closeSearch = useCallback(() => {
    dispatch({ type: 'CLOSE_SEARCH' })
  }, [dispatch])

  const toggleActivityCenter = useCallback(() => {
    dispatch({ type: 'TOGGLE_ACTIVITY_CENTER' })
  }, [dispatch])

  const toggleNotificationCenter = useCallback(() => {
    dispatch({ type: 'TOGGLE_NOTIFICATION_CENTER' })
  }, [dispatch])

  const addRecentEntity = useCallback((entity: { id: string; type: string; title: string; path: string }) => {
    dispatch({ type: 'ADD_RECENT_ENTITY', entity })
  }, [dispatch])

  const pinWorkflow = useCallback((workflow: { id: string; title: string; icon: string; path: string }) => {
    dispatch({ type: 'PIN_WORKFLOW', workflow })
  }, [dispatch])

  const unpinWorkflow = useCallback((id: string) => {
    dispatch({ type: 'UNPIN_WORKFLOW', id })
  }, [dispatch])

  return {
    state,
    setActiveWorkspace,
    openCommandPalette,
    closeCommandPalette,
    openSearch,
    closeSearch,
    toggleActivityCenter,
    toggleNotificationCenter,
    addRecentEntity,
    pinWorkflow,
    unpinWorkflow,
  }
}

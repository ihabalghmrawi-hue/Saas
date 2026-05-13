import { WorkspaceState, WorkspaceAction, WorkspaceLayout } from './types'

const STORAGE_KEY = 'erp-workspace-layout'

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'REGISTER_WORKSPACE': {
      if (state.workspaces[action.id]) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.id]: {
            id: action.id,
            title: action.title,
            icon: action.icon,
            route: action.route,
            tabs: [],
            activeTabId: null,
            panels: [],
            contextualSidebar: { open: false, pinned: false, component: null },
          },
        },
      }
    }

    case 'SET_ACTIVE_WORKSPACE':
      return { ...state, activeWorkspaceId: action.id }

    case 'OPEN_TAB': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      if (ws.tabs.some(t => t.id === action.tab.id)) {
        return { ...state, workspaces: { ...state.workspaces, [action.workspaceId]: { ...ws, activeTabId: action.tab.id } } }
      }
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: {
            ...ws,
            tabs: [...ws.tabs, action.tab],
            activeTabId: action.tab.id,
          },
        },
      }
    }

    case 'CLOSE_TAB': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      const remaining = ws.tabs.filter(t => t.id !== action.tabId)
      let newActive = ws.activeTabId
      if (newActive === action.tabId) {
        const idx = ws.tabs.findIndex(t => t.id === action.tabId)
        newActive = remaining[Math.min(idx, remaining.length - 1)]?.id ?? null
      }
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...ws, tabs: remaining, activeTabId: newActive },
        },
      }
    }

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...state.workspaces[action.workspaceId], activeTabId: action.tabId },
        },
      }

    case 'PIN_TAB': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: {
            ...ws,
            tabs: ws.tabs.map(t => t.id === action.tabId ? { ...t, pinned: !t.pinned } : t),
          },
        },
      }
    }

    case 'OPEN_PANEL': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws || ws.panels.some(p => p.id === action.panel.id)) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...ws, panels: [...ws.panels, action.panel] },
        },
      }
    }

    case 'CLOSE_PANEL': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...ws, panels: ws.panels.filter(p => p.id !== action.panelId) },
        },
      }
    }

    case 'TOGGLE_PANEL': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: {
            ...ws,
            panels: ws.panels.map(p => p.id === action.panelId ? { ...p, minimized: !p.minimized } : p),
          },
        },
      }
    }

    case 'SET_PANEL_POSITION': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: {
            ...ws,
            panels: ws.panels.map(p => p.id === action.panelId ? { ...p, position: action.position } : p),
          },
        },
      }
    }

    case 'TOGGLE_CONTEXTUAL_SIDEBAR': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...ws, contextualSidebar: { ...ws.contextualSidebar, open: !ws.contextualSidebar.open } },
        },
      }
    }

    case 'PIN_CONTEXTUAL_SIDEBAR': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: { ...ws, contextualSidebar: { ...ws.contextualSidebar, pinned: !ws.contextualSidebar.pinned } },
        },
      }
    }

    case 'SET_CONTEXTUAL_SIDEBAR_CONTENT': {
      const ws = state.workspaces[action.workspaceId]
      if (!ws) return state
      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [action.workspaceId]: {
            ...ws,
            contextualSidebar: { ...ws.contextualSidebar, component: action.component, props: action.props, open: action.component !== null },
          },
        },
      }
    }

    case 'OPEN_COMMAND_PALETTE':
      return { ...state, commandPalette: { ...state.commandPalette, open: true } }

    case 'CLOSE_COMMAND_PALETTE':
      return { ...state, commandPalette: { ...state.commandPalette, open: false, query: '' } }

    case 'SET_COMMAND_QUERY':
      return { ...state, commandPalette: { ...state.commandPalette, query: action.query } }

    case 'OPEN_SEARCH':
      return { ...state, enterpriseSearch: { ...state.enterpriseSearch, open: true } }

    case 'CLOSE_SEARCH':
      return { ...state, enterpriseSearch: { ...state.enterpriseSearch, open: false, query: '', results: [] } }

    case 'SET_SEARCH_QUERY':
      return { ...state, enterpriseSearch: { ...state.enterpriseSearch, query: action.query } }

    case 'SET_SEARCH_RESULTS':
      return { ...state, enterpriseSearch: { ...state.enterpriseSearch, results: action.results, loading: action.loading } }

    case 'TOGGLE_ACTIVITY_CENTER':
      return { ...state, activityCenter: { ...state.activityCenter, open: !state.activityCenter.open } }

    case 'SET_ACTIVITY_UNREAD':
      return { ...state, activityCenter: { ...state.activityCenter, unread: action.count } }

    case 'TOGGLE_NOTIFICATION_CENTER':
      return { ...state, notificationCenter: { ...state.notificationCenter, open: !state.notificationCenter.open } }

    case 'SET_NOTIFICATION_UNREAD':
      return { ...state, notificationCenter: { ...state.notificationCenter, unread: action.count } }

    case 'ADD_RECENT_ENTITY':
      return {
        ...state,
        recentEntities: [action.entity, ...state.recentEntities.filter(e => e.id !== action.entity.id)].slice(0, 20),
      }

    case 'PIN_WORKFLOW':
      if (state.pinnedWorkflows.some(w => w.id === action.workflow.id)) return state
      return { ...state, pinnedWorkflows: [...state.pinnedWorkflows, action.workflow] }

    case 'UNPIN_WORKFLOW':
      return { ...state, pinnedWorkflows: state.pinnedWorkflows.filter(w => w.id !== action.id) }

    case 'RESTORE_LAYOUT':
      return restoreLayout(state, action.layout)

    default:
      return state
  }
}

function restoreLayout(state: WorkspaceState, layout: WorkspaceLayout): WorkspaceState {
  const ws = state.workspaces[layout.workspaceId]
  if (!ws) return state

  const reordered = layout.tabOrder
    .map(id => ws.tabs.find(t => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)

  const remaining = ws.tabs.filter(t => !layout.tabOrder.includes(t.id))

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [layout.workspaceId]: {
        ...ws,
        tabs: [...reordered, ...remaining],
        activeTabId: layout.activeTabId ?? ws.activeTabId,
        contextualSidebar: { ...ws.contextualSidebar, pinned: layout.sidebarPinned },
      },
    },
  }
}

export function saveLayout(state: WorkspaceState): void {
  if (typeof window === 'undefined') return
  const ws = state.activeWorkspaceId ? state.workspaces[state.activeWorkspaceId] : null
  if (!ws) return
  const layout: WorkspaceLayout = {
    workspaceId: ws.id,
    tabOrder: ws.tabs.map(t => t.id),
    activeTabId: ws.activeTabId,
    panelLayout: Object.fromEntries(ws.panels.map(p => [p.id, { position: p.position, minimized: p.minimized ?? false }])),
    sidebarPinned: ws.contextualSidebar.pinned,
  }
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    existing[ws.id] = layout
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  } catch { }
}

export function loadLayout(workspaceId: string): WorkspaceLayout | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return stored[workspaceId] ?? null
  } catch {
    return null
  }
}

export function createInitialState(): WorkspaceState {
  return {
    workspaces: {},
    activeWorkspaceId: null,
    commandPalette: { open: false, query: '' },
    enterpriseSearch: { open: false, query: '', results: [], loading: false },
    activityCenter: { open: false, unread: 0 },
    notificationCenter: { open: false, unread: 0 },
    recentEntities: [],
    pinnedWorkflows: [],
  }
}

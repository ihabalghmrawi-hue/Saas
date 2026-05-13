import { createContext, useContext, useReducer, useCallback } from 'react'
import {
  WorkflowInstance, WorkflowStep, WorkflowStatus, StepStatus, WorkflowEvent,
  ApprovalRequest, ApprovalDecision, EntityLock, ActivityEntry,
  WorkflowDefinition, EscalationPolicy,
} from './types'
import {
  transitionStep, createWorkflowEvent, decideApproval, createActivityEntry,
  applyEscalationPolicy, createEntityLock, isLockExpired,
} from './engine'

interface WorkflowStore {
  definitions: Map<string, WorkflowDefinition>
  instances: Map<string, WorkflowInstance>
  events: WorkflowEvent[]
  approvals: Map<string, ApprovalRequest[]>
  locks: Map<string, EntityLock>
  activities: ActivityEntry[]
  escalationPolicies: Map<string, EscalationPolicy>
}

type WorkflowAction =
  | { type: 'START_INSTANCE'; instance: WorkflowInstance }
  | { type: 'TRANSITION_STEP'; instanceId: string; stepId: string; status: StepStatus }
  | { type: 'UPDATE_INSTANCE_STATUS'; instanceId: string; status: WorkflowStatus }
  | { type: 'ADD_EVENT'; event: WorkflowEvent }
  | { type: 'ADD_APPROVAL'; instanceId: string; request: ApprovalRequest }
  | { type: 'DECIDE_APPROVAL'; instanceId: string; requestId: string; decision: ApprovalDecision; userId: string; comments?: string }
  | { type: 'ACQUIRE_LOCK'; lock: EntityLock }
  | { type: 'RELEASE_LOCK'; entityType: string; entityId: string }
  | { type: 'ADD_ACTIVITY'; entry: ActivityEntry }
  | { type: 'REGISTER_DEFINITION'; def: WorkflowDefinition }
  | { type: 'REGISTER_ESCALATION_POLICY'; policy: EscalationPolicy }

function workflowReducer(state: WorkflowStore, action: WorkflowAction): WorkflowStore {
  switch (action.type) {
    case 'START_INSTANCE': {
      const instances = new Map(state.instances)
      instances.set(action.instance.id, { ...action.instance, status: 'active', startedAt: Date.now() })
      return { ...state, instances }
    }
    case 'TRANSITION_STEP': {
      const instances = new Map(state.instances)
      const inst = instances.get(action.instanceId)
      if (!inst) return state
      instances.set(action.instanceId, transitionStep(inst, action.stepId, action.status))
      return { ...state, instances }
    }
    case 'UPDATE_INSTANCE_STATUS': {
      const instances = new Map(state.instances)
      const inst = instances.get(action.instanceId)
      if (!inst) return state
      const completed = action.status === 'completed' || action.status === 'cancelled' || action.status === 'failed'
      instances.set(action.instanceId, { ...inst, status: action.status, completedAt: completed ? Date.now() : inst.completedAt })
      return { ...state, instances }
    }
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.event] }
    case 'ADD_APPROVAL': {
      const approvals = new Map(state.approvals)
      const existing = approvals.get(action.instanceId) || []
      approvals.set(action.instanceId, [...existing, action.request])
      return { ...state, approvals }
    }
    case 'DECIDE_APPROVAL': {
      const approvals = new Map(state.approvals)
      const instanceApprovals = (approvals.get(action.instanceId) || []).map(r =>
        r.id === action.requestId ? decideApproval(r, action.decision, action.userId, action.comments) : r
      )
      approvals.set(action.instanceId, instanceApprovals)
      return { ...state, approvals }
    }
    case 'ACQUIRE_LOCK': {
      const locks = new Map(state.locks)
      locks.set(`${action.lock.entityType}:${action.lock.entityId}`, action.lock)
      return { ...state, locks }
    }
    case 'RELEASE_LOCK': {
      const locks = new Map(state.locks)
      locks.delete(`${action.entityType}:${action.entityId}`)
      return { ...state, locks }
    }
    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.entry, ...state.activities].slice(0, 500) }
    case 'REGISTER_DEFINITION': {
      const definitions = new Map(state.definitions)
      definitions.set(action.def.id, action.def)
      return { ...state, definitions }
    }
    case 'REGISTER_ESCALATION_POLICY': {
      const escalationPolicies = new Map(state.escalationPolicies)
      escalationPolicies.set(action.policy.id, action.policy)
      return { ...state, escalationPolicies }
    }
    default:
      return state
  }
}

function createInitialStore(): WorkflowStore {
  return {
    definitions: new Map(),
    instances: new Map(),
    events: [],
    approvals: new Map(),
    locks: new Map(),
    activities: [],
    escalationPolicies: new Map(),
  }
}

const WorkflowStoreContext = createContext<{ state: WorkflowStore; dispatch: React.Dispatch<WorkflowAction> } | null>(null)

export function WorkflowStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workflowReducer, undefined, createInitialStore)
  return <WorkflowStoreContext.Provider value={{ state, dispatch }}>{children}</WorkflowStoreContext.Provider>
}

export function useWorkflowStore() {
  const ctx = useContext(WorkflowStoreContext)
  if (!ctx) throw new Error('useWorkflowStore must be used within WorkflowStoreProvider')
  return ctx
}

export function useWorkflowActions() {
  const { state, dispatch } = useWorkflowStore()

  const startInstance = useCallback((def: WorkflowDefinition, context?: Record<string, unknown>) => {
    const { createWorkflowInstance } = require('./engine')
    const instance = createWorkflowInstance(def, context)
    dispatch({ type: 'START_INSTANCE', instance })
    const event = createWorkflowEvent(instance.id, 'started', def.owner.id, def.owner.name)
    dispatch({ type: 'ADD_EVENT', event })
    return instance
  }, [dispatch])

  const transition = useCallback((instanceId: string, stepId: string, status: StepStatus) => {
    dispatch({ type: 'TRANSITION_STEP', instanceId, stepId, status })
  }, [dispatch])

  const addApproval = useCallback((instanceId: string, request: ApprovalRequest) => {
    dispatch({ type: 'ADD_APPROVAL', instanceId, request })
  }, [dispatch])

  const decide = useCallback((instanceId: string, requestId: string, decision: ApprovalDecision, userId: string, comments?: string) => {
    dispatch({ type: 'DECIDE_APPROVAL', instanceId, requestId, decision, userId, comments })
  }, [dispatch])

  const acquireLock = useCallback((entityType: string, entityId: string, userId: string, userName: string, sessionId: string) => {
    const lock = createEntityLock(entityType, entityId, userId, userName, sessionId, 'edit')
    dispatch({ type: 'ACQUIRE_LOCK', lock })
    return lock
  }, [dispatch])

  const releaseLock = useCallback((entityType: string, entityId: string) => {
    dispatch({ type: 'RELEASE_LOCK', entityType, entityId })
  }, [dispatch])

  const getActiveLocks = useCallback((entityType: string, entityId: string): EntityLock | null => {
    const key = `${entityType}:${entityId}`
    const lock = state.locks.get(key)
    if (!lock) return null
    if (isLockExpired(lock)) {
      dispatch({ type: 'RELEASE_LOCK', entityType, entityId })
      return null
    }
    return lock
  }, [state.locks, dispatch])

  const registerDefinition = useCallback((def: WorkflowDefinition) => {
    dispatch({ type: 'REGISTER_DEFINITION', def })
  }, [dispatch])

  return { state, startInstance, transition, addApproval, decide, acquireLock, releaseLock, getActiveLocks, registerDefinition }
}

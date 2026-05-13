import { BaseRepository } from './base-repository'
import type { WorkflowInstance, ApprovalRequest, WorkflowEvent, ActivityEntry } from '@/lib/workflow/types'

export class WorkflowInstanceRepository extends BaseRepository<WorkflowInstance> {
  constructor() {
    super('workflow_instances')
  }

  async getActive(): Promise<{ data: WorkflowInstance[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'active')
        .order('createdAt', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as WorkflowInstance[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByDefinition(defId: string): Promise<{ data: WorkflowInstance[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('definitionId', defId)
        .order('createdAt', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as WorkflowInstance[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByAssignee(userId: string): Promise<{ data: WorkflowInstance[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .contains('owner', { id: userId })
        .order('createdAt', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as WorkflowInstance[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export class ApprovalRequestRepository extends BaseRepository<ApprovalRequest> {
  constructor() {
    super('approval_requests')
  }

  async getPendingForUser(userId: string): Promise<{ data: ApprovalRequest[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('decision', 'pending')
        .contains('assignedTo', [{ id: userId }])
        .order('createdAt', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as ApprovalRequest[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByInstance(instanceId: string): Promise<{ data: ApprovalRequest[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('workflowInstanceId', instanceId)
        .order('createdAt', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as ApprovalRequest[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async decide(id: string, decision: string, userId: string, comments?: string): Promise<{ data: ApprovalRequest | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          decision,
          respondedAt: Date.now(),
          comments: comments ?? null,
        } as Partial<ApprovalRequest>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as ApprovalRequest }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }
}

export class WorkflowEventRepository extends BaseRepository<WorkflowEvent> {
  constructor() {
    super('workflow_events')
  }

  async getByInstance(instanceId: string): Promise<{ data: WorkflowEvent[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('workflowInstanceId', instanceId)
        .order('timestamp', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as WorkflowEvent[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByActor(userId: string, limit?: number): Promise<{ data: WorkflowEvent[]; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as WorkflowEvent[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export class ActivityEntryRepository extends BaseRepository<ActivityEntry> {
  constructor() {
    super('activity_entries')
  }

  async getByEntity(entityType: string, entityId: string): Promise<{ data: ActivityEntry[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('entityType', entityType)
        .eq('entityId', entityId)
        .order('timestamp', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as ActivityEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getRecent(limit?: number): Promise<{ data: ActivityEntry[]; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .order('timestamp', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as ActivityEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByCategory(category: string, limit?: number): Promise<{ data: ActivityEntry[]; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('category', category)
        .order('timestamp', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as ActivityEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export const workflowInstancesRepo = new WorkflowInstanceRepository()
export const approvalRequestsRepo = new ApprovalRequestRepository()
export const workflowEventsRepo = new WorkflowEventRepository()
export const activityEntriesRepo = new ActivityEntryRepository()

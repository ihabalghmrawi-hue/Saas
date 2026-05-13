import { createClient } from '@/lib/supabase/client'
import type { WorkflowInstance, ApprovalRequest, WorkflowEvent } from '@/lib/workflow/types'

export interface WorkflowApiResult<T> {
  data: T | null
  error: string | null
  status: number
}

export class WorkflowApiClient {
  private supabase = createClient()

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<WorkflowApiResult<T>> {
    try {
      const { data: sessionData } = await this.supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(sessionData?.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      }

      const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
      const json = await res.json()

      if (!res.ok) {
        return { data: null, error: json.error?.message ?? json.error ?? 'خطأ في الخادم', status: res.status }
      }
      return { data: json.data ?? json, error: null, status: res.status }
    } catch (e) {
      return { data: null, error: (e as Error).message, status: 0 }
    }
  }

  async startWorkflow(definitionId: string, context: Record<string, unknown>): Promise<WorkflowApiResult<WorkflowInstance>> {
    return this.request('/api/workflow/start', 'POST', { definitionId, context })
  }

  async transitionWorkflow(instanceId: string, stepId: string, status: string): Promise<WorkflowApiResult<WorkflowInstance>> {
    return this.request('/api/workflow/transition', 'POST', { instanceId, stepId, status })
  }

  async getWorkflowTimeline(instanceId: string): Promise<WorkflowApiResult<WorkflowEvent[]>> {
    return this.request(`/api/workflow/${instanceId}/timeline`, 'GET')
  }

  async getPendingApprovals(userId: string): Promise<WorkflowApiResult<ApprovalRequest[]>> {
    return this.request(`/api/workflow/approvals/pending?userId=${encodeURIComponent(userId)}`, 'GET')
  }

  async submitApproval(requestId: string, decision: string, comments?: string): Promise<WorkflowApiResult<ApprovalRequest>> {
    return this.request('/api/workflow/approvals/respond', 'POST', { requestId, decision, comments })
  }

  async escalateApproval(requestId: string): Promise<WorkflowApiResult<ApprovalRequest>> {
    return this.request('/api/workflow/approvals/escalate', 'POST', { requestId })
  }
}

export const workflowApi = new WorkflowApiClient()

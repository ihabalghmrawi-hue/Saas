import { createClient } from '@/lib/supabase/client'

export interface ApiResult<T> {
  data: T | null
  error: string | null
  status: number
}

export class WorkbenchApiClient {
  private supabase = createClient()

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResult<T>> {
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

  async postJournalEntry(id: string) { return this.request('/api/financial/journal/post', 'POST', { id }) }
  async approveInvoice(id: string) { return this.request('/api/financial/invoices/approve', 'POST', { id }) }
  async processPayment(id: string) { return this.request('/api/financial/payments/process', 'POST', { id }) }
  async runReconciliation(id: string) { return this.request('/api/financial/reconciliation/run', 'POST', { id }) }

  async adjustStock(id: string, quantity: number, reason: string) { return this.request('/api/inventory/adjust', 'POST', { id, quantity, reason }) }
  async transferStock(id: string, toWarehouse: string) { return this.request('/api/inventory/transfer', 'POST', { id, to_warehouse: toWarehouse }) }
  async countStock(id: string, quantity: number) { return this.request('/api/inventory/count', 'POST', { id, quantity }) }

  async approvePO(id: string) { return this.request('/api/procurement/approve', 'POST', { id }) }
  async receivePO(id: string, items: unknown[]) { return this.request('/api/procurement/receive', 'POST', { id, items }) }
  async matchInvoice(id: string) { return this.request('/api/procurement/match', 'POST', { id }) }

  async approveOrder(id: string) { return this.request('/api/sales/approve', 'POST', { id }) }
  async shipOrder(id: string) { return this.request('/api/sales/ship', 'POST', { id }) }
  async sendInvoice(id: string) { return this.request('/api/sales/invoice/send', 'POST', { id }) }

  async processPayroll(id: string) { return this.request('/api/payroll/process', 'POST', { id }) }
  async approvePayroll(id: string) { return this.request('/api/payroll/approve', 'POST', { id }) }

  async approveRequest(id: string, comments?: string) { return this.request('/api/workflow/approve', 'POST', { id, comments }) }
  async rejectRequest(id: string, comments?: string) { return this.request('/api/workflow/reject', 'POST', { id, comments }) }
  async escalateRequest(id: string) { return this.request('/api/workflow/escalate', 'POST', { id }) }

  async getSummary() { return this.request('/api/orchestration/summary', 'GET') }
  async getTopology() { return this.request('/api/orchestration/topology', 'GET') }
  async getAutoscaleStatus() { return this.request('/api/orchestration/autoscale', 'GET') }
}

export const workbenchApi = new WorkbenchApiClient()

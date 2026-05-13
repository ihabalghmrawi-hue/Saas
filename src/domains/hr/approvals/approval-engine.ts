import type { SupabaseClient } from '@supabase/supabase-js'
import { HrEventBus } from '../events/event-bus'
import type { ServiceResult } from '../types'

type ApprovalEntity = 'leave' | 'overtime' | 'payroll' | 'transfer' | 'termination'

interface ApprovalRequest {
  entityType: ApprovalEntity
  entityId: string
  requestedBy: string
  companyId: string
}

export class HrApprovalEngine {
  private readonly eventBus: HrEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.eventBus = HrEventBus.getInstance()
  }

  async submitForApproval(input: ApprovalRequest): Promise<ServiceResult<{ approvalId: string }>> {
    try {
      const { data, error } = await this.db.from('hr_approval_requests').insert({
        company_id: this.companyId, entity_type: input.entityType, entity_id: input.entityId,
        requested_by: input.requestedBy, status: 'pending',
      }).select('id').single()

      if (error) throw error
      return { ok: true, data: { approvalId: data.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SUBMIT_FAILED' }
    }
  }

  async approve(approvalId: string, approvedBy: string): Promise<ServiceResult<void>> {
    try {
      const { data: request, error: fetchError } = await this.db.from('hr_approval_requests').select('*').eq('id', approvalId).eq('company_id', this.companyId).single()
      if (fetchError || !request) return { ok: false, error: 'طلب الموافقة غير موجود', code: 'NOT_FOUND' }
      if (request.status !== 'pending') return { ok: false, error: 'يمكن الموافقة على الطلبات المعلقة فقط', code: 'INVALID_STATUS' }

      const { error } = await this.db.from('hr_approval_requests').update({
        status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString(),
      }).eq('id', approvalId)

      if (error) throw error

      this.eventBus.emit(`${request.entity_type}.approved` as any, {
        id: approvalId, type: `${request.entity_type}.approved`, companyId: this.companyId,
        timestamp: new Date().toISOString(), performedBy: approvedBy,
        metadata: { entityType: request.entity_type, entityId: request.entity_id },
      })

      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'APPROVE_FAILED' }
    }
  }

  async reject(approvalId: string, reason: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await this.db.from('hr_approval_requests').update({
        status: 'rejected', rejected_reason: reason, rejected_at: new Date().toISOString(),
      }).eq('id', approvalId)

      if (error) throw error
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REJECT_FAILED' }
    }
  }
}

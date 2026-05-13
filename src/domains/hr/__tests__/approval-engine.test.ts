import { describe, it, expect, beforeEach } from 'vitest'
import { HrApprovalEngine } from '../approvals/approval-engine'
import { HrEventBus } from '../events/event-bus'
import { createMockDb, mockFromResult, mockFromError, type MockDb } from '../../test-helpers/mock-db'

describe('HrApprovalEngine', () => {
  let db: MockDb
  let engine: HrApprovalEngine
  const companyId = '00000000-0000-0000-0000-000000000000'
  const aprId = '00000000-0000-0000-0000-000000000100'

  beforeEach(() => {
    HrEventBus.getInstance().removeAll()
    db = createMockDb()
    engine = new HrApprovalEngine(db as any, companyId)
  })

  describe('submitForApproval', () => {
    it('submits approval request successfully', async () => {
      mockFromResult(db, 'hr_approval_requests', { id: aprId })
      const r = await engine.submitForApproval({
        entityType: 'leave', entityId: 'lr-1', requestedBy: 'emp-1', companyId,
      })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.approvalId).toBe(aprId)
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'hr_approval_requests', 'DB error', 'INSERT_ERROR')
      const r = await engine.submitForApproval({
        entityType: 'leave', entityId: 'lr-1', requestedBy: 'emp-1', companyId,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('SUBMIT_FAILED')
    })
  })

  describe('approve', () => {
    it('approves pending request successfully', async () => {
      mockFromResult(db, 'hr_approval_requests', {
        id: aprId, entity_type: 'leave', entity_id: 'lr-1',
        company_id: companyId, status: 'pending',
      })
      const r = await engine.approve(aprId, 'mgr-1')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing request', async () => {
      mockFromResult(db, 'hr_approval_requests', null)
      const r = await engine.approve(aprId, 'mgr-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-pending request', async () => {
      mockFromResult(db, 'hr_approval_requests', {
        id: aprId, company_id: companyId, status: 'approved',
      })
      const r = await engine.approve(aprId, 'mgr-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('returns error on db failure inside try', async () => {
      const pendingReq = { id: aprId, company_id: companyId, status: 'pending' }
      db.from('hr_approval_requests').single = () => Promise.resolve({ data: pendingReq, error: null })
      db.from('hr_approval_requests').update = () => {
        const chain: any = { eq: () => chain, then: (resolve: Function) => resolve({ data: null, error: { message: 'DB error', code: 'UPDATE_ERROR' } }) }
        return chain
      }
      const r = await engine.approve(aprId, 'mgr-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('APPROVE_FAILED')
    })
  })

  describe('reject', () => {
    it('rejects request successfully', async () => {
      mockFromResult(db, 'hr_approval_requests', { id: aprId })
      const r = await engine.reject(aprId, 'Not approved')
      expect(r.ok).toBe(true)
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'hr_approval_requests', 'DB error', 'UPDATE_ERROR')
      const r = await engine.reject(aprId, 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('REJECT_FAILED')
    })
  })
})

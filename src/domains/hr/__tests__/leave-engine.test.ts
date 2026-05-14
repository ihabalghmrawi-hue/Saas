import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveEngine } from '../leaves/leave-engine'
import { HrEventBus } from '../events/event-bus'
import { createMockDb, mockFromResult, mockFromError, mockRpc, mockRpcError, type MockDb } from '../../test-helpers/mock-db'

describe('LeaveEngine', () => {
  let db: MockDb
  let engine: LeaveEngine
  const companyId = '00000000-0000-0000-0000-000000000000'
  const empId = '00000000-0000-0000-0000-000000000001'
  const ltId = '00000000-0000-0000-0000-000000000010'
  const lrId = '00000000-0000-0000-0000-000000000020'

  beforeEach(() => {
    HrEventBus.getInstance().removeAll()
    db = createMockDb()
    engine = new LeaveEngine(db as any, companyId)
  })

  const annualLeaveType = {
    id: ltId, company_id: companyId, name: 'Annual', name_ar: 'سنوية',
    leave_type: 'annual', days_per_year: 21, is_paid: true, is_unpaid: false,
    is_carry_forward: false, carry_forward_limit: 0,
    requires_approval: true, min_days: 1, max_days_per_request: 30,
    allow_half_day: false, requires_document: false,
  }

  describe('request', () => {
    const input = {
      employee_id: empId, leave_type_id: ltId,
      start_date: '2025-07-01', end_date: '2025-07-03',
      reason: 'Family event',
    }

    it('creates pending leave request when approval required', async () => {
      mockFromResult(db, 'leave_types', annualLeaveType)
      mockFromResult(db, 'leave_balances', { entitled_days: 21, remaining_days: 15, pending_days: 0 })
      mockFromResult(db, 'leave_requests', { id: lrId, ...input, total_days: 3, status: 'pending' })
      const r = await engine.request(input)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.status).toBe('pending')
    })

    it('auto-approves when no approval required', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, requires_approval: false })
      mockFromResult(db, 'leave_balances', { entitled_days: 21, remaining_days: 15, pending_days: 0 })
      mockRpc(db, null)
      mockFromResult(db, 'leave_requests', { id: lrId, ...input, total_days: 1, status: 'approved' })
      const r = await engine.request({ ...input, start_date: '2025-07-01', end_date: '2025-07-01' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.status).toBe('approved')
    })

    it('returns validation error', async () => {
      const r = await engine.request({ employee_id: '', leave_type_id: '', start_date: '', end_date: '' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('VALIDATION_ERROR')
    })

    it('throws on leave type not found (db throws before try)', async () => {
      mockFromError(db, 'leave_types', 'DB error', 'FETCH_ERROR')
      await expect(engine.request(input)).rejects.toThrow()
    })

    it('returns error when leave type not found (null result)', async () => {
      mockFromResult(db, 'leave_types', null)
      const r = await engine.request(input)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('LEAVE_TYPE_NOT_FOUND')
    })

    it('returns error when below min days', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, min_days: 5 })
      const r = await engine.request({ ...input, start_date: '2025-07-01', end_date: '2025-07-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('MIN_DAYS')
    })

    it('returns error when exceeds max days', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, max_days_per_request: 2 })
      const r = await engine.request(input)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('MAX_DAYS')
    })

    it('returns error on insufficient balance', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, is_paid: false })
      mockFromResult(db, 'leave_balances', { entitled_days: 21, remaining_days: 5, pending_days: 5 })
      const r = await engine.request(input)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INSUFFICIENT_BALANCE')
    })

    it('skips balance check for unpaid leave', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, is_unpaid: true })
      mockFromResult(db, 'leave_requests', { id: lrId, ...input, total_days: 3, status: 'pending' })
      const r = await engine.request(input)
      expect(r.ok).toBe(true)
    })

    it('returns error on db failure inside try (RPC)', async () => {
      mockFromResult(db, 'leave_types', { ...annualLeaveType, requires_approval: false })
      mockFromResult(db, 'leave_balances', { entitled_days: 21, remaining_days: 15, pending_days: 0 })
      mockRpcError(db, 'DB error', 'RPC_ERROR')
      mockFromResult(db, 'leave_requests', { id: lrId, ...input, total_days: 1, status: 'approved' })
      const r = await engine.request({ ...input, start_date: '2025-07-01', end_date: '2025-07-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('LEAVE_REQUEST_FAILED')
    })
  })

  describe('approve', () => {
    const pendingLeave = {
      id: lrId, employee_id: empId, leave_type_id: ltId,
      start_date: '2025-07-01', end_date: '2025-07-03',
      total_days: 3, status: 'pending',
    }

    it('approves pending leave and reduces balance', async () => {
      mockFromResult(db, 'leave_requests', pendingLeave)
      mockRpc(db, null)
      const r = await engine.approve(lrId, 'mgr-1')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing leave', async () => {
      mockFromResult(db, 'leave_requests', null)
      const r = await engine.approve('00000000-0000-0000-0000-000000004040', 'mgr-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-pending leave', async () => {
      mockFromResult(db, 'leave_requests', { ...pendingLeave, status: 'approved' })
      const r = await engine.approve(lrId, 'mgr-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('throws on db failure before try/catch', async () => {
      mockFromError(db, 'leave_requests', 'DB error', 'FETCH_ERROR')
      await expect(engine.approve(lrId, 'mgr-1')).rejects.toThrow()
    })
  })

  describe('reject', () => {
    it('rejects pending leave', async () => {
      mockFromResult(db, 'leave_requests', {
        id: lrId, employee_id: empId, status: 'pending',
        start_date: '2025-07-01', end_date: '2025-07-03', total_days: 3,
      })
      const r = await engine.reject(lrId, 'No coverage')
      expect(r.ok).toBe(true)
    })

    it('returns not found', async () => {
      mockFromResult(db, 'leave_requests', null)
      const r = await engine.reject('00000000-0000-0000-0000-000000004040', 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-pending leave', async () => {
      mockFromResult(db, 'leave_requests', { id: lrId, status: 'cancelled' })
      const r = await engine.reject(lrId, 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('throws on db failure before try/catch', async () => {
      mockFromError(db, 'leave_requests', 'DB error', 'FETCH_ERROR')
      await expect(engine.reject(lrId, 'Reason')).rejects.toThrow()
    })
  })

  describe('cancel', () => {
    it('cancels approved leave and restores balance', async () => {
      mockFromResult(db, 'leave_requests', {
        id: lrId, employee_id: empId, status: 'approved',
        start_date: '2025-07-01', end_date: '2025-07-03', total_days: 3,
      })
      mockRpc(db, null)
      const r = await engine.cancel(lrId)
      expect(r.ok).toBe(true)
    })

    it('cancels pending leave without balance restore', async () => {
      mockFromResult(db, 'leave_requests', {
        id: lrId, employee_id: empId, status: 'pending',
        start_date: '2025-07-01', end_date: '2025-07-03', total_days: 3,
      })
      const r = await engine.cancel(lrId)
      expect(r.ok).toBe(true)
    })

    it('returns error for already cancelled', async () => {
      mockFromResult(db, 'leave_requests', { id: lrId, status: 'cancelled' })
      const r = await engine.cancel(lrId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('ALREADY_CANCELLED')
    })

    it('returns not found', async () => {
      mockFromResult(db, 'leave_requests', null)
      const r = await engine.cancel('00000000-0000-0000-0000-000000004040')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('throws on db failure before try/catch', async () => {
      mockFromError(db, 'leave_requests', 'DB error', 'FETCH_ERROR')
      await expect(engine.cancel(lrId)).rejects.toThrow()
    })
  })

  describe('getBalances', () => {
    it('returns balances for employee', async () => {
      mockFromResult(db, 'leave_balances', [
        { id: 'bal-1', employee_id: empId, leave_type_id: ltId, year: 2025, entitled_days: 21, remaining_days: 15 },
      ])
      const r = await engine.getBalances(empId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toHaveLength(1)
    })

    it('handles empty balances', async () => {
      mockFromResult(db, 'leave_balances', [])
      const r = await engine.getBalances(empId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toHaveLength(0)
    })

    it('returns error on db failure inside try', async () => {
      mockFromError(db, 'leave_balances', 'DB error', 'FETCH_ERROR')
      const r = await engine.getBalances(empId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('FETCH_FAILED')
    })
  })

  describe('accrueAnnualLeave', () => {
    it('accrues annual leave successfully', async () => {
      mockFromResult(db, 'leave_types', [annualLeaveType])
      mockFromResult(db, 'leave_balances', {
        id: 'bal-1', employee_id: empId, leave_type_id: ltId, year: 2025,
        entitled_days: 21, remaining_days: 21, taken_days: 0, pending_days: 0,
        carried_over: 0, encashed_days: 0,
      })
      const r = await engine.accrueAnnualLeave(empId, 2025, 21)
      expect(r.ok).toBe(true)
    })

    it('returns error when no annual leave type', async () => {
      mockFromResult(db, 'leave_types', [])
      const r = await engine.accrueAnnualLeave(empId, 2025, 21)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NO_ANNUAL_LEAVE')
    })

    it('returns error on db failure inside try', async () => {
      mockFromResult(db, 'leave_types', [annualLeaveType])
      mockFromError(db, 'leave_balances', 'DB error', 'UPSERT_ERROR')
      const r = await engine.accrueAnnualLeave(empId, 2025, 21)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('ACCRUE_FAILED')
    })
  })
})

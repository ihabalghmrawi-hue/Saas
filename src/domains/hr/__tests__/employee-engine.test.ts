import { describe, it, expect, beforeEach } from 'vitest'
import { EmployeeLifecycleEngine } from '../employees/employee-engine'
import { HrEventBus } from '../events/event-bus'
import { createMockDb, mockFromResult, mockFromError, mockRpc, mockRpcError, type MockDb } from '../../test-helpers/mock-db'

describe('EmployeeLifecycleEngine', () => {
  let db: MockDb
  let engine: EmployeeLifecycleEngine
  const companyId = 'co-001'

  beforeEach(() => {
    HrEventBus.getInstance().removeAll()
    db = createMockDb()
    engine = new EmployeeLifecycleEngine(db as any, companyId)
  })

  const mockEmployee = {
    id: 'emp-1', company_id: companyId, employee_no: 'EMP-001',
    full_name: 'John Doe', full_name_ar: 'جون دو',
    email: 'john@test.com', phone: null, gender: 'male', marital_status: null,
    nationality: null, id_number: null, passport_number: null,
    date_of_birth: null, hire_date: '2025-01-01',
    status: 'active', department_id: null, position_id: null,
    branch_id: null, cost_center_id: null, reports_to: null,
    grade: null, level: null, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
  }

  describe('onboard', () => {
    const input = {
      full_name: 'John Doe', full_name_ar: 'جون دو',
      gender: 'male' as const, hire_date: '2025-01-01',
    }

    it('creates employee successfully without contract', async () => {
      mockRpc(db, 'EMP-001')
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.onboard(input)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe('emp-1')
    })

    it('creates employee with contract', async () => {
      mockRpc(db, 'EMP-001')
      mockFromResult(db, 'employees', { ...mockEmployee, email: null })
      mockFromResult(db, 'employee_contracts', { id: 'ctr-1', employee_id: 'emp-1', basic_salary: 5000, total_salary: 5000 })
      const r = await engine.onboard({ ...input, contract: { employee_id: '00000000-0000-0000-0000-000000000000', contract_type: 'permanent', start_date: '2025-01-01', basic_salary: 5000 } })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe('emp-1')
    })

    it('returns validation error for invalid input', async () => {
      const r = await engine.onboard({ full_name: '', full_name_ar: '', gender: 'male' as const, hire_date: '' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('VALIDATION_ERROR')
    })

    it('returns error when email already exists', async () => {
      mockFromResult(db, 'employees', { ...mockEmployee, email: 'existing@test.com' })
      const r = await engine.onboard({ ...input, email: 'existing@test.com' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('EMAIL_EXISTS')
    })

    it('returns error on RPC failure during employee number generation', async () => {
      mockRpcError(db, 'DB error', 'RPC_ERROR')
      mockFromResult(db, 'employees', null)
      const r = await engine.onboard(input)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('ONBOARD_FAILED')
    })
  })

  describe('transfer', () => {
    it('transfers employee successfully', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.transfer('emp-1', { department_id: 'dept-2' })
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing employee', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.transfer('emp-404', { department_id: 'dept-2' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-active employee', async () => {
      mockFromResult(db, 'employees', { ...mockEmployee, status: 'terminated' })
      const r = await engine.transfer('emp-1', { department_id: 'dept-2' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })
  })

  describe('promote', () => {
    const position = { id: 'pos-2', department_id: 'dept-1', title: 'Manager', title_ar: 'مدير', is_active: true }

    it('promotes employee successfully without salary increase', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      mockFromResult(db, 'positions', position)
      const r = await engine.promote('emp-1', { position_id: 'pos-2' })
      expect(r.ok).toBe(true)
    })

    it('promotes with salary increase and new contract', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      mockFromResult(db, 'positions', position)
      mockFromResult(db, 'employee_contracts', { id: 'ctr-1', employee_id: 'emp-1', basic_salary: 5000, is_active: true })
      const r = await engine.promote('emp-1', { position_id: 'pos-2', salary_increase: 1000 })
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing employee', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.promote('emp-404', { position_id: 'pos-2' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-active employee', async () => {
      mockFromResult(db, 'employees', { ...mockEmployee, status: 'suspended' })
      const r = await engine.promote('emp-1', { position_id: 'pos-2' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('returns error when position not found', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      mockFromResult(db, 'positions', null)
      const r = await engine.promote('emp-1', { position_id: 'pos-404' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('POSITION_NOT_FOUND')
    })

    it('returns error on contract failure during promotion', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      mockFromResult(db, 'positions', position)
      mockFromError(db, 'employee_contracts', 'DB error', 'UPDATE_ERROR')
      const r = await engine.promote('emp-1', { position_id: 'pos-2', salary_increase: 1000 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('PROMOTION_FAILED')
    })
  })

  describe('suspend', () => {
    it('suspends employee successfully', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.suspend('emp-1', 'Medical leave')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing employee', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.suspend('emp-404', 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })
  })

  describe('terminate', () => {
    it('terminates employee successfully', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.terminate('emp-1', 'Resignation')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing employee', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.terminate('emp-404', 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })
  })

  describe('rehire', () => {
    it('rehires terminated employee successfully', async () => {
      mockFromResult(db, 'employees', { ...mockEmployee, status: 'terminated' })
      const r = await engine.rehire('emp-1', { hire_date: '2025-06-01' })
      expect(r.ok).toBe(true)
    })

    it('rehires with contract', async () => {
      mockFromResult(db, 'employees', { ...mockEmployee, status: 'terminated' })
      mockFromResult(db, 'employee_contracts', { id: 'ctr-2', employee_id: 'emp-1', basic_salary: 6000 })
      const r = await engine.rehire('emp-1', { hire_date: '2025-06-01', contract: { employee_id: '00000000-0000-0000-0000-000000000000', contract_type: 'permanent', start_date: '2025-06-01', basic_salary: 6000 } })
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing employee', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.rehire('emp-404', { hire_date: '2025-06-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for active employee', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.rehire('emp-1', { hire_date: '2025-06-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })
  })

  describe('getById', () => {
    it('returns employee when found', async () => {
      mockFromResult(db, 'employees', mockEmployee)
      const r = await engine.getById('emp-1')
      expect(r.ok).toBe(true)
    })

    it('returns not found when employee missing', async () => {
      mockFromResult(db, 'employees', null)
      const r = await engine.getById('emp-404')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })
  })

  describe('list', () => {
    it('returns paginated list', async () => {
      mockFromResult(db, 'employees', [], null, 0)
      const r = await engine.list({ page: 1, limit: 10 })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.data).toHaveLength(0)
    })

    it('handles empty list', async () => {
      mockFromResult(db, 'employees', [], null, 0)
      const r = await engine.list({})
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.data).toHaveLength(0)
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'employees', 'DB error', 'FETCH_ERROR')
      const r = await engine.list({})
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('FETCH_FAILED')
    })
  })
})

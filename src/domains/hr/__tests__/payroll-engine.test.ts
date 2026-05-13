import { describe, it, expect, beforeEach } from 'vitest'
import { PayrollEngine } from '../payroll/payroll-engine'
import { HrEventBus } from '../events/event-bus'
import { createMockDb, mockFromResult, mockFromError, type MockDb } from '../../test-helpers/mock-db'

describe('PayrollEngine', () => {
  let db: MockDb
  let engine: PayrollEngine
  const companyId = '00000000-0000-0000-0000-000000000000'
  const cycleId = '00000000-0000-0000-0000-000000000010'
  const runId = '00000000-0000-0000-0000-000000000020'
  const empId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    HrEventBus.getInstance().removeAll()
    db = createMockDb()
    engine = new PayrollEngine(db as any, companyId)
  })

  const openCycle = {
    id: cycleId, company_id: companyId, name: 'June 2025',
    cycle_type: 'monthly' as const, year: 2025, month: 6,
    period_start: '2025-06-01', period_end: '2025-06-30',
    payment_date: '2025-07-01', is_closed: false,
  }

  const draftRun = {
    id: runId, company_id: companyId, cycle_id: cycleId, name: 'Payroll June 2025',
    status: 'draft' as const, branch_id: null,
    total_earnings: 0, total_deductions: 0, total_employer_contributions: 0, net_pay: 0,
    employee_count: 0, is_correction: false, corrected_run_id: null,
    reversal_run_id: null, posted_to_gl: false, gl_journal_entry_id: null,
    processed_by: null, processed_at: null, approved_by: null, approved_at: null,
    locked_by: null, locked_at: null, notes: null,
    cycle: openCycle,
  }

  describe('createRun', () => {
    it('creates draft run successfully', async () => {
      mockFromResult(db, 'payroll_cycles', openCycle)
      mockFromResult(db, 'payroll_runs', draftRun)
      const r = await engine.createRun({ cycle_id: cycleId })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.status).toBe('draft')
    })

    it('returns error when no open cycle', async () => {
      mockFromResult(db, 'payroll_cycles', null)
      const r = await engine.createRun({ cycle_id: cycleId })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NO_OPEN_CYCLE')
    })

    it('returns error on db failure inside try', async () => {
      mockFromResult(db, 'payroll_cycles', openCycle)
      mockFromError(db, 'payroll_runs', 'DB error', 'INSERT_ERROR')
      const r = await engine.createRun({ cycle_id: cycleId })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('RUN_CREATE_FAILED')
    })
  })

  describe('processRun', () => {
    const employee = {
      id: empId, employee_no: 'EMP-001',
      full_name: 'John', full_name_ar: 'جون', status: 'active',
      branch_id: null, hire_date: '2025-01-01',
    }

    const contract = {
      id: 'ctr-1', employee_id: empId, basic_salary: 5000,
      housing_allowance: 1000, transportation_allowance: 500,
      communication_allowance: 200, cost_of_living_allowance: 0,
      other_allowances: 0, is_active: true,
      contract_type: 'permanent', start_date: '2025-01-01',
    }

    it('processes run with one employee', async () => {
      mockFromResult(db, 'payroll_runs', draftRun)
      mockFromResult(db, 'employees', [employee], null, 1)
      mockFromResult(db, 'employee_contracts', contract)
      mockFromResult(db, 'attendance_logs', [])
      mockFromResult(db, 'overtime_entries', [])
      mockFromResult(db, 'payroll_adjustments', [])
      mockFromResult(db, 'employee_loans', [])

      const r = await engine.processRun(runId, 'admin')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing run', async () => {
      mockFromResult(db, 'payroll_runs', null)
      const r = await engine.processRun(runId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-draft run', async () => {
      mockFromResult(db, 'payroll_runs', { ...draftRun, status: 'completed' })
      const r = await engine.processRun(runId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('rolls back to draft on processing failure inside try', async () => {
      mockFromResult(db, 'payroll_runs', draftRun)
      mockFromError(db, 'employees', 'DB error', 'FETCH_ERROR')
      const r = await engine.processRun(runId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('PROCESS_FAILED')
    })
  })

  describe('lockRun', () => {
    const completedRun = { ...draftRun, status: 'completed' as const }

    it('locks completed run successfully', async () => {
      mockFromResult(db, 'payroll_runs', completedRun)
      const r = await engine.lockRun(runId, 'admin')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing run', async () => {
      mockFromResult(db, 'payroll_runs', null)
      const r = await engine.lockRun(runId, 'admin')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-completed run', async () => {
      mockFromResult(db, 'payroll_runs', draftRun)
      const r = await engine.lockRun(runId, 'admin')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('throws on db failure before try/catch', async () => {
      mockFromError(db, 'payroll_runs', 'DB error', 'FETCH_ERROR')
      await expect(engine.lockRun(runId, 'admin')).rejects.toThrow()
    })
  })

  describe('reverseRun', () => {
    const lockedRun = {
      ...draftRun, status: 'locked' as const, total_earnings: 10000,
      total_deductions: 2000, total_employer_contributions: 500, net_pay: 7500,
      employee_count: 1, posted_to_gl: false,
    }

    it('reverses locked run successfully', async () => {
      mockFromResult(db, 'payroll_runs', lockedRun)
      mockFromResult(db, 'payroll_lines', [
        { id: 'pl-1', run_id: runId, employee_id: empId, line_type: 'earning', amount: 8000 },
      ])
      const r = await engine.reverseRun(runId, 'Correction needed')
      expect(r.ok).toBe(true)
    })

    it('returns not found for missing run', async () => {
      mockFromResult(db, 'payroll_runs', null)
      const r = await engine.reverseRun(runId, 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error for non-locked run', async () => {
      mockFromResult(db, 'payroll_runs', draftRun)
      const r = await engine.reverseRun(runId, 'Reason')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })

    it('throws on db failure before try/catch', async () => {
      mockFromError(db, 'payroll_runs', 'DB error', 'FETCH_ERROR')
      await expect(engine.reverseRun(runId, 'Reason')).rejects.toThrow()
    })
  })

  describe('postToAccounting', () => {
    const completedRun = {
      ...draftRun, status: 'completed' as const,
      total_earnings: 10000, total_deductions: 2000,
      total_employer_contributions: 500, net_pay: 7500,
    }

    it('returns journal entry ID on success', async () => {
      const r = await engine.postToAccounting(completedRun)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.journalEntryId).toContain('payroll-')
    })

    it('handles reversal by prefix', async () => {
      const r = await engine.postToAccounting(completedRun, true)
      expect(r.ok).toBe(true)
    })

    it('handles run with zero values', async () => {
      const r = await engine.postToAccounting(draftRun)
      expect(r.ok).toBe(true)
    })
  })

  describe('getRun', () => {
    it('returns run when found', async () => {
      mockFromResult(db, 'payroll_runs', draftRun)
      const r = await engine.getRun(runId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe(runId)
    })

    it('returns not found for missing run', async () => {
      mockFromResult(db, 'payroll_runs', null)
      const r = await engine.getRun(runId)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })
  })
})

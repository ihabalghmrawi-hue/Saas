import { describe, it, expect, beforeEach } from 'vitest'
import { LedgerEngine } from '../ledger/ledger-engine'
import { createMockDb, mockRpc, mockRpcError, type MockDb } from '../../test-helpers/mock-db'

describe('LedgerEngine', () => {
  let db: MockDb
  let engine: LedgerEngine
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    engine = new LedgerEngine(db as any, companyId)
  })

  describe('getAccountBalance', () => {
    it('returns balance from RPC', async () => {
      mockRpc(db, 1500.50)
      const r = await engine.getAccountBalance('acct-1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe(1500.50)
    })

    it('returns 0 when RPC returns null', async () => {
      mockRpc(db, null)
      const r = await engine.getAccountBalance('acct-1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe(0)
    })

    it('passes asOfDate to RPC', async () => {
      mockRpc(db, 500)
      await engine.getAccountBalance('acct-1', '2024-06-30')
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_account_balance', {
        p_account_id: 'acct-1',
        p_company_id: companyId,
        p_as_of_date: '2024-06-30',
      })
    })

    it('returns error on RPC failure', async () => {
      mockRpcError(db, 'DB error', 'RPC_ERROR')
      const r = await engine.getAccountBalance('acct-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('BALANCE_FETCH_FAILED')
    })
  })

  describe('getAllBalances', () => {
    const balances = [
      { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', balance: 10000, total_debit: 50000, total_credit: 40000 },
      { account_id: 'a2', account_code: '4001', account_name: 'مبيعات', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', balance: 20000, total_debit: 10000, total_credit: 30000 },
    ]

    it('returns mapped balances', async () => {
      mockRpc(db, balances)
      const r = await engine.getAllBalances()
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toHaveLength(2)
        expect(r.data[0].account_code).toBe('1101')
        expect(r.data[0].balance).toBe(10000)
        expect(r.data[1].balance).toBe(20000)
      }
    })

    it('handles empty result', async () => {
      mockRpc(db, [])
      const r = await engine.getAllBalances()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toHaveLength(0)
    })

    it('handles null result', async () => {
      mockRpc(db, null)
      const r = await engine.getAllBalances()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toEqual([])
    })

    it('returns error on RPC failure', async () => {
      mockRpcError(db, 'DB error')
      const r = await engine.getAllBalances()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('BALANCES_FETCH_FAILED')
    })
  })

  describe('getGeneralLedger', () => {
    const entries = [
      { entry_id: 'e1', entry_number: 'JE-001', entry_date: '2024-01-15', description: 'قيد', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'نقدية', debit: 1000, credit: 0, running_balance: 1000, cost_center_id: null, branch_id: null, created_at: '2024-01-15T10:00:00Z' },
    ]

    it('returns mapped ledger entries', async () => {
      mockRpc(db, entries)
      const r = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-01-01' })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toHaveLength(1)
        expect(r.data[0].entry_number).toBe('JE-001')
        expect(r.data[0].debit).toBe(1000)
      }
    })

    it('passes all filter params to RPC', async () => {
      mockRpc(db, entries)
      await engine.getGeneralLedger({
        accountId: 'a1',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        costCenterId: 'cc-1',
        branchId: 'br-1',
      })
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_general_ledger', {
        p_company_id: companyId,
        p_account_id: 'a1',
        p_from_date: '2024-01-01',
        p_to_date: '2024-01-31',
        p_cost_center_id: 'cc-1',
        p_branch_id: 'br-1',
      })
    })

    it('handles error', async () => {
      mockRpcError(db, 'LEDGER_ERROR')
      const r = await engine.getGeneralLedger({})
      expect(r.ok).toBe(false)
    })
  })

  describe('getTrialBalance', () => {
    const tbLines = [
      { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 5000, closing_debit: 5000, closing_credit: 0, balance: 5000 },
    ]

    it('returns trial balance lines', async () => {
      mockRpc(db, tbLines)
      const r = await engine.getTrialBalance('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toHaveLength(1)
        expect(r.data[0].balance).toBe(5000)
      }
    })

    it('passes date range to RPC', async () => {
      mockRpc(db, tbLines)
      await engine.getTrialBalance('2024-01-01', '2024-01-31')
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_trial_balance', {
        p_company_id: companyId,
        p_from_date: '2024-01-01',
        p_to_date: '2024-01-31',
      })
    })

    it('handles error', async () => {
      mockRpcError(db, 'TB_ERROR')
      const r = await engine.getTrialBalance()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('TRIAL_BALANCE_FAILED')
    })
  })

  describe('getPeriodBalances', () => {
    const periodBalances = [
      { account_id: 'a1', account_code: '1101', opening_balance: 0, period_debit: 5000, period_credit: 2000, closing_balance: 3000 },
    ]

    it('returns period balances', async () => {
      mockRpc(db, periodBalances)
      const r = await engine.getPeriodBalances('per-1')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toHaveLength(1)
        expect(r.data[0].closing_balance).toBe(3000)
      }
    })

    it('handles error', async () => {
      mockRpcError(db, 'PERIOD_ERROR')
      const r = await engine.getPeriodBalances('per-1')
      expect(r.ok).toBe(false)
    })
  })

  describe('generateDailyBalances', () => {
    it('returns success on RPC completion', async () => {
      mockRpc(db, null)
      const r = await engine.generateDailyBalances('2024-01-15')
      expect(r.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_generate_daily_balances', {
        p_company_id: companyId,
        p_as_of_date: '2024-01-15',
      })
    })

    it('handles error', async () => {
      mockRpcError(db, 'GEN_ERROR')
      const r = await engine.generateDailyBalances()
      expect(r.ok).toBe(false)
    })
  })

  describe('createFinancialSnapshot', () => {
    it('returns snapshot ID on creation', async () => {
      mockRpc(db, 'snap-001')
      const r = await engine.createFinancialSnapshot('monthly', '2024-01-31')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-001')
    })

    it('defaults to daily snapshot', async () => {
      mockRpc(db, 'snap-002')
      await engine.createFinancialSnapshot()
      expect(db.rpc).toHaveBeenCalledWith('ledger_create_snapshot', {
        p_company_id: companyId,
        p_snapshot_type: 'daily',
        p_as_of_date: expect.any(String),
      })
    })

    it('handles error', async () => {
      mockRpcError(db, 'SNAP_ERROR')
      const r = await engine.createFinancialSnapshot()
      expect(r.ok).toBe(false)
    })
  })
})

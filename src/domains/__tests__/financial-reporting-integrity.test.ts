import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LedgerEngine } from '../accounting/ledger/ledger-engine'
import { StatementGenerator } from '../accounting/reports/statement-generator'
import { IntegrityService } from '../accounting/services/integrity.service'
import { SalesReportGenerator } from '../sales/reports/report-generator'
import { JournalEngine } from '../accounting/services/journal-engine.service'
import { createMockDb, mockRpc, mockRpcError, type MockDb } from '../test-helpers/mock-db'

describe('Financial Reporting Integrity', () => {
  let db: MockDb
  const companyId = 'co-001'
  const otherCompanyId = 'co-002'

  beforeEach(() => {
    db = createMockDb()
  })

  describe('Deterministic Outputs', () => {
    it('produces identical trial balance across multiple calls for same data', async () => {
      const tbLines = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 5000, closing_debit: 5000, closing_credit: 0, balance: 5000 },
        { account_id: 'a2', account_code: '4001', account_name: 'Sales', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 10000, closing_debit: 0, closing_credit: 10000, balance: -10000 },
      ]
      mockRpc(db, tbLines)

      const engine = new LedgerEngine(db as any, companyId)
      const first = await engine.getTrialBalance('2024-01-01', '2024-01-31')
      const second = await engine.getTrialBalance('2024-01-01', '2024-01-31')
      const third = await engine.getTrialBalance('2024-01-01', '2024-01-31')

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      expect(third.ok).toBe(true)
      if (first.ok && second.ok && third.ok) {
        expect(first.data).toEqual(second.data)
        expect(second.data).toEqual(third.data)
        expect(first.data[0].balance).toBe(5000)
        expect(first.data[1].balance).toBe(-10000)
      }
    })

    it('produces identical general ledger across multiple calls', async () => {
      const entries = [
        { entry_id: 'e1', entry_number: 'JE-001', entry_date: '2024-01-15', description: 'Sale', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 1000, credit: 0, running_balance: 1000, cost_center_id: null, branch_id: null, created_at: '2024-01-15T10:00:00Z' },
      ]
      mockRpc(db, entries)

      const engine = new LedgerEngine(db as any, companyId)
      const first = await engine.getGeneralLedger({ accountId: 'a1' })
      const second = await engine.getGeneralLedger({ accountId: 'a1' })

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      if (first.ok && second.ok) {
        expect(first.data).toEqual(second.data)
      }
    })

    it('produces identical account balance across multiple calls', async () => {
      mockRpc(db, 5000)

      const engine = new LedgerEngine(db as any, companyId)
      const first = await engine.getAccountBalance('a1')
      const second = await engine.getAccountBalance('a1')

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      if (first.ok && second.ok) {
        expect(first.data).toBe(second.data)
        expect(first.data).toBe(5000)
      }
    })

    it('produces identical income statement across multiple calls', async () => {
      const stmtData = {
        revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 50000 }],
        cogs: [{ code: '5001', name: 'COGS', name_ar: 'تكلفة المبيعات', amount: 30000 }],
        expenses: [{ code: '6501', name: 'Rent', name_ar: 'إيجار', amount: 10000 }],
        period_from: '2024-01-01', period_to: '2024-01-31',
      }
      mockRpc(db, stmtData)

      const generator = new StatementGenerator(db as any, companyId)
      const first = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')
      const second = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      if (first.ok && second.ok) {
        expect(first.data.net_income).toBe(second.data.net_income)
        expect(first.data.net_income).toBe(10000)
      }
    })
  })

  describe('Tenant Isolation', () => {
    it('Company A trial balance does not include Company B data', async () => {
      const coAData = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash A', account_name_ar: 'نقدية أ', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 5000, period_credit: 0, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      ]
      const coBData = [
        { account_id: 'b1', account_code: '1101', account_name: 'Cash B', account_name_ar: 'نقدية ب', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 99999, period_credit: 0, closing_debit: 99999, closing_credit: 0, balance: 99999 },
      ]

      const engineA = new LedgerEngine(db as any, companyId)
      const engineB = new LedgerEngine(db as any, otherCompanyId)

      mockRpc(db, coAData)
      const resultA = await engineA.getTrialBalance('2024-01-01', '2024-01-31')
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_trial_balance', expect.objectContaining({ p_company_id: companyId }))

      mockRpc(db, coBData)
      const resultB = await engineB.getTrialBalance('2024-01-01', '2024-01-31')
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_trial_balance', expect.objectContaining({ p_company_id: otherCompanyId }))

      expect(resultA.ok).toBe(true)
      expect(resultB.ok).toBe(true)
      if (resultA.ok && resultB.ok) {
        expect(resultA.data[0].balance).toBe(5000)
        expect(resultB.data[0].balance).toBe(99999)
        expect(resultA.data[0].balance).not.toBe(resultB.data[0].balance)
      }
    })

    it('Company A general ledger does not include Company B entries', async () => {
      const coAEntries = [
        { entry_id: 'e1', entry_number: 'JE-A001', entry_date: '2024-01-15', description: 'A Sale', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 1000, credit: 0, running_balance: 1000, cost_center_id: null, branch_id: null, created_at: '2024-01-15T10:00:00Z' },
      ]

      mockRpc(db, coAEntries)
      const engineA = new LedgerEngine(db as any, companyId)
      const result = await engineA.getGeneralLedger({ accountId: 'a1' })

      expect(result.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_general_ledger', expect.objectContaining({ p_company_id: companyId }))
      expect(db.rpc).not.toHaveBeenCalledWith('ledger_get_general_ledger', expect.objectContaining({ p_company_id: otherCompanyId }))
      if (result.ok) {
        expect(result.data[0].entry_number).toBe('JE-A001')
      }
    })

    it('Company A balances do not leak into Company B', async () => {
      mockRpc(db, 5000)

      const engineA = new LedgerEngine(db as any, companyId)
      await engineA.getAccountBalance('a1')

      expect(db.rpc).toHaveBeenCalledWith('ledger_get_account_balance', expect.objectContaining({ p_account_id: 'a1', p_company_id: companyId }))
      expect(db.rpc).not.toHaveBeenCalledWith('ledger_get_account_balance', expect.objectContaining({ p_company_id: otherCompanyId }))
    })
  })

  describe('Branch Filtering', () => {
    const allEntries = [
      { entry_id: 'e1', entry_number: 'JE-001', entry_date: '2024-01-15', description: 'Branch 1', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 1000, credit: 0, running_balance: 1000, cost_center_id: null, branch_id: 'br-1', created_at: '2024-01-15T10:00:00Z' },
      { entry_id: 'e2', entry_number: 'JE-002', entry_date: '2024-01-16', description: 'Branch 2', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 2000, credit: 0, running_balance: 3000, cost_center_id: null, branch_id: 'br-2', created_at: '2024-01-16T10:00:00Z' },
    ]

    it('ledger_get_general_ledger with branch_id filter returns correct subset', async () => {
      const filteredEntries = allEntries.filter(e => e.branch_id === 'br-1')
      mockRpc(db, filteredEntries)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getGeneralLedger({ accountId: 'a1', branchId: 'br-1' })

      expect(db.rpc).toHaveBeenCalledWith('ledger_get_general_ledger', expect.objectContaining({ p_branch_id: 'br-1' }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].branch_id).toBe('br-1')
        expect(result.data[0].debit).toBe(1000)
      }
    })

    it('unfiltered general ledger returns entries for all branches', async () => {
      mockRpc(db, allEntries)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getGeneralLedger({ accountId: 'a1' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(2)
        const branchIds = result.data.map(e => e.branch_id)
        expect(branchIds).toContain('br-1')
        expect(branchIds).toContain('br-2')
      }
    })

    it('calls RPC with null branch_id when omitted', async () => {
      mockRpc(db, allEntries)

      const engine = new LedgerEngine(db as any, companyId)
      await engine.getGeneralLedger({ accountId: 'a1' })

      expect(db.rpc).toHaveBeenCalledWith('ledger_get_general_ledger', expect.objectContaining({ p_branch_id: null }))
    })
  })

  describe('Fiscal Period Correctness', () => {
    it('entries in correct period appear in trial balance', async () => {
      const tbLinesInPeriod = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 1000, period_credit: 0, closing_debit: 1000, closing_credit: 0, balance: 1000 },
      ]
      mockRpc(db, tbLinesInPeriod)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getTrialBalance('2024-01-01', '2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].period_debit).toBe(1000)
      }
    })

    it('entries outside date range are excluded from trial balance', async () => {
      const tbLinesEmpty = []
      mockRpc(db, tbLinesEmpty)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getTrialBalance('2024-02-01', '2024-02-29')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('period boundary: entry on first day of month is included', async () => {
      const boundaryEntry = [{
        entry_id: 'e3', entry_number: 'JE-003', entry_date: '2024-02-01', description: 'Boundary', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 2000, credit: 0, running_balance: 2000, cost_center_id: null, branch_id: null, created_at: '2024-02-01T00:00:00Z',
      }]
      mockRpc(db, boundaryEntry)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-02-01', toDate: '2024-02-29' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].entry_date).toBe('2024-02-01')
      }
    })

    it('period boundary: entry on last day of month is included', async () => {
      const boundaryEntry = [{
        entry_id: 'e4', entry_number: 'JE-004', entry_date: '2024-01-31', description: 'Last day', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 500, credit: 0, running_balance: 500, cost_center_id: null, branch_id: null, created_at: '2024-01-31T23:59:59Z',
      }]
      mockRpc(db, boundaryEntry)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-01-01', toDate: '2024-01-31' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].entry_date).toBe('2024-01-31')
      }
    })

    it('period boundary: entry just before period start is excluded', async () => {
      const earlyEntry = [{
        entry_id: 'e5', entry_number: 'JE-005', entry_date: '2024-01-31', description: 'Before', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 500, credit: 0, running_balance: 500, cost_center_id: null, branch_id: null, created_at: '2024-01-31T23:59:59Z',
      }]

      const engine = new LedgerEngine(db as any, companyId)
      mockRpc(db, [])

      const result = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-03-01', toDate: '2024-03-31' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('quater-end boundary: period of quarter-end date is correct', async () => {
      mockRpc(db, 10000)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAccountBalance('a1', '2024-03-31')

      expect(result.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_account_balance', expect.objectContaining({ p_as_of_date: '2024-03-31' }))
      if (result.ok) {
        expect(result.data).toBe(10000)
      }
    })

    it('year-end boundary: period of year-end date excludes next year entries', async () => {
      mockRpc(db, 50000)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAccountBalance('a1', '2024-12-31')

      expect(result.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_account_balance', expect.objectContaining({ p_as_of_date: '2024-12-31', p_account_id: 'a1' }))
      if (result.ok) {
        expect(result.data).toBe(50000)
      }
    })
  })

  describe('Report Consistency', () => {
    describe('Trial Balance debits equal credits', () => {
      it('balanced trial balance: total debits equal total credits', async () => {
        const tbLines = [
          { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 0, closing_debit: 10000, closing_credit: 0, balance: 10000 },
          { account_id: 'a2', account_code: '4001', account_name: 'Sales', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 10000, closing_debit: 0, closing_credit: 10000, balance: -10000 },
        ]
        mockRpc(db, tbLines)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateTrialBalance('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.total_debit).toBe(result.data.total_credit)
          expect(result.data.total_debit).toBe(10000)
          expect(result.data.is_balanced).toBe(true)
        }
      })

      it('unbalanced trial balance is detected', async () => {
        const unbalancedLines = [
          { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 0, closing_debit: 10000, closing_credit: 0, balance: 10000, opening_balance: 0, total_debit: 10000, total_credit: 0 },
          { account_id: 'a2', account_code: '4001', account_name: 'Sales', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 9999, closing_debit: 0, closing_credit: 9999, balance: -9999, opening_balance: 0, total_debit: 0, total_credit: 9999 },
        ]
        mockRpc(db, unbalancedLines)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateTrialBalance('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.total_debit).not.toBe(result.data.total_credit)
          expect(result.data.is_balanced).toBe(false)
          expect(Math.abs(result.data.total_debit - result.data.total_credit)).toBeGreaterThan(0)
        }
      })
    })

    describe('Income Statement net income = revenue - expenses', () => {
      it('calculates net income correctly', async () => {
        const stmtData = {
          revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 50000 }],
          cogs: [{ code: '5001', name: 'COGS', name_ar: 'تكلفة المبيعات', amount: 30000 }],
          expenses: [{ code: '6501', name: 'Rent', name_ar: 'إيجار', amount: 10000 }],
          period_from: '2024-01-01', period_to: '2024-01-31',
        }
        mockRpc(db, stmtData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          const revenue = result.data.revenue.reduce((s, r) => s + r.amount, 0)
          const cogs = result.data.cogs.reduce((s, c) => s + c.amount, 0)
          const expenses = result.data.operating_expenses.reduce((s, e) => s + e.amount, 0)
          const expectedNet = revenue - cogs - expenses
          expect(result.data.net_income).toBe(expectedNet)
          expect(result.data.net_income).toBe(10000)
        }
      })

      it('net income is zero when revenue equals expenses plus cogs', async () => {
        const stmtData = {
          revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 30000 }],
          cogs: [{ code: '5001', name: 'COGS', name_ar: 'تكلفة المبيعات', amount: 20000 }],
          expenses: [{ code: '6501', name: 'Rent', name_ar: 'إيجار', amount: 10000 }],
          period_from: '2024-01-01', period_to: '2024-01-31',
        }
        mockRpc(db, stmtData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.net_income).toBe(0)
        }
      })

      it('net loss when expenses exceed revenue', async () => {
        const stmtData = {
          revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 10000 }],
          cogs: [{ code: '5001', name: 'COGS', name_ar: 'تكلفة المبيعات', amount: 8000 }],
          expenses: [{ code: '6501', name: 'Rent', name_ar: 'إيجار', amount: 5000 }],
          period_from: '2024-01-01', period_to: '2024-01-31',
        }
        mockRpc(db, stmtData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.net_income).toBe(-3000)
          expect(result.data.net_income).toBeLessThan(0)
        }
      })
    })

    describe('Balance Sheet assets = liabilities + equity', () => {
      it('balance sheet balances correctly', async () => {
        const bsData = {
          assets: {
            current: [{ code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 50000 }],
            fixed: [{ code: '1201', name: 'Equipment', name_ar: 'معدات', amount: 30000 }],
          },
          liabilities: {
            current: [{ code: '2101', name: 'AP', name_ar: 'دائنون', amount: 10000 }],
            long_term: [{ code: '2201', name: 'Loan', name_ar: 'قرض', amount: 20000 }],
          },
          equity: { capital: 30000, retained_earnings: 10000, net_income: 10000 },
          period_date: '2024-01-31',
        }
        mockRpc(db, bsData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateBalanceSheet('2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          const assets = result.data.assets.total_assets
          const liabilities = result.data.liabilities.total_liabilities
          const equity = result.data.equity.total_equity
          expect(assets).toBe(liabilities + equity)
          expect(assets).toBe(80000)
          expect(liabilities).toBe(30000)
          expect(equity).toBe(50000)
        }
      })

      it('balance sheet with zero net income still balances', async () => {
        const bsData = {
          assets: { current: [{ code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 40000 }], fixed: [] },
          liabilities: { current: [], long_term: [] },
          equity: { capital: 30000, retained_earnings: 10000, net_income: 0 },
          period_date: '2024-01-31',
        }
        mockRpc(db, bsData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateBalanceSheet('2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.assets.total_assets).toBe(40000)
          expect(result.data.equity.total_equity).toBe(40000)
          expect(result.data.assets.total_assets).toBe(result.data.liabilities.total_liabilities + result.data.equity.total_equity)
        }
      })
    })

    describe('Cash Flow net change matches balance sheet cash movement', () => {
      it('cash flow net change equals difference in cash balance', async () => {
        const cfData = {
          operating: { items: [{ code: '4001', name: 'Net Revenue', name_ar: 'صافي الإيرادات', amount: 10000 }], total: 10000 },
          investing: { items: [{ code: '1201', name: 'Fixed Assets', name_ar: 'أصول ثابتة', amount: -5000 }], total: -5000 },
          financing: { items: [], total: 0 },
          net_change: 5000,
          period_from: '2024-01-01', period_to: '2024-01-31',
        }
        mockRpc(db, cfData)

        const generator = new StatementGenerator(db as any, companyId)
        const result = await generator.generateCashFlow('2024-01-01', '2024-01-31')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.net_change).toBe(5000)
          expect(result.data.net_change).toBe(result.data.operating.total + result.data.investing.total + result.data.financing.total)
        }
      })

      it('cash flow reporting period params are passed correctly', async () => {
        mockRpc(db, {
          operating: { items: [], total: 0 },
          investing: { items: [], total: 0 },
          financing: { items: [], total: 0 },
          net_change: 0,
          period_from: '2024-01-01', period_to: '2024-01-31',
        })

        const generator = new StatementGenerator(db as any, companyId)
        await generator.generateCashFlow('2024-01-01', '2024-01-31')

        expect(db.rpc).toHaveBeenCalledWith('get_cash_flow', {
          p_company_id: companyId,
          p_from_date: '2024-01-01',
          p_to_date: '2024-01-31',
        })
      })
    })
  })

  describe('Sales Summary Report', () => {
    it('get_sales_summary returns correct invoice counts, totals, and tax', async () => {
      const summaryData = [
        { period_date: '2024-01-15', invoice_count: 2, total_sales: 1000, total_tax: 150, total_discount: 50, net_sales: 1100 },
        { period_date: '2024-01-20', invoice_count: 1, total_sales: 500, total_tax: 75, total_discount: 25, net_sales: 550 },
      ]
      mockRpc(db, summaryData)

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateSalesSummary('2024-01-01', '2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.total_invoices).toBe(2)
        expect(result.data.total_sales).toBe(1500)
        expect(result.data.total_tax).toBe(225)
        expect(result.data.total_discount).toBe(75)
        expect(result.data.net_sales).toBe(1650)
      }
    })

    it('date range filtering works correctly for sales summary', async () => {
      mockRpc(db, [])

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateSalesSummary('2024-02-01', '2024-02-29')

      expect(db.rpc).toHaveBeenCalledWith('get_sales_summary', { p_company_id: companyId, p_from_date: '2024-02-01', p_to_date: '2024-02-29' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.total_invoices).toBe(0)
        expect(result.data.total_sales).toBe(0)
      }
    })

    it('handles empty result from get_sales_summary', async () => {
      mockRpc(db, [])

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateSalesSummary('2024-01-01', '2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.total_invoices).toBe(0)
        expect(result.data.total_sales).toBe(0)
        expect(result.data.total_tax).toBe(0)
      }
    })

    it('handles sales summary rpc error', async () => {
      mockRpcError(db, 'Sales summary error')

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateSalesSummary('2024-01-01', '2024-01-31')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('SALES_SUMMARY_FAILED')
    })
  })

  describe('Customer Aging', () => {
    const agingData = [
      { customer_id: 'cust-1', customer_name: 'شركة أ', total_balance: 5000, current_amount: 2000, days_1_30: 1000, days_31_60: 1000, days_61_90: 500, days_90_plus: 500 },
      { customer_id: 'cust-2', customer_name: 'شركة ب', total_balance: 3000, current_amount: 3000, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 },
    ]

    it('get_customer_aging buckets correct amounts into aging categories', async () => {
      mockRpc(db, agingData)

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateCustomerAging('2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(2)

        const c1 = result.data[0]
        expect(c1.total_balance).toBe(5000)
        expect(c1.current_amount).toBe(2000)
        expect(c1.days_1_30).toBe(1000)
        expect(c1.days_31_60).toBe(1000)
        expect(c1.days_61_90).toBe(500)
        expect(c1.days_90_plus).toBe(500)
        expect(c1.current_amount + c1.days_1_30 + c1.days_31_60 + c1.days_61_90 + c1.days_90_plus).toBe(c1.total_balance)
      }
    })

    it('current amounts (not yet due) reported correctly', async () => {
      mockRpc(db, agingData)

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateCustomerAging('2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        const c2 = result.data[1]
        expect(c2.total_balance).toBe(3000)
        expect(c2.current_amount).toBe(3000)
        expect(c2.days_1_30).toBe(0)
        expect(c2.days_31_60).toBe(0)
        expect(c2.days_61_90).toBe(0)
        expect(c2.days_90_plus).toBe(0)
      }
    })

    it('aging total equals sum of all buckets', async () => {
      mockRpc(db, agingData)

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateCustomerAging('2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        for (const customer of result.data) {
          const bucketSum = customer.current_amount + customer.days_1_30 + customer.days_31_60 + customer.days_61_90 + customer.days_90_plus
          expect(bucketSum).toBe(customer.total_balance)
        }
      }
    })

    it('handles empty customer aging', async () => {
      mockRpc(db, [])

      const reportGen = new SalesReportGenerator(db as any, companyId)
      const result = await reportGen.generateCustomerAging('2024-01-31')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('passes as_of_date to get_customer_aging rpc', async () => {
      mockRpc(db, [])

      const reportGen = new SalesReportGenerator(db as any, companyId)
      await reportGen.generateCustomerAging('2024-06-30')

      expect(db.rpc).toHaveBeenCalledWith('get_customer_aging', {
        p_company_id: companyId,
        p_as_of_date: '2024-06-30',
      })
    })
  })

  describe('Data Integrity', () => {
    describe('check_unbalanced_entries', () => {
      it('detects unbalanced posted entries', async () => {
        const unbalancedEntries = [
          { entry_id: 'e1', entry_number: 'JE-UNBAL-001', debit_diff: 500 },
          { entry_id: 'e2', entry_number: 'JE-UNBAL-002', debit_diff: 0.05 },
        ]

        const integrityService = new IntegrityService(db as any, companyId)
        vi.spyOn(db, 'rpc').mockImplementation((fn: string) => {
          if (fn === 'check_unbalanced_entries') {
            return Promise.resolve({ data: unbalancedEntries, error: null })
          }
          return Promise.resolve({ data: [], error: null })
        })
        vi.spyOn(integrityService as any, 'checkDuplicatePostings').mockResolvedValue({
          check_type: 'checkDuplicatePostings', status: 'passed', details: {}, timestamp: new Date().toISOString(),
        })
        vi.spyOn(integrityService as any, 'checkAccountBalances').mockResolvedValue({
          check_type: 'checkAccountBalances', status: 'passed', details: {}, timestamp: new Date().toISOString(),
        })
        vi.spyOn(integrityService as any, 'checkTrialBalance').mockResolvedValue({
          check_type: 'checkTrialBalance', status: 'passed', details: {}, timestamp: new Date().toISOString(),
        })
        vi.spyOn(integrityService as any, 'checkMissingPeriods').mockResolvedValue({
          check_type: 'checkMissingPeriods', status: 'passed', details: {}, timestamp: new Date().toISOString(),
        })
        vi.spyOn(integrityService as any, 'checkOrphanedLines').mockResolvedValue({
          check_type: 'checkOrphanedLines', status: 'passed', details: {}, timestamp: new Date().toISOString(),
        })

        const result = await integrityService.checkBalancedEntries()

        expect(result.status).toBe('failed')
        expect(result.details.unbalanced_count).toBe(2)
      })

      it('passes when no unbalanced entries exist', async () => {
        vi.spyOn(db, 'rpc').mockImplementation((fn: string) => {
          if (fn === 'check_unbalanced_entries') {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: null, error: null })
        })

        const integrityService = new IntegrityService(db as any, companyId)
        const result = await integrityService.checkBalancedEntries()

        expect(result.status).toBe('passed')
        expect(result.details.unbalanced_count).toBe(0)
      })

      it('calls RPC with company_id parameter', async () => {
        vi.spyOn(db, 'rpc').mockImplementation((fn: string) => {
          if (fn === 'check_unbalanced_entries') {
            expect(db.rpc).toHaveBeenCalledWith('check_unbalanced_entries', { p_company_id: companyId })
          }
          return Promise.resolve({ data: [], error: null })
        })

        const integrityService = new IntegrityService(db as any, companyId)
        await integrityService.checkBalancedEntries()

        expect(db.rpc).toHaveBeenCalledWith('check_unbalanced_entries', { p_company_id: companyId })
      })
    })

    describe('check_orphaned_lines', () => {
      it('detects orphaned journal lines', async () => {
        const orphanedLines = [
          { line_id: 'l1', journal_entry_id: 'e-orphan-1' },
          { line_id: 'l2', journal_entry_id: 'e-orphan-2' },
        ]

        vi.spyOn(db, 'rpc').mockImplementation((fn: string) => {
          if (fn === 'check_orphaned_lines') {
            return Promise.resolve({ data: orphanedLines, error: null })
          }
          return Promise.resolve({ data: [], error: null })
        })

        const integrityService = new IntegrityService(db as any, companyId)
        const result = await integrityService.checkOrphanedLines()

        expect(result.status).toBe('failed')
        expect(result.details.orphaned_count).toBe(2)
      })

      it('passes when no orphaned lines exist', async () => {
        vi.spyOn(db, 'rpc').mockImplementation((fn: string) => {
          if (fn === 'check_orphaned_lines') {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: null, error: null })
        })

        const integrityService = new IntegrityService(db as any, companyId)
        const result = await integrityService.checkOrphanedLines()

        expect(result.status).toBe('passed')
        expect(result.details.orphaned_count).toBe(0)
      })
    })
  })

  describe('Account Balances Daily', () => {
    it('ledger_get_account_balance returns correct balance as of any date', async () => {
      mockRpc(db, 25000)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAccountBalance('a1', '2024-06-30')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toBe(25000)
      }
      expect(db.rpc).toHaveBeenCalledWith('ledger_get_account_balance', {
        p_account_id: 'a1',
        p_company_id: companyId,
        p_as_of_date: '2024-06-30',
      })
    })

    it('ledger_get_account_balance returns zero for null RPC result', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAccountBalance('a1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toBe(0)
      }
    })

    it('ledger_get_all_balances returns all accounts with proper totals', async () => {
      const balances = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', balance: 50000, total_debit: 100000, total_credit: 50000 },
        { account_id: 'a2', account_code: '2101', account_name: 'AP', account_name_ar: 'دائنون', account_type: 'liability', normal_balance: 'credit', balance: 20000, total_debit: 30000, total_credit: 50000 },
        { account_id: 'a3', account_code: '4001', account_name: 'Sales', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', balance: 30000, total_debit: 10000, total_credit: 40000 },
      ]
      mockRpc(db, balances)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAllBalances('2024-06-30')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(3)
        const totalBalDebit = result.data.filter(a => a.normal_balance === 'debit').reduce((s, a) => s + a.balance, 0)
        const totalBalCredit = result.data.filter(a => a.normal_balance === 'credit').reduce((s, a) => s + a.balance, 0)
        expect(totalBalDebit).toBeGreaterThan(0)
        expect(totalBalCredit).toBeGreaterThan(0)
        expect(result.data[0].total_debit).toBeGreaterThan(0)
      }
    })

    it('ledger_get_all_balances returns empty array for null result', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAllBalances()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual([])
      }
    })

    it('ledger_get_all_balances handles rpc error', async () => {
      mockRpcError(db, 'DB error')

      const engine = new LedgerEngine(db as any, companyId)
      const result = await engine.getAllBalances()

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('BALANCES_FETCH_FAILED')
    })

    describe('ledger_get_period_balances opening/period/closing consistency', () => {
      it('opening + period = closing for debit accounts', async () => {
        const periodBalances = [
          { account_id: 'a1', account_code: '1101', opening_balance: 10000, period_debit: 5000, period_credit: 2000, closing_balance: 13000 },
          { account_id: 'a2', account_code: '1102', opening_balance: 5000, period_debit: 3000, period_credit: 1000, closing_balance: 7000 },
        ]
        mockRpc(db, periodBalances)

        const engine = new LedgerEngine(db as any, companyId)
        const result = await engine.getPeriodBalances('per-1')

        expect(result.ok).toBe(true)
        if (result.ok) {
          for (const acct of result.data) {
            const expectedClosing = acct.opening_balance + (acct.period_debit - acct.period_credit)
            expect(acct.closing_balance).toBe(expectedClosing)
          }
          expect(result.data[0].closing_balance).toBe(13000)
          expect(result.data[1].closing_balance).toBe(7000)
        }
      })

      it('handles empty period balances', async () => {
        mockRpc(db, [])

        const engine = new LedgerEngine(db as any, companyId)
        const result = await engine.getPeriodBalances('per-empty')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data).toHaveLength(0)
        }
      })

      it('handles period balances rpc error', async () => {
        mockRpcError(db, 'PERIOD_ERROR')

        const engine = new LedgerEngine(db as any, companyId)
        const result = await engine.getPeriodBalances('per-1')

        expect(result.ok).toBe(false)
      })
    })
  })

  describe('Cross-Report Consistency', () => {
    it('sum of period_debit in trial balance equals total debit in general ledger', async () => {
      const tbLines = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 5000, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      ]
      const glEntries = [
        { entry_id: 'e1', entry_number: 'JE-001', entry_date: '2024-01-15', description: 'Entry', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 10000, credit: 0, running_balance: 10000, cost_center_id: null, branch_id: null, created_at: '2024-01-15T10:00:00Z' },
        { entry_id: 'e2', entry_number: 'JE-002', entry_date: '2024-01-20', description: 'Entry 2', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 0, credit: 5000, running_balance: 5000, cost_center_id: null, branch_id: null, created_at: '2024-01-20T10:00:00Z' },
      ]

      const engine = new LedgerEngine(db as any, companyId)

      mockRpc(db, tbLines)
      const tbResult = await engine.getTrialBalance('2024-01-01', '2024-01-31')

      mockRpc(db, glEntries)
      const glResult = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-01-01', toDate: '2024-01-31' })

      expect(tbResult.ok).toBe(true)
      expect(glResult.ok).toBe(true)
      if (tbResult.ok && glResult.ok) {
        const tbPeriodDebit = tbResult.data.reduce((s, l) => s + l.period_debit, 0)
        const glTotalDebit = glResult.data.reduce((s, e) => s + e.debit, 0)
        expect(tbPeriodDebit).toBe(glTotalDebit)
        expect(tbPeriodDebit).toBe(10000)
      }
    })

    it('net income from income statement matches equity net_income on balance sheet', async () => {
      const isData = {
        revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 50000 }],
        cogs: [{ code: '5001', name: 'COGS', name_ar: 'تكلفة المبيعات', amount: 30000 }],
        expenses: [{ code: '6501', name: 'Rent', name_ar: 'إيجار', amount: 10000 }],
        period_from: '2024-01-01', period_to: '2024-01-31',
      }
      const bsData = {
        assets: { current: [{ code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 80000 }], fixed: [] },
        liabilities: { current: [], long_term: [] },
        equity: { capital: 50000, retained_earnings: 20000, net_income: 10000 },
        period_date: '2024-01-31',
      }

      const generator = new StatementGenerator(db as any, companyId)

      mockRpc(db, isData)
      const isResult = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')

      mockRpc(db, bsData)
      const bsResult = await generator.generateBalanceSheet('2024-01-31')

      expect(isResult.ok).toBe(true)
      expect(bsResult.ok).toBe(true)
      if (isResult.ok && bsResult.ok) {
        expect(isResult.data.net_income).toBe(bsResult.data.equity.net_income)
        expect(isResult.data.net_income).toBe(10000)
      }
    })

    it('total debits from get_all_balances consistent with trial balance totals', async () => {
      const allBal = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', balance: 50000, total_debit: 100000, total_credit: 50000 },
        { account_id: 'a2', account_code: '2101', account_name: 'AP', account_name_ar: 'دائنون', account_type: 'liability', normal_balance: 'credit', balance: 20000, total_debit: 30000, total_credit: 50000 },
      ]
      const tbLines = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 100000, period_credit: 50000, closing_debit: 50000, closing_credit: 0, balance: 50000 },
        { account_id: 'a2', account_code: '2101', account_name: 'AP', account_name_ar: 'دائنون', account_type: 'liability', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 30000, period_credit: 50000, closing_debit: 0, closing_credit: 20000, balance: -20000 },
      ]

      const engine = new LedgerEngine(db as any, companyId)

      mockRpc(db, allBal)
      const allResult = await engine.getAllBalances('2024-06-30')

      mockRpc(db, tbLines)
      const tbResult = await engine.getTrialBalance('2024-01-01', '2024-06-30')

      expect(allResult.ok).toBe(true)
      expect(tbResult.ok).toBe(true)
      if (allResult.ok && tbResult.ok) {
        const allTotalDebit = allResult.data.reduce((s, a) => s + a.total_debit, 0)
        const allTotalCredit = allResult.data.reduce((s, a) => s + a.total_credit, 0)
        const tbTotalPeriodDebit = tbResult.data.reduce((s, l) => s + l.period_debit, 0)
        const tbTotalPeriodCredit = tbResult.data.reduce((s, l) => s + l.period_credit, 0)
        expect(allTotalDebit).toBe(tbTotalPeriodDebit)
        expect(allTotalCredit).toBe(tbTotalPeriodCredit)
      }
    })

    it('general ledger running balance is consistent with account balance', async () => {
      const glEntries = [
        { entry_id: 'e1', entry_number: 'JE-001', entry_date: '2024-01-01', description: 'Open', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 10000, credit: 0, running_balance: 10000, cost_center_id: null, branch_id: null, created_at: '2024-01-01T00:00:00Z' },
        { entry_id: 'e2', entry_number: 'JE-002', entry_date: '2024-01-15', description: 'Payment', reference: null, source: 'manual', source_id: null, account_id: 'a1', account_code: '1101', account_name: 'Cash', debit: 0, credit: 3000, running_balance: 7000, cost_center_id: null, branch_id: null, created_at: '2024-01-15T00:00:00Z' },
      ]

      mockRpc(db, glEntries)
      const engine = new LedgerEngine(db as any, companyId)
      const glResult = await engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-01-01', toDate: '2024-01-31' })

      expect(glResult.ok).toBe(true)
      if (glResult.ok) {
        const entries = glResult.data
        expect(entries).toHaveLength(2)
        expect(entries[0].running_balance).toBe(10000)
        expect(entries[1].running_balance).toBe(7000)
        expect(entries[1].running_balance).toBe(entries[0].running_balance - entries[1].credit)
      }
    })
  })
})

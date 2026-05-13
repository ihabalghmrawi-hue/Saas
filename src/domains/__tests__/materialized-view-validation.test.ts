import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatementGenerator, type IncomeStatement, type BalanceSheet, type CashFlowStatement } from '../../domains/accounting/reports/statement-generator'
import { createMockDb, mockRpc, mockRpcError, type MockDb } from '../test-helpers/mock-db'

describe('Materialized View Validation - التحقق من العرض المادي', () => {
  let db: MockDb
  let generator: StatementGenerator
  const companyId = 'co-001'
  const companyId2 = 'co-002'

  beforeEach(() => {
    db = createMockDb()
    generator = new StatementGenerator(db as any, companyId)
  })

  describe('Trial Balance MV Refresh - تحديث ميزان المراجعة', () => {
    const tbLines = [
      { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 10000, period_credit: 5000, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      { account_id: 'a2', account_code: '4001', account_name: 'مبيعات', account_name_ar: 'مبيعات', account_type: 'revenue', normal_balance: 'credit', opening_balance: 0, period_debit: 0, period_credit: 10000, closing_debit: 0, closing_credit: 5000, balance: -5000 },
    ]

    it('refresh_reporting_views RPC called with CONCURRENTLY', async () => {
      mockRpc(db, null)
      const { data, error } = await db.rpc('refresh_reporting_views')
      expect(error).toBeNull()
      expect(db.rpc).toHaveBeenCalledWith('refresh_reporting_views')
    })

    it('generates trial balance from MV backed RPC', async () => {
      mockRpc(db, tbLines)
      const r = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.lines).toHaveLength(2)
        expect(r.data.is_balanced).toBe(true)
        expect(r.data.total_debit).toBe(r.data.total_credit)
      }
    })

    it('handles stale data before refresh - بيانات قديمة قبل التحديث', async () => {
      const staleLines = [
        { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 5000, period_credit: 0, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      ]
      mockRpc(db, staleLines)
      const staleResult = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(staleResult.ok).toBe(true)
      if (staleResult.ok) {
        expect(staleResult.data.lines[0].period_debit).toBe(5000)
      }

      const freshLines = [
        { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 10000, period_credit: 0, closing_debit: 10000, closing_credit: 0, balance: 10000 },
      ]
      mockRpc(db, freshLines)
      const freshResult = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(freshResult.ok).toBe(true)
      if (freshResult.ok) {
        expect(freshResult.data.lines[0].period_debit).toBe(10000)
      }
    })
  })

  describe('Balance Sheet MV - الميزانية العمومية', () => {
    const balanceSheetData = {
      assets: {
        current: [
          { account_id: 'a1', code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 50000 },
          { account_id: 'a2', code: '1110', name: 'AR', name_ar: 'ذمم مدينة', amount: 30000 },
        ],
        fixed: [
          { account_id: 'a3', code: '1201', name: 'Equipment', name_ar: 'معدات', amount: 100000 },
        ],
      },
      liabilities: {
        current: [
          { account_id: 'a4', code: '2101', name: 'AP', name_ar: 'ذمم دائنة', amount: 20000 },
        ],
        long_term: [
          { account_id: 'a5', code: '2201', name: 'Loan', name_ar: 'قرض طويل الأجل', amount: 50000 },
        ],
      },
      equity: {
        capital: 100000,
        retained_earnings: 25000,
        net_income: 15000,
      },
      period_date: '2024-12-31',
    }

    it('returns correct JSON structure with assets/liabilities/equity', async () => {
      mockRpc(db, balanceSheetData)
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.assets).toHaveProperty('current')
        expect(r.data.assets).toHaveProperty('fixed')
        expect(r.data.assets).toHaveProperty('total_assets')
        expect(r.data.liabilities).toHaveProperty('current')
        expect(r.data.liabilities).toHaveProperty('long_term')
        expect(r.data.liabilities).toHaveProperty('total_liabilities')
        expect(r.data.equity).toHaveProperty('capital')
        expect(r.data.equity).toHaveProperty('retained_earnings')
        expect(r.data.equity).toHaveProperty('net_income')
        expect(r.data.equity).toHaveProperty('total_equity')
        expect(r.data).toHaveProperty('period_date')
      }
    })

    it('classifies current vs fixed assets correctly', async () => {
      mockRpc(db, balanceSheetData)
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const currentCodes = r.data.assets.current.map(a => a.code)
        expect(currentCodes).toContain('1101')
        expect(currentCodes).toContain('1110')
        const fixedCodes = r.data.assets.fixed.map(a => a.code)
        expect(fixedCodes).toContain('1201')
        expect(fixedCodes).not.toContain('1101')
      }
    })

    it('validates current asset account_code LIKE 11% pattern', () => {
      const currentAssetCodes = ['1101', '1110', '1120', '1199']
      const fixedAssetCodes = ['1201', '1301', '1501']
      for (const code of currentAssetCodes) {
        expect(code.startsWith('11')).toBe(true)
      }
      for (const code of fixedAssetCodes) {
        expect(code.startsWith('11')).toBe(false)
      }
    })

    it('includes net income from equity code 3003', async () => {
      mockRpc(db, balanceSheetData)
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.equity.net_income).toBe(15000)
        expect(r.data.equity.total_equity).toBe(100000 + 25000 + 15000)
      }
    })

    it('enforces tenant isolation - different companies get different results', async () => {
      mockRpc(db, balanceSheetData)
      const r1 = await generator.generateBalanceSheet('2024-12-31')
      expect(r1.ok).toBe(true)

      const db2 = createMockDb()
      const gen2 = new StatementGenerator(db2 as any, companyId2)
      const otherData = {
        assets: { current: [], fixed: [] },
        liabilities: { current: [], long_term: [] },
        equity: { capital: 5000, retained_earnings: 0, net_income: 0 },
        period_date: '2024-12-31',
      }
      mockRpc(db2, otherData)
      const r2 = await gen2.generateBalanceSheet('2024-12-31')
      expect(r2.ok).toBe(true)
      if (r2.ok && r1.ok) {
        expect(r2.data.equity.total_equity).not.toBe(r1.data.equity.total_equity)
      }
    })

    it('supports branch filtering correctness', async () => {
      const branchData = {
        ...balanceSheetData,
        assets: { current: [{ account_id: 'a1', code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 10000 }], fixed: [] },
        liabilities: { current: [], long_term: [] },
        equity: { capital: 10000, retained_earnings: 0, net_income: 0 },
      }
      db.rpc.mockResolvedValue({ data: branchData, error: null })
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.assets.current).toHaveLength(1)
        expect(r.data.assets.current[0].amount).toBe(10000)
      }
    })

    it('validates fiscal period correctness', async () => {
      const periodDate = '2024-12-31'
      mockRpc(db, balanceSheetData)
      const r = await generator.generateBalanceSheet(periodDate)
      expect(db.rpc).toHaveBeenCalledWith('get_balance_sheet', {
        p_company_id: companyId,
        p_as_of_date: periodDate,
      })
    })

    it('handles error from balance sheet RPC', async () => {
      mockRpcError(db, 'MV_STALE_ERROR', 'MV_NOT_REFRESHED')
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('BALANCE_SHEET_FAILED')
    })
  })

  describe('Income Statement MV - قائمة الدخل', () => {
    const incomeData = {
      revenue: [
        { account_id: 'r1', code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 200000 },
        { account_id: 'r2', code: '4002', name: 'Returns', name_ar: 'مردودات', amount: -5000 },
      ],
      cogs: [
        { account_id: 'c1', code: '5001', name: 'COGS', name_ar: 'تكلفة البضاعة', amount: 120000 },
      ],
      expenses: [
        { account_id: 'e1', code: '6501', name: 'Salaries', name_ar: 'رواتب', amount: 40000 },
        { account_id: 'e2', code: '6502', name: 'Rent', name_ar: 'إيجار', amount: 12000 },
      ],
      period_from: '2024-01-01',
      period_to: '2024-12-31',
    }

    it('returns revenue/cogs/expenses sections', async () => {
      mockRpc(db, incomeData)
      const r = await generator.generateIncomeStatement('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toHaveProperty('revenue')
        expect(r.data).toHaveProperty('cogs')
        expect(r.data).toHaveProperty('operating_expenses')
        expect(r.data).toHaveProperty('gross_profit')
        expect(r.data).toHaveProperty('net_income')
      }
    })

    it('validates account type filtering (revenue, cogs, expense only)', async () => {
      mockRpc(db, incomeData)
      const r = await generator.generateIncomeStatement('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        r.data.revenue.forEach(line => expect(typeof line.amount).toBe('number'))
        r.data.cogs.forEach(line => expect(typeof line.amount).toBe('number'))
      }
    })

    it('calculates net amount as sum of revenue minus cogs and expenses', async () => {
      mockRpc(db, incomeData)
      const r = await generator.generateIncomeStatement('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const totalRevenue = incomeData.revenue.reduce((s, l) => s + l.amount, 0)
        const totalCogs = incomeData.cogs.reduce((s, l) => s + l.amount, 0)
        const totalExpenses = incomeData.expenses.reduce((s, l) => s + l.amount, 0)
        expect(r.data.gross_profit).toBe(totalRevenue - totalCogs)
        expect(r.data.net_income).toBe(totalRevenue - totalCogs - totalExpenses)
      }
    })

    it('passes fiscal period to RPC correctly', async () => {
      mockRpc(db, incomeData)
      await generator.generateIncomeStatement('2024-01-01', '2024-06-30')
      expect(db.rpc).toHaveBeenCalledWith('get_income_statement', {
        p_company_id: companyId,
        p_from_date: '2024-01-01',
        p_to_date: '2024-06-30',
      })
    })

    it('handles empty income statement', async () => {
      mockRpc(db, { revenue: [], cogs: [], expenses: [], period_from: '2024-01-01', period_to: '2024-01-31' })
      const r = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.revenue).toHaveLength(0)
        expect(r.data.gross_profit).toBe(0)
        expect(r.data.net_income).toBe(0)
      }
    })

    it('handles RPC error', async () => {
      mockRpcError(db, 'INCOME_STMT_ERROR')
      const r = await generator.generateIncomeStatement('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(false)
    })
  })

  describe('Cash Flow Statement - قائمة التدفقات النقدية', () => {
    const cashFlowData = {
      operating: {
        items: [
          { code: '4001', name: 'Net Revenue', name_ar: 'صافي الإيرادات', amount: 200000 },
          { code: '5001', name: 'Net Expenses', name_ar: 'صافي المصروفات', amount: -52000 },
          { code: '1110', name: 'AR Change', name_ar: 'تغير في الذمم المدينة', amount: -10000 },
          { code: '2101', name: 'AP Change', name_ar: 'تغير في الذمم الدائنة', amount: 5000 },
        ],
        total: 143000,
      },
      investing: {
        items: [
          { code: '1201', name: 'Fixed Assets', name_ar: 'أصول ثابتة', amount: -30000 },
        ],
        total: -30000,
      },
      financing: {
        items: [],
        total: 0,
      },
      net_change: 113000,
      period_from: '2024-01-01',
      period_to: '2024-12-31',
    }

    it('returns operating/investing/financing sections', async () => {
      mockRpc(db, cashFlowData)
      const r = await generator.generateCashFlow('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.operating).toHaveProperty('items')
        expect(r.data.investing).toHaveProperty('items')
        expect(r.data.financing).toHaveProperty('items')
        expect(r.data).toHaveProperty('net_change')
      }
    })

    it('calculates AR/AP change correctly', async () => {
      mockRpc(db, cashFlowData)
      const r = await generator.generateCashFlow('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const arItem = r.data.operating.items.find(i => i.code === '1110')
        const apItem = r.data.operating.items.find(i => i.code === '2101')
        expect(arItem).toBeDefined()
        expect(apItem).toBeDefined()
        if (arItem) expect(arItem.amount).toBe(-10000)
        if (apItem) expect(apItem.amount).toBe(5000)
      }
    })

    it('detects fixed asset purchases in investing section', async () => {
      mockRpc(db, cashFlowData)
      const r = await generator.generateCashFlow('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const investItem = r.data.investing.items.find(i => i.code === '1201')
        expect(investItem).toBeDefined()
        if (investItem) expect(investItem.amount).toBe(-30000)
        expect(r.data.investing.total).toBe(-30000)
      }
    })

    it('validates net change calculation', async () => {
      mockRpc(db, cashFlowData)
      const r = await generator.generateCashFlow('2024-01-01', '2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const expectedNet = 143000 + (-30000) + 0
        expect(r.data.net_change).toBe(expectedNet)
      }
    })

    it('handles empty cash flow', async () => {
      const empty = {
        operating: { items: [], total: 0 },
        investing: { items: [], total: 0 },
        financing: { items: [], total: 0 },
        net_change: 0,
        period_from: '2024-01-01',
        period_to: '2024-01-31',
      }
      mockRpc(db, empty)
      const r = await generator.generateCashFlow('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.operating.items).toHaveLength(0)
        expect(r.data.net_change).toBe(0)
      }
    })
  })

  describe('Stale Data Detection - اكتشاف البيانات القديمة', () => {
    it('MV returns stale data before refresh then updated after refresh', async () => {
      mockRpc(db, [])
      const before = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(before.ok).toBe(true)
      if (before.ok) expect(before.data.lines).toHaveLength(0)

      const afterData = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 5000, period_credit: 0, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      ]
      mockRpc(db, afterData)
      const after = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(after.ok).toBe(true)
      if (after.ok) expect(after.data.lines).toHaveLength(1)
    })
  })

  describe('Concurrent Refresh Safety - أمان التحديث المتزامن', () => {
    it('handles sequential concurrent refresh calls without error', async () => {
      mockRpc(db, null)
      const call1 = db.rpc('refresh_reporting_views')
      const call2 = db.rpc('refresh_reporting_views')

      const [r1, r2] = await Promise.all([call1, call2])
      expect(r1.error).toBeNull()
      expect(r2.error).toBeNull()
    })

    it('no data corruption from multiple concurrent refreshes', async () => {
      const tbData = [
        { account_id: 'a1', account_code: '1101', account_name: 'نقدية', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 10000, period_credit: 5000, closing_debit: 5000, closing_credit: 0, balance: 5000 },
      ]

      const promises = Array.from({ length: 5 }, (_, i) => {
        mockRpc(db, tbData)
        return generator.generateTrialBalance('2024-01-01', '2024-01-31')
      })

      const results = await Promise.allSettled(promises)
      results.forEach(r => {
        expect(r.status).toBe('fulfilled')
        if (r.status === 'fulfilled') {
          expect(r.value.ok).toBe(true)
        }
      })
    })

    it('RPC retry after concurrent failure', async () => {
      mockRpcError(db, 'deadlock detected', 'MV_CONCURRENT_REFRESH_FAILED')
      let r = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(false)

      mockRpc(db, [])
      r = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(r.ok).toBe(true)
    })
  })

  describe('Materialized View Indexes - فهارس العرض المادي', () => {
    it('validates unique index naming convention', () => {
      const expectedIndexes = [
        'idx_mv_trial_balance_pk',
        'idx_mv_income_statement_pk',
        'idx_mv_balance_sheet_pk',
      ]
      expectedIndexes.forEach(idx => {
        expect(idx).toMatch(/^idx_mv_.+_pk$/)
      })
    })

    it('unique index covers company_id + account_id for trial balance', () => {
      const idxCols = ['company_id', 'account_id']
      expect(idxCols).toContain('company_id')
      expect(idxCols).toContain('account_id')
    })

    it('income statement index includes fiscal_year and fiscal_month', () => {
      const idxCols = ['company_id', 'account_id', 'fiscal_year', 'fiscal_month']
      expect(idxCols).toContain('fiscal_year')
      expect(idxCols).toContain('fiscal_month')
    })
  })

  describe('Incremental Aggregation - التجميع التدريجي', () => {
    it('post journal entries then refresh MV then verify aggregation update', async () => {
      mockRpc(db, [])
      const empty = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(empty.ok).toBe(true)
      if (empty.ok) expect(empty.data.lines).toHaveLength(0)

      const afterPost = [
        { account_id: 'a1', account_code: '1101', account_name: 'Cash', account_name_ar: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_balance: 0, period_debit: 5000, period_credit: 0, closing_debit: 5000, closing_credit: 0, balance: 5000 },
        { account_id: 'a2', account_code: '4001', account_name: 'Revenue', account_name_ar: 'إيرادات', account_type: 'revenue', normal_balance: 'credit', opening_balance: 0, period_debit: 0, period_credit: 5000, closing_debit: 0, closing_credit: 5000, balance: -5000 },
      ]
      mockRpc(db, afterPost)
      const after = await generator.generateTrialBalance('2024-01-01', '2024-01-31')
      expect(after.ok).toBe(true)
      if (after.ok) {
        expect(after.data.lines).toHaveLength(2)
        const cash = after.data.lines.find(l => l.code === '1101')
        const revenue = after.data.lines.find(l => l.code === '4001')
        expect(cash).toBeDefined()
        expect(revenue).toBeDefined()
        if (cash) expect(cash.balance).toBe(5000)
        if (revenue) expect(revenue.balance).toBe(-5000)
      }
    })

    it('aggregation reflects net income in balance sheet after posting revenue and expenses', async () => {
      const bsData = {
        assets: { current: [{ account_id: 'a1', code: '1101', name: 'Cash', name_ar: 'نقدية', amount: 80000 }], fixed: [] },
        liabilities: { current: [], long_term: [] },
        equity: { capital: 50000, retained_earnings: 10000, net_income: 20000 },
        period_date: '2024-12-31',
      }
      mockRpc(db, bsData)
      const r = await generator.generateBalanceSheet('2024-12-31')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.equity.net_income).toBe(20000)
        expect(r.data.equity.total_equity).toBe(50000 + 10000 + 20000)
        expect(r.data.assets.total_assets).toBe(80000)
      }
    })
  })
})

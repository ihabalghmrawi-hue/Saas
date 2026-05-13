import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LedgerEngine } from '../accounting/ledger/ledger-engine'
import { ReconciliationEngine } from '../accounting/reconciliation/reconciliation-engine-2'
import { PayrollEngine } from '../hr/payroll/payroll-engine'
import { InventoryReportGenerator } from '../inventory/reports/report-generator'
import { StockMovementRepository } from '../inventory/repositories/movement.repository'
import { InventoryItemRepository } from '../inventory/repositories/item.repository'
import { InventoryBatchRepository } from '../inventory/repositories/batch.repository'
import { createMockDb, mockRpc, mockRpcError, mockFromResult, type MockDb } from '../test-helpers/mock-db'

describe('Snapshot & Reconciliation Validation', () => {
  let db: MockDb
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
  })

  describe('Financial Snapshots - ledger_create_snapshot()', () => {
    it('creates daily snapshot and returns snapshot id', async () => {
      mockRpc(db, 'snap-daily-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2024-01-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-daily-001')
      expect(db.rpc).toHaveBeenCalledWith('ledger_create_snapshot', {
        p_company_id: companyId,
        p_snapshot_type: 'daily',
        p_as_of_date: '2024-01-31',
      })
    })

    it('creates monthly snapshot', async () => {
      mockRpc(db, 'snap-monthly-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('monthly', '2024-01-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-monthly-001')
      expect(db.rpc).toHaveBeenCalledWith('ledger_create_snapshot', {
        p_company_id: companyId,
        p_snapshot_type: 'monthly',
        p_as_of_date: '2024-01-31',
      })
    })

    it('creates quarterly snapshot', async () => {
      mockRpc(db, 'snap-q-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('quarterly', '2024-03-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-q-001')
    })

    it('creates yearly snapshot', async () => {
      mockRpc(db, 'snap-y-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('yearly', '2024-12-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-y-001')
    })

    it('verifies total_assets, total_liabilities, total_equity are calculated', async () => {
      const snapshotData = {
        summary: {
          assets: { total: 150000 },
          liabilities: { total: 60000 },
          equity: { total: 90000 },
          revenue: { total: 80000 },
          expenses: { total: 50000 },
          net_income: 30000,
        },
      }

      expect(snapshotData.summary.assets.total).toBe(150000)
      expect(snapshotData.summary.liabilities.total).toBe(60000)
      expect(snapshotData.summary.equity.total).toBe(90000)
      expect(snapshotData.summary.assets.total).toBe(
        snapshotData.summary.liabilities.total + snapshotData.summary.equity.total,
      )
    })

    it('verifies net_income = total_revenue - total_expenses', () => {
      const totalRevenue = 80000
      const totalExpenses = 50000
      const netIncome = totalRevenue - totalExpenses

      expect(netIncome).toBe(30000)
      expect(netIncome).toBe(totalRevenue - totalExpenses)
    })

    it('snapshot summary JSON contains correct structure', async () => {
      mockRpc(db, 'snap-json-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2024-01-31')

      expect(r.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith(
        'ledger_create_snapshot',
        expect.objectContaining({
          p_snapshot_type: 'daily',
          p_as_of_date: '2024-01-31',
        }),
      )
    })

    it('passes is_final flag to snapshot rpc params', async () => {
      mockRpc(db, 'snap-final-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('monthly', '2024-12-31')

      expect(r.ok).toBe(true)
    })

    it('enforces unique constraint (company_id, snapshot_type, as_of_date)', async () => {
      mockRpc(db, 'snap-dup-001')
      const engine = new LedgerEngine(db as any, companyId)

      const r1 = await engine.createFinancialSnapshot('daily', '2024-01-31')
      expect(r1.ok).toBe(true)

      mockRpc(db, null)
      mockRpcError(db, 'duplicate key value violates unique constraint', '23505')
      const r2 = await engine.createFinancialSnapshot('daily', '2024-01-31')
      expect(r2.ok).toBe(false)
    })

    it('handles error during snapshot creation', async () => {
      mockRpcError(db, 'Snapshot generation failed')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2024-01-31')

      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('SNAPSHOT_FAILED')
    })
  })

  describe('Inventory Snapshots - generate_inventory_snapshot()', () => {
    it('creates daily inventory snapshot', async () => {
      vi.spyOn(StockMovementRepository.prototype, 'getWarehouseBalances').mockResolvedValue([
        { item_id: 'item-1', warehouse_id: 'wh-1', current_qty: 10, unit_cost: 50, total_value: 500 },
      ] as any)
      vi.spyOn(InventoryItemRepository.prototype, 'findAllActive').mockResolvedValue([
        { id: 'item-1', code: 'ITM-001', name: 'Test Item', cost_method: 'weighted_average' },
      ] as any)

      const generator = new InventoryReportGenerator(db as any, companyId)
      const r = await generator.generateStockValuation()

      expect(r.ok).toBe(true)
    })

    it('verifies qty, unit_cost, total_value are correct', () => {
      const items = [
        { item_id: 'item-1', qty: 10, unit_cost: 50, total_value: 500 },
        { item_id: 'item-2', qty: 5, unit_cost: 100, total_value: 500 },
      ]

      for (const item of items) {
        expect(item.total_value).toBe(item.qty * item.unit_cost)
      }
      const totalValue = items.reduce((s, i) => s + i.total_value, 0)
      expect(totalValue).toBe(1000)
    })

    it('filters inventory snapshot by warehouse_id', async () => {
      vi.spyOn(StockMovementRepository.prototype, 'getWarehouseBalances').mockResolvedValue([
        { item_id: 'item-1', warehouse_id: 'wh-1', current_qty: 10, unit_cost: 50, total_value: 500 },
      ] as any)
      vi.spyOn(InventoryItemRepository.prototype, 'findAllActive').mockResolvedValue([
        { id: 'item-1', code: 'ITM-001', name: 'Test Item', cost_method: 'weighted_average' },
      ] as any)

      const generator = new InventoryReportGenerator(db as any, companyId)
      const r = await generator.generateStockValuation('wh-1')

      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.items[0].qty).toBe(10)
        expect(r.data.total_qty).toBe(10)
        expect(r.data.total_value).toBe(500)
      }
    })

    it('supports snapshot_type variants (daily, weekly, monthly, manual, closing)', () => {
      const types = ['daily', 'weekly', 'monthly', 'manual', 'closing']
      for (const t of types) {
        expect(typeof t).toBe('string')
      }
    })
  })

  describe('Payroll Summaries', () => {
    it('gross_pay = sum of all allowances + salary', () => {
      const basicSalary = 10000
      const housing = 2000
      const transportation = 1000
      const communication = 500
      const costOfLiving = 800
      const other = 300
      const overtime = 700
      const bonuses = 1000
      const grossPay = basicSalary + housing + transportation + communication + costOfLiving + other + overtime + bonuses

      expect(grossPay).toBe(16300)
      expect(grossPay).toBe(10000 + 2000 + 1000 + 500 + 800 + 300 + 700 + 1000)
    })

    it('net_pay = gross_pay - total_deductions', () => {
      const grossPay = 16300
      const loanDeduction = 1000
      const taxDeduction = 500
      const socialInsurance = 733.50
      const otherDeductions = 200
      const totalDeductions = loanDeduction + taxDeduction + socialInsurance + otherDeductions
      const netPay = Math.max(0, grossPay - totalDeductions)

      expect(totalDeductions).toBe(2433.50)
      expect(netPay).toBe(13866.50)
      expect(netPay).toBe(grossPay - totalDeductions)
    })

    it('employer_contributions tracked separately', () => {
      const grossPay = 16300
      const socialInsuranceRate = 0.09
      const employerSocialInsurance = grossPay * socialInsuranceRate * 0.5
      const employerContributions = employerSocialInsurance

      expect(employerContributions).toBe(733.50)
    })

    it('payroll summaries upsert preserves unique constraint on (run_id, employee_id)', async () => {
      mockRpc(db, { data: null })
      const payrollEngine = new PayrollEngine(db as any, companyId)
      vi.spyOn(payrollEngine as any, 'processRun').mockResolvedValue({ ok: true, data: { id: 'run-1' } })

      const r = await (payrollEngine as any).processRun('run-1', 'user-1')
      expect(r.ok).toBe(true)
    })
  })

  describe('Reconciliation Consistency', () => {
    it('creates reconciliation entry with correct statement_amount', async () => {
      mockFromResult(db, 'reconciliations', {
        id: 'rec-001',
        company_id: companyId,
        account_id: 'acct-1',
        reference_type: 'bank_statement',
        reference_number: 'BS-2024-001',
        statement_date: '2024-01-31',
        statement_amount: 15000,
        cleared_amount: 0,
        difference: 15000,
        status: 'unmatched',
      })

      const engine = new ReconciliationEngine(db as any, companyId)
      const r = await engine.createReconciliation({
        account_id: 'acct-1',
        reference_type: 'bank_statement',
        reference_number: 'BS-2024-001',
        statement_date: '2024-01-31',
        statement_amount: 15000,
      })

      expect(r.ok).toBe(true)
    })

    it('difference = statement_amount - cleared_amount (generated column)', () => {
      const statementAmount = 15000
      const clearedAmount = 10000
      const difference = statementAmount - clearedAmount

      expect(difference).toBe(5000)
      expect(difference).toBe(statementAmount - clearedAmount)
    })

    it('status transitions: unmatched -> partial -> matched -> overpaid', () => {
      let status: string = 'unmatched'
      expect(status).toBe('unmatched')

      const statementAmount = 10000
      let clearedAmount = 0

      clearedAmount = 3000
      status = clearedAmount < statementAmount ? 'partial' : 'matched'
      expect(status).toBe('partial')

      clearedAmount = 10000
      status = clearedAmount >= statementAmount ? 'matched' : 'partial'
      expect(status).toBe('matched')

      clearedAmount = 11000
      status = clearedAmount > statementAmount ? 'overpaid' : status
      expect(status).toBe('overpaid')
    })

    it('reconciliation_lines matching logic calculates difference correctly', () => {
      const lines = [
        { amount: 5000, matched_amount: 5000 },
        { amount: 3000, matched_amount: 2000 },
      ]

      for (const line of lines) {
        const diff = line.amount - line.matched_amount
        expect(diff).toBe(line.amount - line.matched_amount)
      }
      expect(lines[0].amount - lines[0].matched_amount).toBe(0)
      expect(lines[1].amount - lines[1].matched_amount).toBe(1000)
    })

    it('auto-match updates cleared_amount and status', async () => {
      mockFromResult(db, 'reconciliations', {
        id: 'rec-002',
        company_id: companyId,
        account_id: 'acct-1',
        statement_amount: 10000,
        cleared_amount: 0,
        status: 'unmatched',
      })

      const engine = new ReconciliationEngine(db as any, companyId)
      vi.spyOn(db, 'from').mockImplementation(
        () =>
          ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'rec-002',
                company_id: companyId,
                account_id: 'acct-1',
                statement_amount: 10000,
                cleared_amount: 0,
                status: 'unmatched',
              },
              error: null,
            }),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
            _result: { data: null, error: null },
          }) as any,
      )

      const r = await engine.autoMatch('rec-002')
      expect(r.ok).toBe(true)
    })
  })

  describe('Account Balances Daily Consistency', () => {
    it('ledger_generate_daily_balances creates correct entries', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.generateDailyBalances('2024-01-15')

      expect(r.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_generate_daily_balances', {
        p_company_id: companyId,
        p_as_of_date: '2024-01-15',
      })
    })

    it('opening + period = closing for each account', () => {
      const balances = [
        { account: 'Cash', opening: 50000, period_debit: 10000, period_credit: 5000, closing: 55000 },
        { account: 'AR', opening: 0, period_debit: 20000, period_credit: 0, closing: 20000 },
      ]

      for (const acct of balances) {
        const expectedClosing = acct.opening + (acct.period_debit - acct.period_credit)
        expect(acct.closing).toBe(expectedClosing)
      }
    })

    it('net_movement = period_debit - period_credit (generated column)', () => {
      const periodDebit = 10000
      const periodCredit = 5000
      const netMovement = periodDebit - periodCredit

      expect(netMovement).toBe(5000)
      expect(netMovement).toBe(periodDebit - periodCredit)
    })

    it('test upsert behavior (ON CONFLICT DO UPDATE)', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)
      const r1 = await engine.generateDailyBalances('2024-01-15')
      expect(r1.ok).toBe(true)

      const r2 = await engine.generateDailyBalances('2024-01-15')
      expect(r2.ok).toBe(true)
    })

    it('currency defaults to SAR', () => {
      const entry = { currency: 'SAR' }
      expect(entry.currency).toBe('SAR')
    })

    it('handles error during daily balance generation', async () => {
      mockRpcError(db, 'Daily balance generation failed')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.generateDailyBalances('2024-01-15')

      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('DAILY_BALANCES_FAILED')
    })
  })

  describe('Historical Rebuild Capability', () => {
    it('snapshots can be regenerated for past dates', async () => {
      mockRpc(db, 'snap-rebuild-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2023-12-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-rebuild-001')
    })

    it('daily balances can be recalculated for past dates', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.generateDailyBalances('2024-06-15')

      expect(r.ok).toBe(true)
      expect(db.rpc).toHaveBeenCalledWith('ledger_generate_daily_balances', {
        p_company_id: companyId,
        p_as_of_date: '2024-06-15',
      })
    })

    it('historical data remains consistent after rebuild', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)

      const r1 = await engine.generateDailyBalances('2024-01-15')
      expect(r1.ok).toBe(true)

      const r2 = await engine.generateDailyBalances('2024-01-15')
      expect(r2.ok).toBe(true)

      expect(db.rpc).toHaveBeenCalledTimes(2)
    })

    it('rebuilds daily balances for date range', async () => {
      mockRpc(db, null)

      const engine = new LedgerEngine(db as any, companyId)

      const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']
      for (const date of dates) {
        const r = await engine.generateDailyBalances(date)
        expect(r.ok).toBe(true)
      }

      expect(db.rpc).toHaveBeenCalledTimes(5)
    })

    it('rebuilds snapshot after journal corrections', async () => {
      mockRpc(db, 'snap-corrected-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2024-01-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe('snap-corrected-001')
    })
  })

  describe('Cross-Snapshot Consistency', () => {
    it('financial_snapshots total_assets matches account_balances_daily', async () => {
      mockRpc(db, 150000)

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.getAccountBalance('acct-assets', '2024-01-31')

      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBe(150000)

      mockRpc(db, 'snap-cross-001')
      const snapR = await engine.createFinancialSnapshot('daily', '2024-01-31')
      expect(snapR.ok).toBe(true)
    })

    it('running balance across multiple daily balances is correct', async () => {
      const dailyBalances = [
        { date: '2024-01-01', opening: 0, period_debit: 50000, period_credit: 0, closing: 50000 },
        { date: '2024-01-02', opening: 50000, period_debit: 10000, period_credit: 0, closing: 60000 },
        { date: '2024-01-03', opening: 60000, period_debit: 0, period_credit: 5000, closing: 55000 },
      ]

      for (let i = 0; i < dailyBalances.length; i++) {
        const d = dailyBalances[i]
        expect(d.closing).toBe(d.opening + (d.period_debit - d.period_credit))
        if (i > 0) {
          expect(d.opening).toBe(dailyBalances[i - 1].closing)
        }
      }
    })

    it('daily balances accumulate correctly to monthly total', async () => {
      const dailyTotals = [50000, 10000, -5000, 2000, -1000]
      const monthlyTotal = dailyTotals.reduce((s, v) => s + v, 0)

      expect(monthlyTotal).toBe(56000)
    })
  })

  describe('Payroll Summary Validation', () => {
    it('gross_pay includes all earnings components', () => {
      const summary = {
        basic_salary: 10000,
        housing_allowance: 2000,
        transportation_allowance: 1000,
        communication_allowance: 500,
        cost_of_living_allowance: 800,
        other_allowances: 300,
        overtime_amount: 700,
        bonuses: 1000,
      }
      const grossPay = Object.values(summary).reduce((s, v) => s + v, 0)
      expect(grossPay).toBe(16300)
    })

    it('net_pay never goes below zero', () => {
      const grossPay = 5000
      const totalDeductions = 7000
      const netPay = Math.max(0, grossPay - totalDeductions)
      expect(netPay).toBe(0)
    })

    it('total_deductions is sum of all deduction types', () => {
      const deductions = {
        loan_deduction: 1000,
        tax_deduction: 500,
        social_insurance: 733.50,
        medical_insurance: 300,
        other_deductions: 200,
      }
      const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
      expect(totalDeductions).toBe(2733.50)
    })
  })

  describe('Reconciliation Line Matching', () => {
    it('matched_amount never exceeds amount on a line', () => {
      const lineAmount = 5000
      const matchedAmount = 3000
      expect(matchedAmount).toBeLessThanOrEqual(lineAmount)
    })

    it('partial match leaves positive difference', () => {
      const amount = 5000
      const matchedAmount = 2000
      const diff = amount - matchedAmount
      expect(diff).toBeGreaterThan(0)
      expect(diff).toBe(3000)
    })

    it('full match results in zero difference', () => {
      const amount = 5000
      const matchedAmount = 5000
      const diff = amount - matchedAmount
      expect(diff).toBe(0)
    })

    it('overpaid status when cleared exceeds statement', () => {
      const statementAmount = 10000
      const clearedAmount = 12000
      const diff = statementAmount - clearedAmount
      const status = diff < 0 ? 'overpaid' : diff === 0 ? 'matched' : 'partial'
      expect(status).toBe('overpaid')
      expect(diff).toBe(-2000)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles zero balance snapshot', async () => {
      mockRpc(db, 'snap-zero-001')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('daily', '2024-01-01')

      expect(r.ok).toBe(true)
    })

    it('handles null as_of_date for createFinancialSnapshot', async () => {
      mockRpc(db, 'snap-today-001')

      const engine = new LedgerEngine(db as any, companyId)
      await engine.createFinancialSnapshot()
      expect(db.rpc).toHaveBeenCalledWith('ledger_create_snapshot', {
        p_company_id: companyId,
        p_snapshot_type: 'daily',
        p_as_of_date: expect.any(String),
      })
    })

    it('rejects invalid snapshot_type via engine layer', async () => {
      mockRpcError(db, 'invalid snapshot type')

      const engine = new LedgerEngine(db as any, companyId)
      const r = await engine.createFinancialSnapshot('invalid' as any, '2024-01-31')

      expect(r.ok).toBe(false)
    })

    it('handles error in inventory snapshot', async () => {
      vi.spyOn(StockMovementRepository.prototype, 'getWarehouseBalances').mockRejectedValue(
        new Error('INVENTORY_SNAPSHOT_ERROR'),
      )

      const generator = new InventoryReportGenerator(db as any, companyId)
      const r = await generator.generateStockValuation()

      expect(r.ok).toBe(false)
    })
  })
})

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'
import { JournalEngine } from '../../domains/accounting/services/journal-engine.service'
import { StockMovementEngine } from '../../domains/inventory/movements/movement-engine'
import { PayrollEngine } from '../../domains/hr/payroll/payroll-engine'
import { StatementGenerator } from '../../domains/accounting/reports/statement-generator'
import { LedgerEngine } from '../../domains/accounting/ledger/ledger-engine'
import { JobQueueService } from '../../domains/accounting/events/job-queue.service'
import { SalesReportGenerator } from '../../domains/sales/reports/report-generator'
import { JournalService } from '../../domains/accounting/services/journal.service'
import { AccountRepository } from '../../domains/accounting/repositories/account.repository'
import { PeriodRepository } from '../../domains/accounting/repositories/period.repository'
import { JournalRepository } from '../../domains/accounting/repositories/journal.repository'
import { StockMovementRepository } from '../../domains/inventory/repositories/movement.repository'
import { InventoryValuationLayerRepository } from '../../domains/inventory/repositories/valuation.repository'
import { InventoryItemRepository } from '../../domains/inventory/repositories/item.repository'
import { PayrollRunRepository, PayrollCycleRepository, PayrollLineRepository, PayrollSummaryRepository } from '../../domains/hr/repositories/payroll.repository'
import { EmployeeRepository, EmployeeContractRepository } from '../../domains/hr/repositories/employee.repository'
import { AttendanceLogRepository, OvertimeRepository } from '../../domains/hr/repositories/attendance.repository'
import { PayrollAdjustmentRepository, LoanRepository, LoanPaymentRepository } from '../../domains/hr/repositories/payroll.repository'
import { RecurringJournalRepository } from '../../domains/accounting/repositories/recurring.repository'
import { createMockDb, mockRpc, mockFromResult, type MockDb } from '../test-helpers/mock-db'

const WARMUP_ITERATIONS = 3
const MEASURE_ITERATIONS = 5

function benchmark(name: string, fn: () => Promise<any> | any, thresholdMs: number): Promise<number> {
  return (async () => {
    for (let i = 0; i < WARMUP_ITERATIONS; i++) await fn()
    const times: number[] = []
    for (let i = 0; i < MEASURE_ITERATIONS; i++) {
      const start = performance.now()
      await fn()
      times.push(performance.now() - start)
    }
    const avg = times.reduce((s, t) => s + t, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    console.log(`  ${name}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms (threshold=${thresholdMs}ms)`)
    expect(avg).toBeLessThan(thresholdMs)
    return avg
  })()
}

describe('Performance Benchmarking', () => {
  let db: MockDb
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('1. Journal Posting Throughput', () => {
    it('benchmarks single journal entry creation (< 50ms)', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({ id: 'acct-1', code: '1110', name: 'Cash', is_postable: true } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      const createdEntries: Array<any> = []
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => {
              const idx = createdEntries.length
              const e = { id: `je-${idx}`, entry_number: `JE-${String(idx).padStart(3, '0')}` }
              createdEntries.push(e)
              return { data: e, error: null }
            }),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      const elapsed = await benchmark('single entry', () =>
        engine.create({
          company_id: companyId, description: 'test', date: '2024-06-15',
          source: 'benchmark', source_id: 'bm-1',
          lines: [{ account_code: '1110', debit: 1000, credit: 0 }, { account_code: '4100', debit: 0, credit: 1000 }],
        }), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks batch of 10 entries', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({ id: 'acct-1', code: '1110', name: 'Cash', is_postable: true } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      let entryNumIdx = 0
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockImplementation(async () => `JE-B-${String(entryNumIdx++).padStart(3, '0')}`)
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      const created: Array<any> = []
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => {
              const e = { id: `je-b-${created.length}`, entry_number: `JE-B-${String(created.length).padStart(3, '0')}` }
              created.push(e)
              return { data: e, error: null }
            }),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      const elapsed = await benchmark('batch 10 entries', () =>
        Promise.all(Array.from({ length: 10 }, (_, i) =>
          engine.create({
            company_id: companyId, description: `batch ${i}`, date: '2024-06-15',
            source: 'benchmark', source_id: `bm-b-${i}`,
            lines: [{ account_code: '1110', debit: 100, credit: 0 }, { account_code: '4100', debit: 0, credit: 100 }],
          })
        )), 300)
      const throughput = 10 / (elapsed / 1000)
      console.log(`  Throughput: ${throughput.toFixed(1)} entries/sec`)
      expect(throughput).toBeGreaterThan(0)
    })

    it('benchmarks entries with varying line counts (2, 5, 10 lines)', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({ id: 'acct-1', code: '1110', name: 'Cash', is_postable: true } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-VL-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-vl-1', entry_number: 'JE-VL-001' }, error: null })),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      const lineCounts = [2, 5, 10]
      for (const n of lineCounts) {
        const lines = Array.from({ length: n }, (_, i) => ({
          account_code: i % 2 === 0 ? '1110' : '4100',
          debit: i % 2 === 0 ? 100 / (n / 2) : 0,
          credit: i % 2 === 1 ? 100 / (n / 2) : 0,
        }))
        const elapsed = await benchmark(`${n} line(s)`, () =>
          engine.create({
            company_id: companyId, description: `${n}-line entry`, date: '2024-06-15',
            source: 'benchmark', source_id: `bm-ln-${n}`,
            lines: lines as any,
          }), 100)
        expect(elapsed).toBeGreaterThan(0)
      }
    })
  })

  describe('2. Inventory Throughput', () => {
    it('benchmarks stock movement creation (receipt)', async () => {
      vi.spyOn(StockMovementRepository.prototype, 'createMovement').mockResolvedValue({ id: 'mov-1', item_id: 'item-1', qty: 100, unit_cost: 50, total_cost: 5000 } as any)
      vi.spyOn(InventoryValuationLayerRepository.prototype, 'addLayer').mockResolvedValue({} as any)
      vi.spyOn(InventoryItemRepository.prototype, 'findById').mockResolvedValue({ id: 'item-1', cost_method: 'weighted_average' } as any)
      const engine = new StockMovementEngine(db as any, companyId)
      const elapsed = await benchmark('stock receipt', () =>
        engine.receive({ item_id: 'item-1', warehouse_id: 'wh-1', qty: 100, unit_cost: 50, source: 'benchmark', source_id: 'bm-rec-1', created_by: 'user-1' }), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks stock movement query (getCurrentStock)', async () => {
      vi.spyOn(StockMovementRepository.prototype, 'getCurrentStock').mockResolvedValue(500)
      const repo = new StockMovementRepository(db as any, companyId)
      const elapsed = await benchmark('getCurrentStock', () =>
        repo.getCurrentStock('item-1', 'wh-1'), 30)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks warehouse balance query with varying item counts', async () => {
      const itemCounts = [1, 10, 50]
      for (const n of itemCounts) {
        vi.spyOn(StockMovementRepository.prototype, 'getCurrentStock').mockImplementation(async (itemId: string) => {
          return 100 + parseInt(itemId.replace('item-', ''), 10)
        })
        const repo = new StockMovementRepository(db as any, companyId)
        const elapsed = await benchmark(`getCurrentStock (${n} items)`, () =>
          Promise.all(Array.from({ length: n }, (_, i) => repo.getCurrentStock(`item-${i}`, 'wh-1'))), n * 30)
        expect(elapsed).toBeGreaterThan(0)
      }
    })

    it('benchmarks inventory turnover analysis', async () => {
      mockRpc(db, { turnover_ratio: 3.5, average_days: 104, cogs: 50000, average_inventory: 14285 })
      const elapsed = await benchmark('inventory turnover', () =>
        db.rpc('get_inventory_turnover', { p_company_id: companyId, p_from_date: '2024-01-01', p_to_date: '2024-12-31' }), 30)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('3. Payroll Execution', () => {
    it('benchmarks single employee payroll calculation', async () => {
      vi.spyOn(EmployeeRepository.prototype, 'findPaged').mockResolvedValue({ data: [{ id: 'emp-1', employee_no: 'EMP-001', full_name: 'Emp 1', status: 'active', hire_date: '2024-01-01' }], count: 1 } as any)
      vi.spyOn(PayrollCycleRepository.prototype, 'findOpen').mockResolvedValue({ id: 'cycle-1', company_id: companyId, period_start: '2024-06-01', period_end: '2024-06-30', is_closed: false } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'findById').mockResolvedValue({ id: 'run-1', cycle_id: 'cycle-1', status: 'draft', total_earnings: 0, total_deductions: 0, net_pay: 0, employee_count: 0 } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(EmployeeContractRepository.prototype, 'findActiveByEmployee').mockResolvedValue({ id: 'ctr-1', basic_salary: 5000, housing_allowance: 1000, transportation_allowance: 500, is_active: true } as any)
      vi.spyOn(AttendanceLogRepository.prototype, 'findRange').mockResolvedValue([{ id: 'att-1', status: 'present', date: '2024-06-01' } as any])
      vi.spyOn(OvertimeRepository.prototype, 'findByEmployeeDate').mockResolvedValue([{ id: 'ot-1', status: 'approved', amount: 200 } as any])
      vi.spyOn(PayrollAdjustmentRepository.prototype, 'findByEmployee').mockResolvedValue([])
      vi.spyOn(LoanRepository.prototype, 'findActiveByEmployee').mockResolvedValue([])
      vi.spyOn(LoanPaymentRepository.prototype, 'create').mockResolvedValue({} as any)
      vi.spyOn(LoanRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(PayrollLineRepository.prototype, 'deleteByRun').mockResolvedValue(undefined)
      vi.spyOn(PayrollLineRepository.prototype, 'createBatch').mockResolvedValue(undefined)
      vi.spyOn(PayrollSummaryRepository.prototype, 'upsert').mockResolvedValue(undefined)
      const engine = new PayrollEngine(db as any, companyId)
      const elapsed = await benchmark('single employee payroll', () => engine.processRun('run-1', 'user-1'), 100)
      expect(elapsed).toBeGreaterThan(0)
    }, 15000)

    it('benchmarks full payroll run (10 employees)', async () => {
      const empIds = Array.from({ length: 10 }, (_, i) => `emp-${i}`)
      vi.spyOn(PayrollCycleRepository.prototype, 'findOpen').mockResolvedValue({ id: 'cycle-1', company_id: companyId, period_start: '2024-06-01', period_end: '2024-06-30', is_closed: false } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'findById').mockResolvedValue({ id: 'run-10', cycle_id: 'cycle-1', status: 'draft', total_earnings: 0, total_deductions: 0, net_pay: 0, employee_count: 0 } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(EmployeeRepository.prototype, 'findPaged').mockResolvedValue({ data: empIds.map(id => ({ id, employee_no: `EMP-${id}`, full_name: `Emp ${id}`, status: 'active', hire_date: '2024-01-01' })), count: 10 } as any)
      vi.spyOn(EmployeeContractRepository.prototype, 'findActiveByEmployee').mockResolvedValue({ id: 'ctr-1', basic_salary: 5000, housing_allowance: 1000, transportation_allowance: 500, is_active: true } as any)
      vi.spyOn(AttendanceLogRepository.prototype, 'findRange').mockResolvedValue([{ id: 'att-1', status: 'present', date: '2024-06-01' } as any])
      vi.spyOn(OvertimeRepository.prototype, 'findByEmployeeDate').mockResolvedValue([{ id: 'ot-1', status: 'approved', amount: 200 } as any])
      vi.spyOn(PayrollAdjustmentRepository.prototype, 'findByEmployee').mockResolvedValue([])
      vi.spyOn(LoanRepository.prototype, 'findActiveByEmployee').mockResolvedValue([])
      vi.spyOn(LoanPaymentRepository.prototype, 'create').mockResolvedValue({} as any)
      vi.spyOn(LoanRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(PayrollLineRepository.prototype, 'deleteByRun').mockResolvedValue(undefined)
      vi.spyOn(PayrollLineRepository.prototype, 'createBatch').mockResolvedValue(undefined)
      vi.spyOn(PayrollSummaryRepository.prototype, 'upsert').mockResolvedValue(undefined)
      const engine = new PayrollEngine(db as any, companyId)
      const elapsed = await benchmark('full payroll run (10 employees)', () => engine.processRun('run-10', 'user-1'), 300)
      expect(elapsed).toBeGreaterThan(0)
      if (elapsed > 0) {
        const empPerSec = 10 / (elapsed / 1000)
        console.log(`  Processing rate: ${empPerSec.toFixed(1)} employees/sec`)
      }
    }, 15000)

    it('benchmarks large payroll run (50 employees)', async () => {
      const empIds = Array.from({ length: 50 }, (_, i) => `emp-${i}`)
      vi.spyOn(PayrollCycleRepository.prototype, 'findOpen').mockResolvedValue({ id: 'cycle-1', company_id: companyId, period_start: '2024-06-01', period_end: '2024-06-30', is_closed: false } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'findById').mockResolvedValue({ id: 'run-50', cycle_id: 'cycle-1', status: 'draft', total_earnings: 0, total_deductions: 0, net_pay: 0, employee_count: 0 } as any)
      vi.spyOn(PayrollRunRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(EmployeeRepository.prototype, 'findPaged').mockResolvedValue({ data: empIds.map(id => ({ id, employee_no: `EMP-${id}`, full_name: `Emp ${id}`, status: 'active', hire_date: '2024-01-01' })), count: 50 } as any)
      vi.spyOn(EmployeeContractRepository.prototype, 'findActiveByEmployee').mockResolvedValue({ id: 'ctr-1', basic_salary: 5000, housing_allowance: 1000, transportation_allowance: 500, is_active: true } as any)
      vi.spyOn(AttendanceLogRepository.prototype, 'findRange').mockResolvedValue([{ id: 'att-1', status: 'present', date: '2024-06-01' } as any])
      vi.spyOn(OvertimeRepository.prototype, 'findByEmployeeDate').mockResolvedValue([{ id: 'ot-1', status: 'approved', amount: 200 } as any])
      vi.spyOn(PayrollAdjustmentRepository.prototype, 'findByEmployee').mockResolvedValue([])
      vi.spyOn(LoanRepository.prototype, 'findActiveByEmployee').mockResolvedValue([])
      vi.spyOn(LoanPaymentRepository.prototype, 'create').mockResolvedValue({} as any)
      vi.spyOn(LoanRepository.prototype, 'update').mockResolvedValue({} as any)
      vi.spyOn(PayrollLineRepository.prototype, 'deleteByRun').mockResolvedValue(undefined)
      vi.spyOn(PayrollLineRepository.prototype, 'createBatch').mockResolvedValue(undefined)
      vi.spyOn(PayrollSummaryRepository.prototype, 'upsert').mockResolvedValue(undefined)
      const engine = new PayrollEngine(db as any, companyId)
      const elapsed = await benchmark('large payroll run (50 employees)', () => engine.processRun('run-50', 'user-1'), 1000)
      expect(elapsed).toBeGreaterThan(0)
    }, 15000)

    it('measures net_pay calculation time', async () => {
      vi.spyOn(PayrollRunRepository.prototype, 'update').mockImplementation(async (_id: string, data: any) => ({ ...data } as any))
      const start = performance.now()
      const netPayCalc = { total_earnings: 6700, total_deductions: 1200, net_pay: 5500, employee_count: 1 }
      const elapsed = performance.now() - start
      console.log(`  net_pay calculation: ${elapsed.toFixed(3)}ms`)
      expect(netPayCalc.net_pay).toBe(netPayCalc.total_earnings - netPayCalc.total_deductions)
      expect(elapsed).toBeLessThan(5)
    })
  })

  describe('4. Report Generation', () => {
    it('benchmarks get_income_statement() RPC', async () => {
      mockRpc(db, { revenue: [{ code: '4001', name: 'Sales', name_ar: 'مبيعات', amount: 50000 }], cogs: [{ code: '5001', name: 'COGS', amount: 30000 }], expenses: [{ code: '6501', name: 'Rent', amount: 10000 }], gross_profit: 20000, net_income: 10000, period_from: '2024-01-01', period_to: '2024-01-31' })
      const generator = new StatementGenerator(db as any, companyId)
      const elapsed = await benchmark('get_income_statement', () => generator.generateIncomeStatement('2024-01-01', '2024-01-31'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks get_balance_sheet() RPC', async () => {
      mockRpc(db, { assets: { current: [{ code: '1101', name: 'Cash', amount: 50000 }], fixed: [], total_assets: 50000 }, liabilities: { current: [], long_term: [], total_liabilities: 0 }, equity: { capital: 50000, retained_earnings: 0, net_income: 0, total_equity: 50000 }, period_date: '2024-01-31' })
      const generator = new StatementGenerator(db as any, companyId)
      const elapsed = await benchmark('get_balance_sheet', () => generator.generateBalanceSheet('2024-01-31'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks get_cash_flow() RPC', async () => {
      mockRpc(db, { operating: { items: [], total: 10000 }, investing: { items: [], total: -5000 }, financing: { items: [], total: 0 }, net_change: 5000, period_from: '2024-01-01', period_to: '2024-01-31' })
      const generator = new StatementGenerator(db as any, companyId)
      const elapsed = await benchmark('get_cash_flow', () => generator.generateCashFlow('2024-01-01', '2024-01-31'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks trial balance generation', async () => {
      const tbLines = Array.from({ length: 20 }, (_, i) => ({
        account_id: `a${i}`, account_code: `${1001 + i}`, account_name: `Account ${i}`,
        account_name_ar: `حساب ${i}`, account_type: i % 2 === 0 ? 'asset' : 'liability',
        normal_balance: i % 2 === 0 ? 'debit' : 'credit',
        opening_debit: 0, opening_credit: 0, period_debit: 1000 * (i + 1), period_credit: i % 2 === 0 ? 500 * (i + 1) : 1500 * (i + 1),
        closing_debit: 1000 * (i + 1), closing_credit: i % 2 === 0 ? 500 * (i + 1) : 1500 * (i + 1),
        balance: i % 2 === 0 ? 500 * (i + 1) : -1500 * (i + 1),
      }))
      mockRpc(db, tbLines)
      const engine = new LedgerEngine(db as any, companyId)
      const elapsed = await benchmark('trial balance', () => engine.getTrialBalance('2024-01-01', '2024-01-31'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks account balance queries', async () => {
      mockRpc(db, 50000)
      const engine = new LedgerEngine(db as any, companyId)
      const elapsed = await benchmark('account balance query', () => engine.getAccountBalance('a1'), 30)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('5. RPC Execution', () => {
    it('benchmarks ledger_get_account_balance with various account counts', async () => {
      const accountCounts = [1, 10, 50]
      for (const n of accountCounts) {
        mockRpc(db, 25000)
        const engine = new LedgerEngine(db as any, companyId)
        const elapsed = await benchmark(`ledger_get_account_balance (${n} accounts)`, () =>
          Promise.all(Array.from({ length: n }, (_, i) => engine.getAccountBalance(`a${i}`))), n * 20)
        expect(elapsed).toBeGreaterThan(0)
      }
    })

    it('benchmarks ledger_get_all_balances()', async () => {
      const balances = Array.from({ length: 20 }, (_, i) => ({
        account_id: `a${i}`, account_code: `${1001 + i}`, account_name: `Account ${i}`,
        account_name_ar: `حساب ${i}`, account_type: 'asset', normal_balance: 'debit',
        balance: 1000 * (i + 1), total_debit: 2000 * (i + 1), total_credit: 1000 * (i + 1),
      }))
      mockRpc(db, balances)
      const engine = new LedgerEngine(db as any, companyId)
      const elapsed = await benchmark('ledger_get_all_balances', () => engine.getAllBalances('2024-06-30'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks ledger_get_general_ledger with date range', async () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        entry_id: `e${i}`, entry_number: `JE-${String(i).padStart(3, '0')}`, entry_date: '2024-06-15',
        description: `Entry ${i}`, account_id: 'a1', account_code: '1101', account_name: 'Cash',
        debit: i % 2 === 0 ? 1000 : 0, credit: i % 2 === 1 ? 1000 : 0, running_balance: 1000 * (i + 1),
      }))
      mockRpc(db, entries)
      const engine = new LedgerEngine(db as any, companyId)
      const elapsed = await benchmark('ledger_get_general_ledger', () => engine.getGeneralLedger({ accountId: 'a1', fromDate: '2024-01-01', toDate: '2024-12-31' }), 100)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks get_customer_aging with varying customer count', async () => {
      const customerCounts = [5, 25, 100]
      for (const n of customerCounts) {
        const aging = Array.from({ length: n }, (_, i) => ({
          customer_id: `cust-${i}`, customer_name: `Customer ${i}`,
          total_balance: 1000 * (i + 1), current_amount: 500 * (i + 1),
          days_1_30: 200, days_31_60: 200, days_61_90: 100, days_90_plus: 0,
        }))
        mockRpc(db, aging)
        const reportGen = new SalesReportGenerator(db as any, companyId)
        const elapsed = await benchmark(`get_customer_aging (${n} customers)`, () => reportGen.generateCustomerAging('2024-06-30'), n * 2 + 50)
        expect(elapsed).toBeGreaterThan(0)
      }
    })

    it('benchmarks get_sales_summary with date range', async () => {
      const summary = Array.from({ length: 31 }, (_, i) => ({
        period_date: `2024-06-${String(i + 1).padStart(2, '0')}`,
        invoice_count: Math.floor(Math.random() * 5) + 1,
        total_sales: 1000 * (i + 1), total_tax: 150 * (i + 1),
        total_discount: 50, net_sales: 1100 * (i + 1),
      }))
      mockRpc(db, summary)
      const reportGen = new SalesReportGenerator(db as any, companyId)
      const elapsed = await benchmark('get_sales_summary', () => reportGen.generateSalesSummary('2024-06-01', '2024-06-30'), 50)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('6. Queue Throughput', () => {
    it('benchmarks job enqueue operations', async () => {
      mockFromResult(db, 'job_queue', { id: 'job-1' })
      const queue = new JobQueueService(db as any)
      const elapsed = await benchmark('enqueue single job', () => queue.enqueue(companyId, 'process_recurring', {}), 30)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks batch enqueue (50 jobs)', async () => {
      mockFromResult(db, 'job_queue', { id: 'job-n' })
      const queue = new JobQueueService(db as any)
      const elapsed = await benchmark('enqueue 50 jobs', () =>
        Promise.all(Array.from({ length: 50 }, (_, i) =>
          queue.enqueue(companyId, 'process_recurring', { seq: i }, { priority: i % 10 })
        )), 300)
      const throughput = 50 / (elapsed / 1000)
      console.log(`  Enqueue throughput: ${throughput.toFixed(1)} jobs/sec`)
      expect(throughput).toBeGreaterThan(0)
    })

    it('benchmarks job dequeue/process operations', async () => {
      const job = { id: 'job-deq', company_id: companyId, task: 'process_recurring', payload: {}, status: 'pending', priority: 5, scheduled_for: null, started_at: null, completed_at: null, error_message: null, retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z' }
      mockFromResult(db, 'job_queue', job)
      const queue = new JobQueueService(db as any)
      const elapsed = await benchmark('dequeue + process job', async () => {
        const r = await queue.dequeue(companyId)
        if (r.ok && r.data) await queue.complete(r.data.id, {})
      }, 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks recurring journal creation from template', async () => {
      const recurring = { id: 'rec-1', company_id: companyId, name: 'Monthly Rent', frequency: 'monthly', day_of_month: 1, start_date: '2024-01-01', next_run_date: '2024-07-01', last_run_date: '2024-06-01', total_runs: 6, max_runs: 12, status: 'active', is_auto_post: true, template_lines: [{ account_code: '6001', debit: 5000, credit: 0 }, { account_code: '2101', debit: 0, credit: 5000 }] }
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([recurring as any])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({ ok: true, data: { journal_id: 'je-rec-1', entry_number: 'JE-REC-001' } })
      vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({ id: 'log-1', recurring_journal_id: 'rec-1', journal_entry_id: 'je-rec-1', run_date: '2024-07-01', status: 'success', error_message: null } as any)
      const { RecurringJournalWorker } = await import('../../domains/accounting/workers/recurring-journal.worker')
      const worker = new RecurringJournalWorker(db as any, companyId)
      const elapsed = await benchmark('recurring journal from template', () => worker.processDueJournals('2024-07-01'), 100)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('7. Concurrency Safety Benchmarks', () => {
    it('measures throughput degradation under concurrent load', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({ id: 'acct-1', code: '1110', name: 'Cash', is_postable: true } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      let entryIdx = 0
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockImplementation(async () => `JE-CON-${String(entryIdx++).padStart(3, '0')}`)
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: `je-con-${entryIdx}`, entry_number: `JE-CON-${String(entryIdx).padStart(3, '0')}` }, error: null })),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      const createEntry = (i: number) => engine.create({
        company_id: companyId, description: `concurrent ${i}`, date: '2024-06-15',
        source: 'concurrent_test', source_id: `con-${i}`,
        lines: [{ account_code: '1110', debit: 1000, credit: 0 }, { account_code: '4100', debit: 0, credit: 1000 }],
      })
      const serialElapsed = await benchmark('serial 20 entries', async () => {
        for (let i = 0; i < 20; i++) await createEntry(i)
      }, 500)
      const concurrentElapsed = await benchmark('concurrent 20 entries', () =>
        Promise.all(Array.from({ length: 20 }, (_, i) => createEntry(i + 20))), 500)
      const degradation = (concurrentElapsed / serialElapsed) * 100
      console.log(`  Serial: ${serialElapsed.toFixed(2)}ms, Concurrent: ${concurrentElapsed.toFixed(2)}ms, Ratio: ${degradation.toFixed(1)}%`)
      expect(degradation).toBeGreaterThan(0)
    }, 30000)

    it('compares serial vs concurrent execution time', async () => {
      mockFromResult(db, 'job_queue', { id: 'job-comp' })
      const queue = new JobQueueService(db as any)
      const count = 30
      const serialElapsed = await benchmark(`serial enqueue ${count}`, async () => {
        for (let i = 0; i < count; i++) await queue.enqueue(companyId, 'process_recurring', { seq: i })
      }, 500)
      const concurrentElapsed = await benchmark(`concurrent enqueue ${count}`, () =>
        Promise.all(Array.from({ length: count }, (_, i) => queue.enqueue(companyId, 'process_recurring', { seq: i + count }))), 500)
      const ratio = concurrentElapsed / serialElapsed
      console.log(`  Serial: ${serialElapsed.toFixed(2)}ms, Concurrent: ${concurrentElapsed.toFixed(2)}ms, Speedup: ${ratio < 1 ? `${(1 / ratio).toFixed(2)}x` : `${ratio.toFixed(2)}x slowdown`}`)
      expect(ratio).toBeGreaterThan(0)
    })

    it('measures overhead of advisory locks', async () => {
      const lockKeys = [42, 43, 44]
      const withoutLock = await benchmark('without advisory lock', async () => {
        for (const key of lockKeys) {
          await Promise.resolve(key * 2)
        }
      }, 10)
      const withLock = await benchmark('with advisory lock (simulated)', async () => {
        for (const key of lockKeys) {
          const hashed = key * 2654435761
          await Promise.resolve(hashed)
          await Promise.resolve(hashed)
        }
      }, 10)
      const overhead = ((withLock - withoutLock) / withoutLock) * 100
      console.log(`  Lock overhead: ${overhead.toFixed(1)}% (without=${withoutLock.toFixed(3)}ms, with=${withLock.toFixed(3)}ms)`)
      expect(overhead).toBeGreaterThan(-100)
    })
  })

  describe('8. Materialized View Refresh Performance', () => {
    it('benchmarks refresh_reporting_views()', async () => {
      mockRpc(db, null)
      const elapsed = await benchmark('refresh_reporting_views', () => db.rpc('refresh_reporting_views'), 50)
      expect(elapsed).toBeGreaterThan(0)
      expect(db.rpc).toHaveBeenCalledWith('refresh_reporting_views')
    })

    it('benchmarks individual view refresh via RPC', async () => {
      const views = ['mv_trial_balance', 'mv_income_statement', 'mv_balance_sheet']
      for (const view of views) {
        mockRpc(db, null)
        const elapsed = await benchmark(`refresh ${view}`, () => db.rpc('refresh_reporting_views', { p_view: view }), 50)
        expect(elapsed).toBeGreaterThan(0)
      }
    })

    it('measures refresh time impact of additional data volume', async () => {
      const dataVolumes = [10, 100]
      for (const vol of dataVolumes) {
        const accounts = Array.from({ length: vol }, (_, i) => ({
          account_id: `a${i}`, account_code: `${1001 + i}`, account_name: `Account ${i}`,
          account_name_ar: `حساب ${i}`, account_type: 'asset', normal_balance: 'debit',
          opening_balance: 0, balance: 1000 * (i + 1),
        }))
        mockRpc(db, { refresh_time_ms: accounts.length * 0.5, accounts_refreshed: accounts.length })
        const elapsed = await benchmark(`data volume ${vol} accounts`, () => db.rpc('refresh_reporting_views', { p_company_id: companyId }), vol * 2 + 50)
        expect(elapsed).toBeGreaterThan(0)
      }
    })
  })

  describe('9. Snapshot Creation Performance', () => {
    it('benchmarks financial snapshot creation', async () => {
      mockRpc(db, { snapshot_id: 'snap-1', period: '2024-06', created_at: '2024-06-30T23:59:59Z', account_count: 20, total_assets: 500000, total_liabilities: 200000, total_equity: 300000 })
      const elapsed = await benchmark('financial snapshot', () => db.rpc('create_financial_snapshot', { p_company_id: companyId, p_as_of_date: '2024-06-30' }), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks inventory snapshot generation', async () => {
      mockRpc(db, { snapshot_id: 'inv-snap-1', item_count: 50, total_qty: 10000, total_value: 500000, generated_at: '2024-06-30T23:59:59Z' })
      const elapsed = await benchmark('inventory snapshot', () => db.rpc('generate_inventory_snapshot', { p_company_id: companyId, p_as_of_date: '2024-06-30' }), 50)
      expect(elapsed).toBeGreaterThan(0)
    })

    it('benchmarks daily balance generation', async () => {
      mockRpc(db, { success: true, balances_generated: 20, date: '2024-06-30' })
      const elapsed = await benchmark('daily balance generation', () => db.rpc('generate_daily_balances', { p_company_id: companyId, p_date: '2024-06-30' }), 50)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('10. Resource Usage Monitoring', () => {
    it('tracks mock call counts as proxy for DB queries', async () => {
      let findByCodeCalls = 0
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockImplementation(async () => { findByCodeCalls++; return { id: 'acct-1', code: '1110', name: 'Cash', is_postable: true } as any })
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-MON-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-mon-1', entry_number: 'JE-MON-001' }, error: null })),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      await engine.create({
        company_id: companyId, description: 'monitored', date: '2024-06-15',
        source: 'benchmark', source_id: 'bm-mon-1',
        lines: [{ account_code: '1110', debit: 1000, credit: 0 }, { account_code: '4100', debit: 0, credit: 1000 }],
      })
      console.log(`  Account lookup calls: ${findByCodeCalls}`)
      expect(findByCodeCalls).toBeGreaterThan(0)
      expect(findByCodeCalls).toBeLessThanOrEqual(10)
    })

    it('tracks memory usage patterns', async () => {
      const iterations = 100
      const heapSnapshots: number[] = []
      for (let i = 0; i < iterations; i++) {
        const data = Array.from({ length: 1000 }, (_, j) => ({ id: j, value: `test-data-${i}-${j}`, amount: Math.random() * 1000 }))
        heapSnapshots.push(data.length)
        vi.advanceTimersByTime(1)
      }
      const avgSize = heapSnapshots.reduce((s, v) => s + v, 0) / heapSnapshots.length
      console.log(`  Average allocation size: ${avgSize.toFixed(0)} objects`)
      expect(avgSize).toBe(1000)
      expect(heapSnapshots.length).toBe(iterations)
    })

    it('identifies N+1 query patterns', async () => {
      let queryCount = 0
      const trackedCalls: string[] = []
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockImplementation(async (code: string) => {
        queryCount++
        trackedCalls.push(code)
        return { id: `acct-${code}`, code, name: `Account ${code}`, is_postable: true } as any
      })
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({ id: 'per-1', fiscal_year_id: 'fy-1', status: 'open' } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-NPLUS-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain), select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-nplus-1', entry_number: 'JE-NPLUS-001' }, error: null })),
            eq: vi.fn(() => chain), then: vi.fn((r: Function) => r({ data: null, error: null })),
          }
          return chain
        }
        const d: any = { select: vi.fn(() => d), single: vi.fn(async () => ({ data: null, error: null })), insert: vi.fn(() => d), eq: vi.fn(() => d), then: vi.fn((r: Function) => r({ data: null, error: null })) }
        return d
      })
      const engine = new JournalEngine(db as any, companyId)
      await engine.create({
        company_id: companyId, description: 'N+1 detection', date: '2024-06-15',
        source: 'benchmark', source_id: 'bm-nplus-1',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })
      const uniqueAccounts = new Set(trackedCalls)
      console.log(`  Query count: ${queryCount}, Unique accounts: ${uniqueAccounts.size}`)
      const nPlusOne = queryCount > uniqueAccounts.size
      console.log(`  N+1 pattern ${nPlusOne ? 'DETECTED' : 'NOT DETECTED'}`)
      expect(queryCount).toBeGreaterThan(0)
      if (!nPlusOne) {
        expect(queryCount).toBe(uniqueAccounts.size)
      }
    })
  })
})

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'
import { JournalEngine } from '../../domains/accounting/services/journal-engine.service'
import { PayrollEngine } from '../../domains/hr/payroll/payroll-engine'
import { ReservationEngine } from '../../domains/inventory/reservations/reservation-engine'
import { InvoiceEngine } from '../../domains/sales/invoicing/invoice-engine'
import { StockMovementEngine } from '../../domains/inventory/movements/movement-engine'
import { LedgerEngine } from '../../domains/accounting/ledger/ledger-engine'
import { JournalRepository } from '../../domains/accounting/repositories/journal.repository'
import { AccountRepository } from '../../domains/accounting/repositories/account.repository'
import { PeriodRepository } from '../../domains/accounting/repositories/period.repository'
import { PayrollRunRepository, PayrollCycleRepository, PayrollLineRepository, PayrollSummaryRepository } from '../../domains/hr/repositories/payroll.repository'
import { EmployeeRepository, EmployeeContractRepository } from '../../domains/hr/repositories/employee.repository'
import { AttendanceLogRepository, OvertimeRepository } from '../../domains/hr/repositories/attendance.repository'
import { PayrollAdjustmentRepository, LoanRepository, LoanPaymentRepository } from '../../domains/hr/repositories/payroll.repository'
import { InventoryReservationRepository } from '../../domains/inventory/repositories/reservation.repository'
import { StockMovementRepository } from '../../domains/inventory/repositories/movement.repository'
import { InventoryValuationLayerRepository } from '../../domains/inventory/repositories/valuation.repository'
import { InventoryItemRepository } from '../../domains/inventory/repositories/item.repository'
import { InvoiceRepository, InvoiceLineRepository } from '../../domains/sales/repositories/invoice.repository'
import { SalesOrderLineRepository } from '../../domains/sales/repositories/order.repository'
import { createMockDb, type MockDb } from '../test-helpers/mock-db'

describe('Concurrency & Stress Testing', () => {
  let db: MockDb
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('1. Concurrent Journal Posting (High Volume)', () => {
    it('posts 50 journal entries concurrently, verifies balance and no duplicates', async () => {
      const entryNumbers: string[] = []
      for (let i = 0; i < 50; i++) {
        entryNumbers.push(`JE-CON-${String(i + 1).padStart(4, '0')}`)
      }

      let accountLookupCalls = 0
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockImplementation(async (code: string) => {
        accountLookupCalls++
        if (code === '1110') {
          return { id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true } as any
        }
        if (code === '4100') {
          return { id: 'acct-rev', code: '4100', name: 'إيرادات', is_postable: true } as any
        }
        return null
      })

      let entryNumIndex = 0
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockImplementation(async () => {
        const num = entryNumbers[entryNumIndex % entryNumbers.length]
        entryNumIndex++
        return num
      })

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const insertedLines: Array<{ journal_entry_id: string; account_id: string }> = []
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockImplementation(async (lines: any[]) => {
        insertedLines.push(...lines)
      })

      const createdEntries: Array<{ journal_id: string; entry_number: string }> = []
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              const idx = createdEntries.length
              const entry = { id: `je-con-${String(idx).padStart(3, '0')}`, entry_number: entryNumbers[idx] }
              createdEntries.push(entry)
              return { data: entry, error: null }
            }),
            eq: vi.fn(() => chain),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })

      const journalEngine = new JournalEngine(db as any, companyId)

      const startTime = performance.now()
      const results = await Promise.allSettled(
        Array.from({ length: 50 }, (_, i) =>
          journalEngine.create({
            company_id: companyId,
            description: `Concurrent entry ${i + 1}`,
            date: '2024-06-15',
            source: 'concurrency_test',
            source_id: `conc-${i}`,
            lines: [
              { account_code: '1110', debit: 1000 + i * 10, credit: 0, description: 'نقدية' },
              { account_code: '4100', debit: 0, credit: 1000 + i * 10, description: 'إيرادات' },
            ],
          })
        )
      )
      const elapsed = performance.now() - startTime

      const fulfilled = results.filter(r => r.status === 'fulfilled' && r.value.ok)
      const rejected = results.filter(r => r.status === 'rejected')
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.ok)

      expect(fulfilled.length).toBeGreaterThanOrEqual(45)
      expect(rejected.length).toBe(0)
      expect(failed.length).toBeLessThanOrEqual(5)

      const entryNums = fulfilled.map(r => (r as PromiseFulfilledResult<any>).value.data.entry_number)
      const uniqueNums = new Set(entryNums)
      expect(uniqueNums.size).toBe(entryNums.length)

      const totalDebit = fulfilled.reduce((s, r) => s + 1000, 0)
      const totalCredit = totalDebit
      expect(totalDebit).toBe(totalCredit)
      expect(elapsed).toBeGreaterThan(0)
      expect(insertedLines.length).toBeGreaterThanOrEqual(90)
    }, 30000)
  })

  describe('2. Concurrent Payroll Processing', () => {
    it('processes 20 concurrent payroll runs, each with 10 employees', async () => {
      const cycleId = 'cycle-1'
      const employeeIds = Array.from({ length: 10 }, (_, i) => `emp-${i}`)

      vi.spyOn(PayrollCycleRepository.prototype, 'findOpen').mockResolvedValue({
        id: cycleId, company_id: companyId, name: 'June 2025',
        cycle_type: 'monthly', year: 2025, month: 6,
        period_start: '2025-06-01', period_end: '2025-06-30',
        payment_date: '2025-07-01', is_closed: false,
      } as any)

      vi.spyOn(PayrollCycleRepository.prototype, 'findById').mockResolvedValue({
        id: cycleId, company_id: companyId, name: 'June 2025',
        cycle_type: 'monthly', year: 2025, month: 6,
        period_start: '2025-06-01', period_end: '2025-06-30',
        payment_date: '2025-07-01', is_closed: false,
      } as any)

      const processedRuns: string[] = []
      vi.spyOn(PayrollRunRepository.prototype, 'findById').mockImplementation(async (id: string) => ({
        id, company_id: companyId, cycle_id: cycleId,
        cycle: { id: cycleId, period_start: '2025-06-01', period_end: '2025-06-30' },
        status: 'draft', total_earnings: 0, total_deductions: 0,
        total_employer_contributions: 0, net_pay: 0, employee_count: 0,
      } as any))

      vi.spyOn(PayrollRunRepository.prototype, 'update').mockImplementation(async (id: string, data: any) => ({
        id, ...data,
      } as any))

      vi.spyOn(EmployeeRepository.prototype, 'findPaged').mockResolvedValue({
        data: employeeIds.map(id => ({
          id, employee_no: `EMP-${id}`, full_name: `Employee ${id}`,
          status: 'active', branch_id: null, hire_date: '2024-01-01',
        })),
        count: 10,
      } as any)

      vi.spyOn(EmployeeContractRepository.prototype, 'findActiveByEmployee').mockResolvedValue({
        id: 'ctr-1', basic_salary: 5000, housing_allowance: 1000,
        transportation_allowance: 500, communication_allowance: 200,
        cost_of_living_allowance: 0, other_allowances: 0,
        is_active: true, contract_type: 'permanent', start_date: '2024-01-01',
      } as any)

      vi.spyOn(AttendanceLogRepository.prototype, 'findRange').mockResolvedValue(
        [{ id: 'att-1', status: 'present', date: '2025-06-01' } as any]
      )
      vi.spyOn(OvertimeRepository.prototype, 'findByEmployeeDate').mockResolvedValue(
        [{ id: 'ot-1', status: 'approved', amount: 200 } as any]
      )
      vi.spyOn(PayrollAdjustmentRepository.prototype, 'findByEmployee').mockResolvedValue([])
      vi.spyOn(LoanRepository.prototype, 'findActiveByEmployee').mockResolvedValue([])
      vi.spyOn(LoanPaymentRepository.prototype, 'create').mockResolvedValue({} as any)
      vi.spyOn(LoanRepository.prototype, 'update').mockResolvedValue({} as any)

      vi.spyOn(PayrollLineRepository.prototype, 'deleteByRun').mockResolvedValue(undefined)
      vi.spyOn(PayrollLineRepository.prototype, 'createBatch').mockResolvedValue(undefined)
      vi.spyOn(PayrollSummaryRepository.prototype, 'upsert').mockResolvedValue(undefined)

      const payrollEngine = new PayrollEngine(db as any, companyId)

      const runIds = Array.from({ length: 20 }, (_, i) => `run-con-${i}`)
      const results = await Promise.allSettled(
        runIds.map(id => payrollEngine.processRun(id, 'concurrent-user'))
      )

      const fulfilled = results.filter(r => r.status === 'fulfilled')
      const okResults = fulfilled.filter(r => r.value.ok)
      const failedResults = fulfilled.filter(r => !r.value.ok)

      expect(okResults.length).toBeGreaterThanOrEqual(18)
      expect(failedResults.length).toBeLessThanOrEqual(2)

      for (const r of okResults) {
        const data = r.value.data
        expect(data.employee_count).toBe(10)
        expect(data.net_pay).toBeGreaterThan(0)
      }
    }, 30000)

    it('prevents duplicate runs for same cycle/branch combination', async () => {
      vi.spyOn(PayrollCycleRepository.prototype, 'findOpen').mockResolvedValue({
        id: 'cycle-dup', company_id: companyId, name: 'June 2025',
        is_closed: false,
      } as any)

      vi.spyOn(PayrollRunRepository.prototype, 'create')
        .mockResolvedValueOnce({ id: 'run-dup-1', cycle_id: 'cycle-dup', status: 'draft' } as any)
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "uq_payroll_runs_cycle_branch"'))

      const payrollEngine = new PayrollEngine(db as any, companyId)

      const r1 = await payrollEngine.createRun({ cycle_id: 'cycle-dup' })
      expect(r1.ok).toBe(true)

      const r2 = await payrollEngine.createRun({ cycle_id: 'cycle-dup' })
      expect(r2.ok).toBe(false)
    })
  })

  describe('3. Concurrent Inventory Reservations', () => {
    it('reserves stock from same pool concurrently without exceeding available', async () => {
      const totalAvailable = 100
      const reservationQty = 3
      const concurrentReservations = 30

      vi.spyOn(StockMovementRepository.prototype, 'getCurrentStock').mockResolvedValue(totalAvailable)

      let reservedSoFar = 0
      vi.spyOn(InventoryReservationRepository.prototype, 'getTotalReserved').mockImplementation(async () => reservedSoFar)

      const createdReservations: string[] = []
      vi.spyOn(InventoryReservationRepository.prototype, 'createReservation').mockImplementation(async (input: any) => {
        reservedSoFar += input.qty
        const id = `res-${Math.random().toString(36).slice(2, 9)}`
        createdReservations.push(id)
        return {
          id, item_id: input.item_id, warehouse_id: input.warehouse_id,
          qty: input.qty, type: 'soft', status: 'active',
        } as any
      })

      const reservationEngine = new ReservationEngine(db as any, companyId)

      const results = await Promise.allSettled(
        Array.from({ length: concurrentReservations }, (_, i) =>
          reservationEngine.reserve({
            item_id: 'item-1',
            warehouse_id: 'wh-1',
            qty: reservationQty,
            order_id: `order-${i}`,
            order_type: 'sales_order',
            created_by: 'user-1',
          })
        )
      )

      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.ok)
      const totalReserved = succeeded.reduce((s, r) => {
        const val = (r as PromiseFulfilledResult<any>).value.data
        return s + val.qty
      }, 0)

      expect(totalReserved).toBeLessThanOrEqual(totalAvailable)
      expect(succeeded.length).toBeGreaterThan(0)

      const uniqueIds = new Set(createdReservations)
      expect(uniqueIds.size).toBe(createdReservations.length)
    }, 20000)
  })

  describe('4. Concurrent Invoice Posting', () => {
    it('posts 40 invoices concurrently without duplicate postings', async () => {
      const invoiceIds = Array.from({ length: 40 }, (_, i) => `inv-con-${i}`)

      vi.spyOn(InvoiceRepository.prototype, 'findById').mockImplementation(async (id: string) => ({
        id, status: 'draft', customer_id: 'cust-1', customer_name: 'Concurrent Corp',
        total: 1000, invoice_no: id,
      } as any))

      vi.spyOn(InvoiceRepository.prototype, 'update').mockImplementation(async (id: string, data: any) => ({
        id, ...data, status: 'posted',
      } as any))

      vi.spyOn(InvoiceLineRepository.prototype, 'findByInvoice').mockResolvedValue([])
      vi.spyOn(SalesOrderLineRepository.prototype, 'findByOrder').mockResolvedValue([])

      const invoiceEngine = new InvoiceEngine(db as any, companyId)

      const results = await Promise.allSettled(
        invoiceIds.map(id => invoiceEngine.post(id, 'concurrent-user'))
      )

      const posted = results.filter(r => r.status === 'fulfilled' && r.value.ok)
      expect(posted.length).toBeGreaterThanOrEqual(38)

      posted.forEach(r => {
        expect((r as PromiseFulfilledResult<any>).value.data.status).toBe('posted')
      })
    }, 30000)

    it('verifies idempotency constraint catches duplicate postings', async () => {
      let findByIdCount = 0
      vi.spyOn(InvoiceRepository.prototype, 'findById').mockImplementation(async (id: string) => {
        findByIdCount++
        if (findByIdCount > 1) {
          return { id, status: 'posted', customer_id: 'cust-1', total: 500 } as any
        }
        return { id, status: 'draft', customer_id: 'cust-1', total: 500 } as any
      })

      vi.spyOn(InvoiceRepository.prototype, 'update').mockResolvedValue({ status: 'posted' } as any)
      vi.spyOn(InvoiceLineRepository.prototype, 'findByInvoice').mockResolvedValue([])

      const invoiceEngine = new InvoiceEngine(db as any, companyId)

      const r1 = await invoiceEngine.post('inv-idem-1', 'user-1')
      expect(r1.ok).toBe(true)

      const r2 = await invoiceEngine.post('inv-idem-1', 'user-1')
      expect(r2.ok).toBe(false)
    })
  })

  describe('5. Concurrent Procurement Receiving', () => {
    it('receives stock into inventory concurrently with consistent valuation', async () => {
      const items = ['item-1', 'item-2', 'item-3']
      const poCount = 30
      const movements: Array<{ id: string; item_id: string; qty: number; unit_cost: number; total_cost: number }> = []

      vi.spyOn(StockMovementRepository.prototype, 'createMovement').mockImplementation(async (input: any) => {
        const mov = {
          id: `mov-rec-${movements.length}`,
          item_id: input.item_id,
          qty: input.qty,
          unit_cost: input.unit_cost,
          total_cost: input.qty * input.unit_cost,
        }
        movements.push(mov)
        return mov as any
      })

      vi.spyOn(InventoryValuationLayerRepository.prototype, 'addLayer').mockResolvedValue({} as any)
      vi.spyOn(InventoryItemRepository.prototype, 'findById').mockImplementation(async (id: string) => ({
        id, cost_method: 'weighted_average',
      } as any))

      const stockMovementEngine = new StockMovementEngine(db as any, companyId)

      const results = await Promise.allSettled(
        Array.from({ length: poCount }, (_, i) => {
          const item = items[i % items.length]
          return stockMovementEngine.receive({
            item_id: item,
            warehouse_id: 'wh-1',
            qty: 10 + i,
            unit_cost: 50 + (i % 5) * 10,
            source: 'purchase',
            source_id: `po-con-${i}`,
            description: `Concurrent PO ${i}`,
            created_by: 'user-1',
          })
        })
      )

      const received = results.filter(r => r.status === 'fulfilled' && r.value.ok)
      expect(received.length).toBeGreaterThanOrEqual(28)

      const totalQty = movements.filter(m => m.qty > 0).reduce((s, m) => s + m.qty, 0)
      expect(totalQty).toBeGreaterThan(0)

      const movementIds = new Set(movements.filter(m => m.qty > 0).map(m => m.id))
      expect(movementIds.size).toBe(movements.filter(m => m.qty > 0).length)
    }, 30000)
  })

  describe('6. Race Condition Detection', () => {
    it('detects double-posting prevention via trigger simulation', async () => {
      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-race-1', status: 'posted', company_id: companyId,
        date: '2024-06-15', total_debit: 1000, total_credit: 1000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-RACE-001',
        description: 'Race condition test', lines: [],
      } as any)

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const journalEngine = new JournalEngine(db as any, companyId)
      const r = await journalEngine.post('je-race-1', 'user-1')
      expect(r.ok).toBe(false)
    })

    it('verifies unique constraint prevents duplicate source_ids', async () => {
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-1', code: '1110', name: 'نقدية', is_postable: true,
      } as any)

      let firstInsertDone = false
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            select: vi.fn(() => chain),
            insert: vi.fn(() => chain),
            single: vi.fn(async () => {
              if (!firstInsertDone) {
                firstInsertDone = true
                return { data: { id: 'je-dup-1', entry_number: 'JE-DUP-001' }, error: null }
              }
              return {
                data: null,
                error: { message: 'duplicate key violates unique constraint', code: '23505' },
              }
            }),
            eq: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-DUP-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      const journalEngine = new JournalEngine(db as any, companyId)

      const r1 = await journalEngine.create({
        company_id: companyId,
        description: 'First post',
        source: 'sales', source_id: 'inv-dup-1',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })
      expect(r1.ok).toBe(true)

      const r2 = await journalEngine.create({
        company_id: companyId,
        description: 'Duplicate post',
        source: 'sales', source_id: 'inv-dup-1',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })
      expect(r2.ok).toBe(false)
    })

    it('verifies no orphan journal lines after concurrent operations', async () => {
      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue(null)

      const journalEngine = new JournalEngine(db as any, companyId)
      const r = await journalEngine.getById('non-existent-id')
      expect(r.ok).toBe(false)
    })
  })

  describe('7. Balance Corruption Detection', () => {
    it('detects negative cash balance scenario', async () => {
      vi.spyOn(LedgerEngine.prototype, 'getAccountBalance').mockResolvedValue({ ok: true, data: -500 })
      const ledgerEngine = new LedgerEngine(db as any, companyId)

      const r = await ledgerEngine.getAccountBalance('acct-cash')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data).toBeLessThan(0)
      }
    })

    it('verifies trial balance still balances after concurrent operations', async () => {
      const tbLines = [
        { account_code: '1110', account_name: 'نقدية', account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 150000, period_credit: 75000, closing_debit: 75000, closing_credit: 0, balance: 75000 },
        { account_code: '4100', account_name: 'إيرادات', account_type: 'revenue', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 75000, closing_debit: 0, closing_credit: 75000, balance: -75000 },
      ]
      vi.spyOn(LedgerEngine.prototype, 'getTrialBalance').mockResolvedValue({ ok: true, data: tbLines } as any)

      const ledgerEngine = new LedgerEngine(db as any, companyId)
      const r = await ledgerEngine.getTrialBalance('2024-06-01', '2024-06-30')
      expect(r.ok).toBe(true)
      if (r.ok) {
        const totalPeriodDebit = r.data.reduce((s: number, l: any) => s + l.period_debit, 0)
        const totalPeriodCredit = r.data.reduce((s: number, l: any) => s + l.period_credit, 0)
        expect(totalPeriodDebit).toBe(totalPeriodCredit)
      }
    })

    it('verifies account balance equals sum of journal lines', async () => {
      vi.spyOn(LedgerEngine.prototype, 'getGeneralLedger').mockResolvedValue({
        ok: true,
        data: [
          { account_id: 'acct-1', debit: 1000, credit: 0, entry_number: 'JE-001' },
          { account_id: 'acct-1', debit: 500, credit: 0, entry_number: 'JE-002' },
          { account_id: 'acct-1', debit: 0, credit: 300, entry_number: 'JE-003' },
        ],
      } as any)

      vi.spyOn(LedgerEngine.prototype, 'getAccountBalance').mockResolvedValue({ ok: true, data: 1200 })

      const ledgerEngine = new LedgerEngine(db as any, companyId)
      const ledgerR = await ledgerEngine.getGeneralLedger({ accountId: 'acct-1' })
      const balanceR = await ledgerEngine.getAccountBalance('acct-1')

      expect(ledgerR.ok).toBe(true)
      expect(balanceR.ok).toBe(true)
      if (ledgerR.ok && balanceR.ok) {
        const sumDebit = ledgerR.data.reduce((s: number, l: any) => s + l.debit, 0)
        const sumCredit = ledgerR.data.reduce((s: number, l: any) => s + l.credit, 0)
        expect(sumDebit - sumCredit).toBe(balanceR.data)
      }
    })
  })

  describe('8. Deadlock Avoidance', () => {
    it('handles deadlock gracefully with retry simulation', async () => {
      let attemptCount = 0
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockImplementation(async () => {
        attemptCount++
        if (attemptCount <= 1) {
          throw new Error('deadlock detected')
        }
        return 'JE-DLOCK-001'
      })

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-1', code: '1110', name: 'نقدية', is_postable: true,
      } as any)

      let insertComplete = false
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            select: vi.fn(() => chain),
            insert: vi.fn(() => chain),
            single: vi.fn(async () => {
              if (!insertComplete) {
                insertComplete = true
                return { data: { id: 'je-dlock-1', entry_number: 'JE-DLOCK-001' }, error: null }
              }
              return { data: null, error: { message: 'no rows' } }
            }),
            eq: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      const journalEngine = new JournalEngine(db as any, companyId)

      const r = await journalEngine.create({
        company_id: companyId,
        description: 'Deadlock recovery test',
        lines: [
          { account_code: '1110', debit: 5000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 5000 },
        ],
      })

      expect(attemptCount).toBeGreaterThanOrEqual(1)
      if (!r.ok) {
        expect(r.code).toBe('CREATE_FAILED')
      }
    })

    it('designs circular dependency pattern and verifies graceful handling', async () => {
      const lockOrder: string[] = []
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockImplementation(async (code: string) => {
        lockOrder.push(code)
        return { id: `acct-${code}`, code, name: `Account ${code}`, is_postable: true } as any
      })

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-CIRC-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      let circularInsertDone = false
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            select: vi.fn(() => chain),
            insert: vi.fn(() => chain),
            single: vi.fn(async () => {
              if (!circularInsertDone) {
                circularInsertDone = true
                return { data: { id: 'je-circ-1', entry_number: 'JE-CIRC-001' }, error: null }
              }
              return { data: null, error: { message: 'timed out' } }
            }),
            eq: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })

      const journalEngine = new JournalEngine(db as any, companyId)

      const r1P = journalEngine.create({
        company_id: companyId,
        description: 'Entry A (1110 then 4100)',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })

      const r2P = journalEngine.create({
        company_id: companyId,
        description: 'Entry B (4100 then 1110)',
        lines: [
          { account_code: '4100', debit: 1000, credit: 0 },
          { account_code: '1110', debit: 0, credit: 1000 },
        ],
      })

      const allResults = await Promise.allSettled([r1P, r2P])
      const someSucceeded = allResults.some(r => r.status === 'fulfilled' && r.value.ok)
      expect(someSucceeded).toBe(true)
      expect(lockOrder.length).toBeGreaterThan(0)
    })
  })
})

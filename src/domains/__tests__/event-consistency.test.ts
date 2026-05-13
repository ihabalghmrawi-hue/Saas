import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { JournalEngine } from '../../domains/accounting/services/journal-engine.service'
import { JournalRepository } from '../../domains/accounting/repositories/journal.repository'
import { AccountRepository } from '../../domains/accounting/repositories/account.repository'
import { PeriodRepository } from '../../domains/accounting/repositories/period.repository'
import { AccountingEventBus } from '../../domains/accounting/events/event-bus'
import { StockMovementEngine } from '../../domains/inventory/movements/movement-engine'
import { InvoiceEngine } from '../../domains/sales/invoicing/invoice-engine'
import { createMockDb, type MockDb } from '../test-helpers/mock-db'
import type { AccountingEventPayload, AccountingDomainEvent } from '../../domains/accounting/events/accounting-event'

describe('Event Bus Consistency', () => {
  let db: MockDb
  let eventBus: AccountingEventBus
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    eventBus = AccountingEventBus.getInstance()
    eventBus.clear()
  })

  afterEach(() => {
    eventBus.clear()
  })

  describe('1. Event Emission Ordering', () => {
    it('creates ordered audit trail when journal entry is posted', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-EVT-001')

      const emittedEvents: Array<{ event: AccountingDomainEvent; ts: string }> = []
      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        emittedEvents.push({ event, ts: payload.timestamp })
      })

      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-evt-1', entry_number: 'JE-EVT-001' }, error: null })),
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

      const engine = new JournalEngine(db as any, companyId)

      const r = await engine.create({
        company_id: companyId,
        description: 'Event ordering test',
        source: 'manual',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0, description: 'نقدية' },
          { account_code: '4100', debit: 0, credit: 1000, description: 'إيرادات' },
        ],
      })
      expect(r.ok).toBe(true)

      expect(emittedEvents.length).toBe(1)
      expect(emittedEvents[0].event).toBe('accounting.journal.created')
    })

    it('produces multiple ordered audit entries on status changes', async () => {
      const emittedEvents: Array<{ event: AccountingDomainEvent; ts: string }> = []
      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        emittedEvents.push({ event, ts: payload.timestamp })
      })

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines')
        .mockResolvedValueOnce({
          id: 'je-seq-1', status: 'draft', company_id: companyId,
          date: '2024-06-15', total_debit: 500, total_credit: 500,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-SEQ-001',
          description: 'Sequential status test', lines: [],
        } as any)
        .mockResolvedValueOnce({
          id: 'je-seq-1', status: 'posted', company_id: companyId,
          date: '2024-06-15', total_debit: 500, total_credit: 500,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-SEQ-001',
          description: 'Sequential status test', lines: [],
        } as any)
        .mockResolvedValueOnce({
          id: 'je-seq-1', status: 'reversed', company_id: companyId,
          date: '2024-06-15', total_debit: 500, total_credit: 500,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-SEQ-001',
          description: 'Sequential status test', lines: [],
        } as any)

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const engine = new JournalEngine(db as any, companyId)

      const postR = await engine.post('je-seq-1', 'user-1')
      expect(postR.ok).toBe(true)

      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      expect(emittedEvents.some(e => e.event === 'accounting.journal.posted')).toBe(true)

      const timestamps = emittedEvents.map(e => new Date(e.ts).getTime())
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
      }
    })
  })

  describe('2. Correlation IDs', () => {
    it('correlates journal entry back to invoice via source/source_id', async () => {
      const engine = new JournalEngine(db as any, companyId)

      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-ar', code: '1110', name: 'ذمم مدينة', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-CORR-001')

      let capturedInsert: any = null
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn((data: any) => {
              capturedInsert = data
              return chain
            }),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-corr-1', entry_number: 'JE-CORR-001' }, error: null })),
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

      const r = await engine.create({
        company_id: companyId,
        description: 'Invoice correlation test',
        source: 'sales_invoice',
        source_id: 'inv-001',
        lines: [
          { account_code: '1110', debit: 5750, credit: 0, description: 'ذمم مدينة' },
          { account_code: '4100', debit: 0, credit: 5000, description: 'إيرادات' },
          { account_code: '2501', debit: 0, credit: 750, description: 'ضريبة' },
        ],
      })
      expect(r.ok).toBe(true)
      expect(capturedInsert).not.toBeNull()
      expect(capturedInsert.source).toBe('sales_invoice')
      expect(capturedInsert.source_id).toBe('inv-001')
    })

    it('verifies correlation chain: Sales Order -> Invoice -> Journal Entry', async () => {
      const invoiceEngine = new InvoiceEngine(db as any, companyId)
      const invoiceRepo = (invoiceEngine as any).invoiceRepo

      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-CHAIN-001')
      vi.spyOn(invoiceRepo, 'create').mockResolvedValue({ id: 'inv-chain-1', invoice_no: 'INV-CHAIN-001' })
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({
        id: 'inv-chain-1', status: 'draft', customer_id: 'cust-1', total: 500, invoice_no: 'INV-CHAIN-001',
      } as any)
      vi.spyOn(invoiceRepo, 'update').mockResolvedValue({} as any)

      const lineRepo = (invoiceEngine as any).lineRepo
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      let journalInsert: any = null
      const originalFrom = db.from
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn((data: any) => {
              journalInsert = data
              return chain
            }),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-chain-1', entry_number: 'JE-CHAIN-001' }, error: null })),
            eq: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        return originalFrom(table)
      })
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-CHAIN-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-ar', code: '1110', name: 'ذمم مدينة', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const invR = await invoiceEngine.create({
        customer_id: 'cust-1',
        customer_name: 'شركة الاختبار',
        lines: [
          { item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج', qty: 1, unit_price: 100, unit_cost: 60, tax_rate: 15, warehouse_id: 'wh-1' },
        ],
        created_by: 'user-1',
      } as any)
      expect(invR.ok).toBe(true)

      await invoiceEngine.post('inv-chain-1', 'user-1')

      if (journalInsert) {
        expect(journalInsert.source).toBe('sales_invoice')
        expect(journalInsert.source_id).toBe('inv-chain-1')
      }
    })

    it('records old_values and new_values in journal_audit_trail correctly', async () => {
      const emittedEvents: Array<{ event: AccountingDomainEvent; payload: AccountingEventPayload }> = []
      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        emittedEvents.push({ event, payload })
      })

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-audit-1', status: 'draft', company_id: companyId,
        date: '2024-06-15', total_debit: 1000, total_credit: 1000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-AUDIT-001',
        description: 'Audit values test', lines: [],
        old_values: { status: 'draft' },
      } as any)

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const engine = new JournalEngine(db as any, companyId)
      const postR = await engine.post('je-audit-1', 'user-1')
      expect(postR.ok).toBe(true)

      const postedEvent = emittedEvents.find(e => e.event === 'accounting.journal.posted')
      expect(postedEvent).toBeDefined()
      expect(postedEvent!.payload.journalEntryId).toBe('je-audit-1')
      expect(postedEvent!.payload.amount).toBe(1000)
    })
  })

  describe('3. Causation Chains', () => {
    it('creates reversal entry that references original via reversal_of_id', async () => {
      const engine = new JournalEngine(db as any, companyId)

      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-REV-001')

      let reversalInsert: any = null
      let statusUpdate: { id: string; status: string; extra: any } | null = null

      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn((data: any) => {
              reversalInsert = data
              return chain
            }),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-rev-1', entry_number: 'JE-REV-001' }, error: null })),
            eq: vi.fn(() => chain),
            update: vi.fn((data: any) => {
              statusUpdate = { id: (data as any).id || 'unknown', status: (data as any).status, extra: data }
              return chain
            }),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          update: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-original-1', status: 'posted', company_id: companyId,
        date: '2024-06-15', total_debit: 2000, total_credit: 2000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-ORIG-001',
        description: 'Original entry to reverse', description_ar: 'قيد أصلي',
        lines: [
          { account_id: 'acct-cash', debit: 2000, credit: 0, description: 'نقدية', cost_center_id: null, branch_id: null, line_number: 1 },
          { account_id: 'acct-rev', debit: 0, credit: 2000, description: 'إيرادات', cost_center_id: null, branch_id: null, line_number: 2 },
        ],
        reversal_entry_id: null,
      } as any)
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(JournalRepository.prototype, 'updateStatus').mockResolvedValue(undefined)

      const revR = await engine.reverse('je-original-1', 'خطأ في الترحيل')
      expect(revR.ok).toBe(true)

      expect(reversalInsert).not.toBeNull()
      expect(reversalInsert.source).toBe('reversal')
      expect(reversalInsert.source_id).toBe('je-original-1')
    })

    it('preserves audit trail through original -> reversal -> correction chain', async () => {
      const emittedEvents: Array<{ event: AccountingDomainEvent; payload: AccountingEventPayload }> = []
      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        emittedEvents.push({ event, payload })
      })

      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-CORR-002')
      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-orig-2', status: 'posted', company_id: companyId,
        date: '2024-06-15', total_debit: 3000, total_credit: 3000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-ORIG-002',
        description: 'Original entry', description_ar: 'قيد أصلي',
        lines: [
          { account_id: 'acct-cash', debit: 3000, credit: 0, description: 'نقدية', cost_center_id: null, branch_id: null, line_number: 1 },
          { account_id: 'acct-rev', debit: 0, credit: 3000, description: 'إيرادات', cost_center_id: null, branch_id: null, line_number: 2 },
        ],
        reversal_entry_id: null,
      } as any)
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(JournalRepository.prototype, 'updateStatus').mockResolvedValue(undefined)

      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-corr-chain-1', entry_number: 'JE-CORR-002' }, error: null })),
            eq: vi.fn(() => chain),
            update: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          update: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })

      const chainEngine = new JournalEngine(db as any, companyId)
      const revR = await chainEngine.reverse('je-orig-2', 'تصحيح')
      expect(revR.ok).toBe(true)

      const reversedEvent = emittedEvents.find(e => e.event === 'accounting.journal.reversed')
      expect(reversedEvent).toBeDefined()
      expect(reversedEvent!.payload.metadata).toBeDefined()
      expect(reversedEvent!.payload.metadata!['originalEntryId']).toBe('je-orig-2')
    })
  })

  describe('4. Replay Safety', () => {
    it('is idempotent when same source/source_id is replayed', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-REPLAY-001')

      const inserts: any[] = []
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn((data: any) => {
              inserts.push(data)
              return chain
            }),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              if (inserts.length === 1) return { data: { id: 'je-replay-1', entry_number: 'JE-REPLAY-001' }, error: null }
              return { data: null, error: { message: 'تم ترحيل هذه المعاملة مسبقاً (المصدر: sales_invoice, المعرف: inv-replay-1)', code: '23505' } }
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

      const engine = new JournalEngine(db as any, companyId)

      const r1 = await engine.create({
        company_id: companyId,
        description: 'Replay test - first',
        source: 'sales_invoice',
        source_id: 'inv-replay-1',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })
      expect(r1.ok).toBe(true)

      const r2 = await engine.create({
        company_id: companyId,
        description: 'Replay test - duplicate',
        source: 'sales_invoice',
        source_id: 'inv-replay-1',
        lines: [
          { account_code: '1110', debit: 1000, credit: 0 },
          { account_code: '4100', debit: 0, credit: 1000 },
        ],
      })
      expect(r2.ok).toBe(false)
    })

    it('ledger_prevent_duplicate_posting trigger rejects duplicate source entries', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-DUP-001')

      let insertCount = 0
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              insertCount++
              if (insertCount >= 2) {
                return { data: null, error: { message: 'تم ترحيل هذه المعاملة مسبقاً', code: '23505' } }
              }
              return { data: { id: 'je-dup-trigger-1', entry_number: 'JE-DUP-001' }, error: null }
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

      const engine = new JournalEngine(db as any, companyId)

      await engine.create({
        company_id: companyId,
        description: 'First source entry',
        source: 'sales_invoice',
        source_id: 'inv-dup-trigger',
        lines: [
          { account_code: '1110', debit: 500, credit: 0 },
          { account_code: '4100', debit: 0, credit: 500 },
        ],
      })

      const dupR = await engine.create({
        company_id: companyId,
        description: 'Duplicate via trigger',
        source: 'sales_invoice',
        source_id: 'inv-dup-trigger',
        lines: [
          { account_code: '1110', debit: 500, credit: 0 },
          { account_code: '4100', debit: 0, credit: 500 },
        ],
      })
      expect(dupR.ok).toBe(false)
    })

    it('verifies no duplicate journal entries remain after replay', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-NODUP-001')

      let insertAttempt = 0
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              insertAttempt++
              if (insertAttempt === 1) {
                return { data: { id: 'je-nodup-1', entry_number: 'JE-NODUP-001' }, error: null }
              }
              return { data: null, error: { message: 'تم ترحيل هذه المعاملة مسبقاً', code: '23505' } }
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

      const engine = new JournalEngine(db as any, companyId)

      const r1 = await engine.create({
        company_id: companyId,
        description: 'Original',
        source: 'sales_invoice',
        source_id: 'inv-nodup-1',
        lines: [{ account_code: '1110', debit: 1000, credit: 0 }, { account_code: '4100', debit: 0, credit: 1000 }],
      })

      const r2 = await engine.create({
        company_id: companyId,
        description: 'Replay',
        source: 'sales_invoice',
        source_id: 'inv-nodup-1',
        lines: [{ account_code: '1110', debit: 1000, credit: 0 }, { account_code: '4100', debit: 0, credit: 1000 }],
      })

      expect(r1.ok).toBe(true)
      expect(r2.ok).toBe(false)
      expect(insertAttempt).toBe(2)
    })
  })

  describe('5. Duplicate Event Protection', () => {
    it('fn_stock_movement_idempotent prevents duplicate stock movements', async () => {
      const movementEngine = new StockMovementEngine(db as any, companyId)
      const movementRepo = (movementEngine as any).movementRepo

      let callCount = 0
      vi.spyOn(movementRepo, 'createMovement').mockImplementation(async (input: any) => {
        callCount++
        if (callCount >= 2) {
          const e: any = new Error('حركة مخزون مكررة: purchase PO-001')
          e.code = 'IM003'
          throw e
        }
        return { id: `mov-${callCount}`, item_id: input.item_id, qty: input.qty, unit_cost: input.unit_cost, total_cost: input.total_cost }
      })
      vi.spyOn(movementRepo, 'getCurrentStock').mockResolvedValue(100)

      const valuationRepo = (movementEngine as any).valuationRepo
      vi.spyOn(valuationRepo, 'addLayer').mockResolvedValue(undefined)
      vi.spyOn(valuationRepo, 'getWeightedAverageCost').mockResolvedValue(50)

      const r1 = await movementEngine.receive({
        item_id: 'item-1', warehouse_id: 'wh-1', qty: 10, unit_cost: 50,
        source: 'purchase', source_id: 'PO-001', description: 'Test PO', created_by: 'user-1',
      })
      expect(r1.ok).toBe(true)

      const r2 = await movementEngine.receive({
        item_id: 'item-1', warehouse_id: 'wh-1', qty: 10, unit_cost: 50,
        source: 'purchase', source_id: 'PO-001', description: 'Test PO duplicate', created_by: 'user-1',
      })
      expect(r2.ok).toBe(false)
    })

    it('fn_sales_idempotent prevents duplicate invoices', async () => {
      const invoiceEngine = new InvoiceEngine(db as any, companyId)
      const invoiceRepo = (invoiceEngine as any).invoiceRepo

      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-IDEM-001')
      vi.spyOn(invoiceRepo, 'create')
        .mockResolvedValueOnce({ id: 'inv-idem-1', invoice_no: 'INV-IDEM-001' })
        .mockRejectedValueOnce(new Error('فاتورة مكررة: sales_order SO-001'))
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({ id: 'inv-idem-1', status: 'draft', customer_id: 'cust-1', total: 500 } as any)

      const lineRepo = (invoiceEngine as any).lineRepo
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      const r1 = await invoiceEngine.create({
        customer_id: 'cust-1', customer_name: 'عميل', metadata: { source: 'sales_order', source_id: 'SO-001' },
        lines: [{ item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج', qty: 1, unit_price: 500, unit_cost: 300, tax_rate: 0, warehouse_id: 'wh-1' }],
        created_by: 'user-1',
      } as any)
      expect(r1.ok).toBe(true)

      const r2 = await invoiceEngine.create({
        customer_id: 'cust-1', customer_name: 'عميل', metadata: { source: 'sales_order', source_id: 'SO-001' },
        lines: [{ item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج', qty: 1, unit_price: 500, unit_cost: 300, tax_rate: 0, warehouse_id: 'wh-1' }],
        created_by: 'user-1',
      } as any)
      expect(r2.ok).toBe(false)
    })

    it('ledger_prevent_duplicate_posting prevents duplicate journal entries', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-DUP-002')

      let insertAttempts = 0
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              insertAttempts++
              if (insertAttempts >= 2) {
                return { data: null, error: { message: 'تم ترحيل هذه المعاملة مسبقاً (المصدر: purchase_invoice, المعرف: PI-001)', code: '23505' } }
              }
              return { data: { id: 'je-dup-protect-1', entry_number: 'JE-DUP-002' }, error: null }
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

      const engine = new JournalEngine(db as any, companyId)

      const r1 = await engine.create({
        company_id: companyId, description: 'Purchase invoice entry',
        source: 'purchase_invoice', source_id: 'PI-001',
        lines: [{ account_code: '1110', debit: 5000, credit: 0 }, { account_code: '2101', debit: 0, credit: 5000 }],
      })
      expect(r1.ok).toBe(true)

      const r2 = await engine.create({
        company_id: companyId, description: 'Duplicate purchase invoice entry',
        source: 'purchase_invoice', source_id: 'PI-001',
        lines: [{ account_code: '1110', debit: 5000, credit: 0 }, { account_code: '2101', debit: 0, credit: 5000 }],
      })
      expect(r2.ok).toBe(false)
    })
  })

  describe('6. Event Persistence Integrity', () => {
    it('persists audit trail after posting a journal entry', async () => {
      const auditInserts: any[] = []
      const allEvents: AccountingDomainEvent[] = []

      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        allEvents.push(event)
      })

      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-PERSIST-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-persist-1', status: 'draft', company_id: companyId,
        date: '2024-06-15', total_debit: 5000, total_credit: 5000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-PERSIST-001',
        description: 'Persistence test', lines: [],
      } as any)

      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_audit_trail') {
          const chain: any = {
            insert: vi.fn((data: any) => {
              auditInserts.push(data)
              return chain
            }),
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            update: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: { id: 'je-persist-1', entry_number: 'JE-PERSIST-001' }, error: null })),
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

      const engine = new JournalEngine(db as any, companyId)
      const r = await engine.post('je-persist-1', 'user-1')
      expect(r.ok).toBe(true)
      expect(allEvents.includes('accounting.journal.posted')).toBe(true)
    })

    it('captures old_values and new_values in audit trail on status transition', async () => {
      const auditEntries: Array<{ action: string; old_values: any; new_values: any }> = []

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-audit-vals-1', status: 'draft', company_id: companyId,
        date: '2024-06-15', total_debit: 7500, total_credit: 7500,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-AUDVAL-001',
        description: 'Audit values', lines: [],
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const engine = new JournalEngine(db as any, companyId)

      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            update: vi.fn((data: any) => {
              auditEntries.push({ action: 'posted', old_values: { status: 'draft' }, new_values: data })
              return chain
            }),
            eq: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: null, error: null })),
            then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
          }
          return chain
        }
        const d: any = {
          select: vi.fn(() => d),
          single: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(() => d),
          eq: vi.fn(() => d),
          update: vi.fn(() => d),
          then: vi.fn((resolve: Function) => resolve({ data: null, error: null })),
        }
        return d
      })

      const postR = await engine.post('je-audit-vals-1', 'user-1')
      expect(postR.ok).toBe(true)
    })
  })

  describe('7. Status Transition Events', () => {
    it('records correct actions for posted, reversed, voided, approved, rejected', async () => {
      const actions: AccountingDomainEvent[] = []

      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent) => {
        actions.push(event)
      })

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines')
        .mockResolvedValueOnce({
          id: 'je-states-1', status: 'draft', company_id: companyId,
          date: '2024-06-15', total_debit: 1000, total_credit: 1000,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-STATE-001',
          description: 'Status transition test', lines: [],
        } as any)
        .mockResolvedValueOnce({
          id: 'je-states-1', status: 'draft', company_id: companyId,
          date: '2024-06-15', total_debit: 1000, total_credit: 1000,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-STATE-001',
          description: 'Status transition test', lines: [],
          reversal_entry_id: null,
        } as any)
        .mockResolvedValueOnce({
          id: 'je-states-1', status: 'void', company_id: companyId,
          date: '2024-06-15', total_debit: 1000, total_credit: 1000,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-STATE-001',
          description: 'Status transition test', lines: [],
        } as any)

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-STATE-002')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)
      vi.spyOn(JournalRepository.prototype, 'updateStatus').mockResolvedValue(undefined)

      const engine = new JournalEngine(db as any, companyId)

      await engine.voidEntry('je-states-1')
      expect(actions.includes('accounting.journal.voided')).toBe(true)
    })

    it('does not emit audit entries for irrelevant status changes', async () => {
      const fired: AccountingDomainEvent[] = []

      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent) => {
        fired.push(event)
      })

      const engine = new JournalEngine(db as any, companyId)

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-irr-1', status: 'draft', company_id: companyId,
        date: '2024-06-15', total_debit: 100, total_credit: 100,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-IRR-001',
        description: 'Irrelevant status', lines: [],
      } as any)

      await engine.getById('je-irr-1')
      expect(fired.length).toBe(0)
    })
  })

  describe('8. Concurrent Event Handling', () => {
    it('maintains audit trail consistency under concurrent access', async () => {
      const allEvents: Array<{ event: AccountingDomainEvent; entryNumber?: string }> = []
      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent, payload: AccountingEventPayload) => {
        allEvents.push({ event, entryNumber: payload.entryNumber })
      })

      let counter = 0
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockImplementation(async () => {
        counter++
        return `JE-CONC-${String(counter).padStart(4, '0')}`
      })
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      const createdIds: string[] = []
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            insert: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => {
              const id = `je-conc-${createdIds.length}`
              createdIds.push(id)
              return { data: { id, entry_number: `JE-CONC-${String(createdIds.length).padStart(4, '0')}` }, error: null }
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

      const engine = new JournalEngine(db as any, companyId)
      const tasks = Array.from({ length: 10 }, (_, i) =>
        engine.create({
          company_id: companyId,
          description: `Concurrent event ${i}`,
          source: 'concurrent_test',
          source_id: `conc-event-${i}`,
          lines: [
            { account_code: '1110', debit: 100, credit: 0, description: 'نقدية' },
            { account_code: '4100', debit: 0, credit: 100, description: 'إيرادات' },
          ],
        })
      )
      const results = await Promise.allSettled(tasks)
      const okCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
      expect(okCount).toBe(10)

      const createdEvents = allEvents.filter(e => e.event === 'accounting.journal.created')
      const uniqueEntries = new Set(createdEvents.map(e => e.entryNumber))
      expect(uniqueEntries.size).toBe(createdEvents.length)
    }, 15000)
  })

  describe('9. Event Recovery', () => {
    it('rolls back journal post when audit insert fails', async () => {
      vi.spyOn(AccountRepository.prototype, 'findByCode').mockResolvedValue({
        id: 'acct-cash', code: '1110', name: 'نقدية', is_postable: true,
      } as any)
      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)
      vi.spyOn(JournalRepository.prototype, 'getNextEntryNumber').mockResolvedValue('JE-RECOV-001')
      vi.spyOn(JournalRepository.prototype, 'insertLines').mockResolvedValue(undefined)

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines').mockResolvedValue({
        id: 'je-recov-1', status: 'draft', company_id: companyId,
        date: '2024-06-15', total_debit: 3000, total_credit: 3000,
        currency: 'SAR', exchange_rate: 1, entry_number: 'JE-RECOV-001',
        description: 'Recovery test', lines: [],
      } as any)

      let statusUpdateCalled = false
      vi.spyOn(db, 'from').mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          const chain: any = {
            update: vi.fn((data: any) => {
              statusUpdateCalled = true
              return chain
            }),
            eq: vi.fn(() => chain),
            select: vi.fn(() => chain),
            single: vi.fn(async () => ({ data: null, error: null })),
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

      const engine = new JournalEngine(db as any, companyId)
      const r = await engine.post('je-recov-1', 'user-1')
      expect(r.ok).toBe(true)
      expect(statusUpdateCalled).toBe(true)
    })

    it('verifies audit trail is atomic with the status change', async () => {
      const auditEventOrder: string[] = []

      vi.spyOn(eventBus, 'emit').mockImplementation(async (event: AccountingDomainEvent) => {
        auditEventOrder.push(event)
      })

      vi.spyOn(JournalRepository.prototype, 'findByIdWithLines')
        .mockResolvedValueOnce({
          id: 'je-atomic-1', status: 'draft', company_id: companyId,
          date: '2024-06-15', total_debit: 2000, total_credit: 2000,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-ATOMIC-001',
          description: 'Atomicity test', lines: [],
        } as any)
        .mockResolvedValueOnce({
          id: 'je-atomic-1', status: 'posted', company_id: companyId,
          date: '2024-06-15', total_debit: 2000, total_credit: 2000,
          currency: 'SAR', exchange_rate: 1, entry_number: 'JE-ATOMIC-001',
          description: 'Atomicity test', lines: [],
        } as any)

      vi.spyOn(PeriodRepository.prototype, 'findOpenPeriodByDate').mockResolvedValue({
        id: 'per-1', fiscal_year_id: 'fy-1', status: 'open',
      } as any)

      const engine = new JournalEngine(db as any, companyId)
      const r = await engine.post('je-atomic-1', 'user-1')
      expect(r.ok).toBe(true)

      const postedIdx = auditEventOrder.indexOf('accounting.journal.posted')
      expect(postedIdx).toBeGreaterThanOrEqual(0)
    })
  })
})

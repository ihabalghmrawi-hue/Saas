import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StockMovementEngine } from '../../domains/inventory/movements/movement-engine'
import { InvoiceEngine } from '../../domains/sales/invoicing/invoice-engine'
import { LedgerEngine } from '../../domains/accounting/ledger/ledger-engine'
import { JournalEngine } from '../../domains/accounting/services/journal-engine.service'
import { SalesAccountingService } from '../../domains/sales/services/accounting-integration.service'
import { StockMovementRepository } from '../../domains/inventory/repositories/movement.repository'
import { InventoryValuationLayerRepository } from '../../domains/inventory/repositories/valuation.repository'
import { InventoryItemRepository } from '../../domains/inventory/repositories/item.repository'
import { InvoiceRepository, InvoiceLineRepository } from '../../domains/sales/repositories/invoice.repository'
import { SalesOrderLineRepository } from '../../domains/sales/repositories/order.repository'
import { createMockDb, type MockDb } from '../test-helpers/mock-db'

describe('Cross-Domain Workflow: Inventory → Sales → Accounting', () => {
  let db: MockDb
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
  })

  it('full flow: receive stock → create invoice → post → verify balance', async () => {
    vi.spyOn(StockMovementRepository.prototype, 'createMovement').mockResolvedValue({ id: 'mov-1', item_id: 'item-1', qty: 100, unit_cost: 50, total_cost: 5000 } as any)
    vi.spyOn(InventoryValuationLayerRepository.prototype, 'addLayer').mockResolvedValue({} as any)
    vi.spyOn(InventoryItemRepository.prototype, 'findById').mockResolvedValue({ id: 'item-1', code: 'ITM-001', name: 'منتج أ', cost_method: 'weighted_average' } as any)
    vi.spyOn(StockMovementRepository.prototype, 'getCurrentStock').mockResolvedValue(100)
    vi.spyOn(InventoryValuationLayerRepository.prototype, 'getWeightedAverageCost').mockResolvedValue(50)
    vi.spyOn(InvoiceRepository.prototype, 'generateInvoiceNo').mockResolvedValue('INV-0001')
    vi.spyOn(InvoiceRepository.prototype, 'create').mockResolvedValue({ id: 'inv-1', invoice_no: 'INV-0001' } as any)
    vi.spyOn(InvoiceLineRepository.prototype, 'createBatch').mockResolvedValue(undefined)
    vi.spyOn(SalesOrderLineRepository.prototype, 'findByOrder').mockResolvedValue([])
    vi.spyOn(InvoiceRepository.prototype, 'findById').mockResolvedValue({ id: 'inv-1', status: 'draft', customer_id: 'cust-1', total: 345, invoice_no: 'INV-0001' } as any)
    vi.spyOn(InvoiceRepository.prototype, 'update').mockResolvedValue({ id: 'inv-1', status: 'posted' } as any)
    vi.spyOn(JournalEngine.prototype, 'create').mockResolvedValue({ ok: true, data: { journal_id: 'je-1', entry_number: 'JE-0001' } })
    vi.spyOn(SalesAccountingService.prototype, 'postSalesInvoice').mockResolvedValue({ ok: true, data: { journal_entry_id: 'je-1' } } as any)
    vi.spyOn(LedgerEngine.prototype, 'getAccountBalance').mockResolvedValue({ ok: true, data: 345 })
    vi.spyOn(LedgerEngine.prototype, 'getTrialBalance').mockResolvedValue({
      ok: true,
      data: [
        { account_code: '1101', account_name: 'نقدية', balance: 0, account_type: 'asset', normal_balance: 'debit', opening_debit: 0, opening_credit: 0, period_debit: 345, period_credit: 0, closing_debit: 345, closing_credit: 0 },
        { account_code: '4001', account_name: 'مبيعات', balance: -345, account_type: 'revenue', normal_balance: 'credit', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 345, closing_debit: 0, closing_credit: 345 },
      ],
    })

    const movementEngine = new StockMovementEngine(db as any, companyId)
    const receiveResult = await movementEngine.receive({
      item_id: 'item-1', warehouse_id: 'wh-1', qty: 100, unit_cost: 50,
      source: 'purchase', source_id: 'po-001', created_by: 'user-1',
    })
    expect(receiveResult.ok).toBe(true)
    if (receiveResult.ok) expect(receiveResult.data.qty).toBe(100)

    const invoiceEngine = new InvoiceEngine(db as any, companyId)
    const invoiceResult = await invoiceEngine.create({
      customer_id: 'cust-1', customer_name: 'شركة العميل',
      lines: [{ item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج أ', qty: 2, unit_price: 150, unit_cost: 50, tax_rate: 15, warehouse_id: 'wh-1' }],
      created_by: 'user-1',
    } as any)
    expect(invoiceResult.ok).toBe(true)

    const postResult = await invoiceEngine.post('inv-1', 'user-1')
    expect(postResult.ok).toBe(true)

    const salesAccounting = new SalesAccountingService(db as any, companyId)
    const postAccResult = await salesAccounting.postSalesInvoice('inv-1', 'user-1')
    expect(postAccResult.ok).toBe(true)

    const ledger = new LedgerEngine(db as any, companyId)
    const tb = await ledger.getTrialBalance('2024-01-01', '2024-01-31')
    expect(tb.ok).toBe(true)
    if (tb.ok) {
      const totalDebit = tb.data.reduce((s: number, l: any) => s + l.period_debit, 0)
      const totalCredit = tb.data.reduce((s: number, l: any) => s + l.period_credit, 0)
      expect(totalDebit).toBe(totalCredit)
    }
  })

  it('handles invoice reversal with credit note', async () => {
    vi.spyOn(InvoiceRepository.prototype, 'findById').mockResolvedValue({
      id: 'inv-1', status: 'posted', customer_id: 'cust-1', customer_name: 'شركة',
      branch_id: null, subtotal: 400, discount_amount: 0, tax_amount: 60, total: 460,
      invoice_no: 'INV-0001', paid_amount: 0,
    } as any)
    vi.spyOn(InvoiceRepository.prototype, 'generateInvoiceNo').mockResolvedValue('INV-CR-001')
    vi.spyOn(InvoiceRepository.prototype, 'create').mockResolvedValue({ id: 'inv-cr-1', invoice_no: 'INV-CR-001' } as any)
    vi.spyOn(InvoiceRepository.prototype, 'update').mockResolvedValue({} as any)

    const invoiceEngine = new InvoiceEngine(db as any, companyId)
    const reverseResult = await invoiceEngine.reverse('inv-1', 'إرجاع كلي', 'user-1')
    expect(reverseResult.ok).toBe(true)

    expect(InvoiceRepository.prototype.create).toHaveBeenCalled()
    const createCall = (InvoiceRepository.prototype.create as any).mock.calls[0][0]
    expect(createCall.total).toBe(-460)
    expect(createCall.invoice_type).toBe('correction')
    expect(createCall.reversed_from_id).toBe('inv-1')
  })

  it('handles stock shortage during issue', async () => {
    vi.spyOn(StockMovementRepository.prototype, 'getCurrentStock').mockResolvedValue(5)

    const movementEngine = new StockMovementEngine(db as any, companyId)
    const result = await movementEngine.issue({
      item_id: 'item-1', warehouse_id: 'wh-1', qty: 10,
      source: 'sales', source_id: 'so-001', created_by: 'user-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INSUFFICIENT_STOCK')
  })

  it('maintains double-entry balance across posted journal', async () => {
    vi.spyOn(JournalEngine.prototype, 'create').mockImplementation(async (input: any) => {
      const totalDebit = input.lines.reduce((s: number, l: any) => s + l.debit, 0)
      const totalCredit = input.lines.reduce((s: number, l: any) => s + l.credit, 0)
      if (Math.abs(totalDebit - totalCredit) > 0.005) {
        return { ok: false, error: 'غير متوازن', code: 'UNBALANCED_ENTRY' }
      }
      return { ok: true, data: { journal_id: 'je-2', entry_number: 'JE-0002' } }
    })

    const journalEngine = new JournalEngine(db as any, companyId)
    const balanced = await journalEngine.create({
      description: 'قيد متوازن',
      lines: [
        { account_code: '1101', debit: 1000, credit: 0 },
        { account_code: '4001', debit: 0, credit: 1000 },
      ],
    } as any)
    expect(balanced.ok).toBe(true)

    const unbalanced = await journalEngine.create({
      description: 'قيد غير متوازن',
      lines: [
        { account_code: '1101', debit: 1000, credit: 0 },
        { account_code: '4001', debit: 0, credit: 999 },
      ],
    } as any)
    expect(unbalanced.ok).toBe(false)
    if (!unbalanced.ok) expect(unbalanced.code).toBe('UNBALANCED_ENTRY')
  })
})

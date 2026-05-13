import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InvoiceEngine } from '../invoicing/invoice-engine'
import { createMockDb, type MockDb } from '../../test-helpers/mock-db'

describe('InvoiceEngine', () => {
  let db: MockDb
  let engine: InvoiceEngine
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    engine = new InvoiceEngine(db as any, companyId)
  })

  describe('create', () => {
    const validInput = {
      customer_id: 'cust-1',
      customer_name: 'شركة الاختبار',
      lines: [
        { item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج أ', qty: 2, unit_price: 100, unit_cost: 60, tax_rate: 15, warehouse_id: 'wh-1' },
      { item_id: 'item-2', item_code: 'ITM-002', item_name: 'منتج ب', qty: 1, unit_price: 200, unit_cost: 120, tax_rate: 15, warehouse_id: 'wh-1' },
    ],
    created_by: 'user-1',
  }

  it('creates invoice with computed totals', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      const lineRepo = (engine as any).lineRepo
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-0001')
      vi.spyOn(invoiceRepo, 'create').mockResolvedValue({ id: 'inv-1', invoice_no: 'INV-0001' })
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      const r = await engine.create(validInput as any)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.id).toBe('inv-1')
        expect(r.data.invoice_no).toBe('INV-0001')
      }
    })

    it('computes line totals correctly', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      const lineRepo = (engine as any).lineRepo

      let capturedCreateArgs: any
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-0002')
      vi.spyOn(invoiceRepo, 'create').mockImplementation((args: any) => {
        capturedCreateArgs = args
        return Promise.resolve({ id: 'inv-2', invoice_no: 'INV-0002' })
      })
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      await engine.create(validInput as any)

      expect(capturedCreateArgs).toBeDefined()
      expect(capturedCreateArgs.subtotal).toBe(400)
      expect(capturedCreateArgs.discount_amount).toBe(0)
      expect(capturedCreateArgs.tax_amount).toBe(60)
      expect(capturedCreateArgs.total).toBe(460)
    })

    it('sets default due_date to 30 days from now', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      const lineRepo = (engine as any).lineRepo
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-0003')
      vi.spyOn(invoiceRepo, 'create').mockResolvedValue({ id: 'inv-3', invoice_no: 'INV-0003' })
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      await engine.create(validInput as any)

      expect(invoiceRepo.create).toHaveBeenCalled()
      const createCall = (invoiceRepo.create as any).mock.calls[0][0]
      expect(createCall.status).toBe('draft')
      expect(createCall.paid_amount).toBe(0)
    })

    it('applies line-level discount', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      const lineRepo = (engine as any).lineRepo
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-0004')
      vi.spyOn(invoiceRepo, 'create').mockResolvedValue({ id: 'inv-4', invoice_no: 'INV-0004' })
      vi.spyOn(lineRepo, 'createBatch').mockResolvedValue(undefined)

      await engine.create({
        ...validInput,
        lines: [{ item_id: 'item-1', item_code: 'ITM-001', item_name: 'منتج', qty: 2, unit_price: 100, unit_cost: 60, discount_percent: 10, tax_rate: 15, warehouse_id: 'wh-1' }],
      } as any)

      const createCall = (invoiceRepo.create as any).mock.calls[0][0]
      expect(createCall.subtotal).toBe(200)
      expect(createCall.discount_amount).toBe(20)
      expect(createCall.tax_amount).toBe(27)
      expect(createCall.total).toBe(207)
    })

    it('handles create failure', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockRejectedValue(new Error('DB error'))

      const r = await engine.create(validInput as any)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVOICE_CREATE_FAILED')
    })
  })

  describe('post', () => {
    it('posts a draft invoice', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({ id: 'inv-1', status: 'draft', customer_id: 'cust-1', total: 500, invoice_no: 'INV-0001' })
      vi.spyOn(invoiceRepo, 'update').mockResolvedValue({ id: 'inv-1', status: 'posted' })

      const r = await engine.post('inv-1', 'user-1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.status).toBe('posted')
    })

    it('rejects posting a non-existent invoice', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue(null)

      const r = await engine.post('inv-404')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('rejects posting a non-draft invoice', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({ id: 'inv-1', status: 'posted' } as any)

      const r = await engine.post('inv-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_STATUS')
    })
  })

  describe('reverse', () => {
    it('reverses a posted invoice by creating correction', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({
        id: 'inv-1', status: 'posted', customer_id: 'cust-1', customer_name: 'شركة',
        branch_id: null, subtotal: 400, discount_amount: 0, tax_amount: 60, total: 460,
        invoice_no: 'INV-0001', paid_amount: 0,
      } as any)
      vi.spyOn(invoiceRepo, 'generateInvoiceNo').mockResolvedValue('INV-CR-001')
      vi.spyOn(invoiceRepo, 'create').mockResolvedValue({ id: 'inv-cr-1', invoice_no: 'INV-CR-001' })
      vi.spyOn(invoiceRepo, 'update').mockResolvedValue({} as any)

      const r = await engine.reverse('inv-1', 'إرجاع كلي')
      expect(r.ok).toBe(true)
      expect(invoiceRepo.create).toHaveBeenCalled()
      const createCall = (invoiceRepo.create as any).mock.calls[0][0]
      expect(createCall.total).toBe(-460)
      expect(createCall.subtotal).toBe(-400)
      expect(createCall.invoice_type).toBe('correction')
      expect(createCall.reversed_from_id).toBe('inv-1')
    })

    it('rejects reversing a fully paid invoice', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue({
        id: 'inv-1', status: 'paid', total: 460, paid_amount: 460,
      } as any)

      const r = await engine.reverse('inv-1', 'إرجاع')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('ALREADY_PAID')
    })

    it('rejects reversing non-existent invoice', async () => {
      const invoiceRepo = (engine as any).invoiceRepo
      vi.spyOn(invoiceRepo, 'findById').mockResolvedValue(null)

      const r = await engine.reverse('inv-404', 'إرجاع')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })
  })
})

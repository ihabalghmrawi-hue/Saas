import { describe, it, expect } from 'vitest'
import { CreateJournalEntrySchema, CreateJournalLineSchema } from '../validators/journal.schema'

describe('CreateJournalLineSchema', () => {
  it('passes a valid debit line', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_code: '1101',
      debit: 1000,
      credit: 0,
      description: 'نقدية',
    })
    expect(r.success).toBe(true)
  })

  it('passes a valid credit line', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_code: '4001',
      debit: 0,
      credit: 1000,
    })
    expect(r.success).toBe(true)
  })

  it('rejects line with both debit and credit', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_code: '1101',
      debit: 500,
      credit: 500,
    })
    expect(r.success).toBe(false)
  })

  it('rejects line with negative amount', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_code: '1101',
      debit: -100,
      credit: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects line with zero amounts', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_code: '1101',
      debit: 0,
      credit: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects line missing account_code and account_id', () => {
    const r = CreateJournalLineSchema.safeParse({
      debit: 500,
      credit: 0,
    })
    expect(r.success).toBe(false)
  })

  it('accepts line with account_id instead of account_code', () => {
    const r = CreateJournalLineSchema.safeParse({
      account_id: '550e8400-e29b-41d4-a716-446655440000',
      debit: 500,
      credit: 0,
    })
    expect(r.success).toBe(true)
  })
})

describe('CreateJournalEntrySchema', () => {
  const validEntry = {
    description: 'قيد اختبار',
    lines: [
      { account_code: '1101', debit: 1000, credit: 0, description: 'نقدية' },
      { account_code: '4001', debit: 0, credit: 1000, description: 'مبيعات' },
    ],
  }

  it('passes a balanced entry', () => {
    const r = CreateJournalEntrySchema.safeParse(validEntry)
    expect(r.success).toBe(true)
  })

  it('rejects fewer than 2 lines', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'test',
      lines: [{ account_code: '1101', debit: 1000, credit: 0 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects unbalanced entry', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'test',
      lines: [
        { account_code: '1101', debit: 1000, credit: 0 },
        { account_code: '4001', debit: 0, credit: 999 },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('rejects more than 100 lines', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'test',
      lines: Array.from({ length: 101 }, (_, i) => ({
        account_code: '1101',
        debit: i === 0 ? 101 : 0,
        credit: i === 0 ? 0 : 1,
      })),
    })
    expect(r.success).toBe(false)
  })

  it('accepts floating-point balanced entry within 0.01 tolerance', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'test',
      lines: [
        { account_code: '1101', debit: 333.33, credit: 0 },
        { account_code: '1102', debit: 666.67, credit: 0 },
        { account_code: '4001', debit: 0, credit: 1000 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('defaults currency to SAR and exchange_rate to 1', () => {
    const r = CreateJournalEntrySchema.safeParse(validEntry)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.currency).toBe('SAR')
      expect(r.data.exchange_rate).toBe(1)
    }
  })

  it('rejects invalid date format', () => {
    const r = CreateJournalEntrySchema.safeParse({
      ...validEntry,
      date: '2024/01/01',
    })
    expect(r.success).toBe(false)
  })

  it('accepts valid date format', () => {
    const r = CreateJournalEntrySchema.safeParse({
      ...validEntry,
      date: '2024-01-01',
    })
    expect(r.success).toBe(true)
  })

  it('rejects description longer than 1000 chars', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'x'.repeat(1001),
      lines: validEntry.lines,
    })
    expect(r.success).toBe(false)
  })

  it('rejects more than 10 tags', () => {
    const r = CreateJournalEntrySchema.safeParse({
      description: 'test',
      tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
      lines: validEntry.lines,
    })
    expect(r.success).toBe(false)
  })

  it('supports optional Arabic description', () => {
    const r = CreateJournalEntrySchema.safeParse({
      ...validEntry,
      description_ar: 'وصف عربي',
    })
    expect(r.success).toBe(true)
  })

  it('supports optional source and source_id', () => {
    const r = CreateJournalEntrySchema.safeParse({
      ...validEntry,
      source: 'sales',
      source_id: 'inv-001',
    })
    expect(r.success).toBe(true)
  })
})

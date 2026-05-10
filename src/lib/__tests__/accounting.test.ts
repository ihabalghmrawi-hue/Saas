import { describe, it, expect } from 'vitest'
import { validateJournalEntry }  from '@/lib/accounting/journal'

describe('validateJournalEntry', () => {
  const balancedLines = [
    { account_code: '1101', account_id: 'a1', debit: 1000, credit: 0,    description: 'نقدية' },
    { account_code: '4001', account_id: 'a2', debit: 0,    credit: 1000, description: 'مبيعات' },
  ]

  it('passes a balanced two-line entry', () => {
    const r = validateJournalEntry(balancedLines)
    expect(r.valid).toBe(true)
    expect(r.error).toBeUndefined()
  })

  it('rejects fewer than 2 lines', () => {
    const r = validateJournalEntry([balancedLines[0]])
    expect(r.valid).toBe(false)
    expect(r.error).toContain('سطرين')
  })

  it('rejects unbalanced entry', () => {
    const r = validateJournalEntry([
      { ...balancedLines[0], debit: 1000 },
      { ...balancedLines[1], credit: 999 },
    ])
    expect(r.valid).toBe(false)
    expect(r.error).toContain('غير متوازن')
  })

  it('rejects negative amounts', () => {
    const r = validateJournalEntry([
      { account_code: '1101', account_id: 'a1', debit: -100, credit: 0,    description: '' },
      { account_code: '4001', account_id: 'a2', debit: 0,    credit: -100, description: '' },
    ])
    expect(r.valid).toBe(false)
  })

  it('rejects a line with both debit and credit', () => {
    const r = validateJournalEntry([
      { account_code: '1101', account_id: 'a1', debit: 500, credit: 500, description: '' },
      { account_code: '4001', account_id: 'a2', debit: 0,   credit: 0,   description: '' },
    ])
    expect(r.valid).toBe(false)
  })

  it('rejects a line with zero amounts', () => {
    const r = validateJournalEntry([
      { account_code: '1101', account_id: 'a1', debit: 1000, credit: 0, description: '' },
      { account_code: '4001', account_id: 'a2', debit: 0, credit: 0,    description: '' },
    ])
    expect(r.valid).toBe(false)
  })

  it('accepts a floating-point balanced entry within tolerance', () => {
    const r = validateJournalEntry([
      { account_code: '1101', account_id: 'a1', debit: 333.33, credit: 0,      description: '' },
      { account_code: '1102', account_id: 'a3', debit: 666.67, credit: 0,      description: '' },
      { account_code: '4001', account_id: 'a2', debit: 0,      credit: 1000,   description: '' },
    ])
    expect(r.valid).toBe(true)
  })

  it('rejects an entry exceeding balance tolerance', () => {
    const r = validateJournalEntry([
      { account_code: '1101', account_id: 'a1', debit: 1000, credit: 0,      description: '' },
      { account_code: '4001', account_id: 'a2', debit: 0,    credit: 999.99, description: '' },
    ])
    // 0.01 diff — exactly at tolerance boundary (> 0.005)
    expect(r.valid).toBe(false)
  })

  it('rejects missing account code and id', () => {
    const r = validateJournalEntry([
      { account_code: '', account_id: '', debit: 500, credit: 0,   description: '' },
      { account_code: '', account_id: '', debit: 0,   credit: 500, description: '' },
    ])
    expect(r.valid).toBe(false)
  })
})

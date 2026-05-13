import type { SupabaseClient } from '@supabase/supabase-js'
import { JournalService } from './journal.service'
import { AccountRepository } from '../repositories/account.repository'
import { PostingRuleRepository, AccountMappingRepository } from '../repositories/posting-rule.repository'
import type { AccountingEventType } from '../types'
import type { PostJournalResult } from '../entities/journal.entity'
import type { ServiceResult } from '../types'

export interface AccountingEvent {
  type: AccountingEventType
  companyId: string
  amount: number
  description: string
  reference?: string
  sourceId?: string
  source?: string
  date?: string
  lines?: Array<{
    accountCode: string
    debit: number
    credit: number
    description?: string
  }>
  debitAccountCode?: string
  creditAccountCode?: string
}

const DEFAULT_MAPPINGS: Record<string, [string, string]> = {
  sale_cash: ['1101', '4001'],
  sale_credit: ['1110', '4001'],
  sale_cogs: ['5001', '1120'],
  sale_payment: ['1101', '1110'],
  sale_return_cash: ['4001', '1101'],
  sale_return_credit: ['4001', '1110'],
  sale_return_cogs: ['1120', '5001'],
  purchase_cash: ['1120', '1101'],
  purchase_credit: ['1120', '2101'],
  purchase_payment: ['2101', '1101'],
  expense_cash: ['6501', '1101'],
  expense_accrual: ['6501', '2101'],
  treasury_transfer: ['1101', '1102'],
  rental_revenue: ['1101', '4001'],
  inventory_adjustment: ['1120', '6502'],
  construction_expense: ['6101', '1101'],
  customer_payment: ['1101', '1110'],
  supplier_payment: ['2101', '1101'],
  payroll: ['6101', '1101'],
  manual: ['6501', '1101'],
}

export class PostingService {
  private readonly journalService: JournalService
  private readonly accountRepo: AccountRepository
  private readonly postingRuleRepo: PostingRuleRepository
  private readonly accountMappingRepo: AccountMappingRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.journalService = new JournalService(db, companyId)
    this.accountRepo = new AccountRepository(db, companyId)
    this.postingRuleRepo = new PostingRuleRepository(db, companyId)
    this.accountMappingRepo = new AccountMappingRepository(db, companyId)
  }

  async postEvent(event: AccountingEvent): Promise<ServiceResult<PostJournalResult>> {
    const entryDate = event.date || new Date().toISOString().slice(0, 10)

    const lines = event.lines && event.lines.length > 0
      ? event.lines.map(l => ({
          account_code: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          description: l.description || event.description,
        }))
      : await this.resolveLines(event)

    if (lines.length === 0) {
      return { ok: false, error: 'لا يمكن تحديد حسابات الترحيل', code: 'NO_LINES_RESOLVED' }
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return {
        ok: false,
        error: `القيد غير متوازن: مدين=${totalDebit.toFixed(2)} دائن=${totalCredit.toFixed(2)}`,
        code: 'UNBALANCED',
      }
    }

    return this.journalService.create({
      company_id: this.companyId,
      description: event.description,
      reference: event.reference,
      source: event.source || this.deriveSource(event.type),
      source_id: event.sourceId,
      date: entryDate,
      lines,
    })
  }

  private async resolveLines(event: AccountingEvent): Promise<Array<{
    account_code: string
    debit: number
    credit: number
    description?: string
  }>> {
    const rules = await this.postingRuleRepo.findByEvent(event.type)
    if (rules.length > 0) {
      return this.applyPostingRules(rules, event)
    }

    const mapping = await this.accountMappingRepo.findByEvent(event.type)
    if (mapping) {
      const debitAccount = await this.accountRepo.findActiveById(mapping.debit_account_id)
      const creditAccount = await this.accountRepo.findActiveById(mapping.credit_account_id)
      if (debitAccount && creditAccount) {
        return [
          { account_code: debitAccount.code, debit: event.amount, credit: 0, description: event.description },
          { account_code: creditAccount.code, debit: 0, credit: event.amount, description: event.description },
        ]
      }
    }

    const defaultMapping = DEFAULT_MAPPINGS[event.type] ||
      [event.debitAccountCode || '6501', event.creditAccountCode || '1101']

    return [
      { account_code: defaultMapping[0], debit: event.amount, credit: 0, description: event.description },
      { account_code: defaultMapping[1], debit: 0, credit: event.amount, description: event.description },
    ]
  }

  private applyPostingRules(
    rules: any[],
    event: AccountingEvent,
  ): Array<{ account_code: string; debit: number; credit: number; description?: string }> {
    const lines: Array<{ account_code: string; debit: number; credit: number; description?: string }> = []

    for (const rule of rules) {
      if (!rule.posting_rule_lines) continue
      for (const line of rule.posting_rule_lines) {
        if (line.condition_field && !this.evaluateCondition(line, event)) continue

        const amount = line.amount_fixed > 0
          ? line.amount_fixed
          : event.amount * (line.amount_percent / 100)

        if (line.debit_account_id) {
          lines.push({ account_code: '', debit: amount, credit: 0, description: event.description })
        }
        if (line.credit_account_id) {
          lines.push({ account_code: '', credit: amount, debit: 0, description: event.description })
        }
      }
    }

    return lines
  }

  private evaluateCondition(line: any, event: AccountingEvent): boolean {
    if (!line.condition_field || !line.condition_operator || !line.condition_value) return true

    const value = (event as any)[line.condition_field]
    switch (line.condition_operator) {
      case 'eq': return value === line.condition_value
      case 'neq': return value !== line.condition_value
      case 'gt': return Number(value) > Number(line.condition_value)
      case 'gte': return Number(value) >= Number(line.condition_value)
      case 'lt': return Number(value) < Number(line.condition_value)
      case 'lte': return Number(value) <= Number(line.condition_value)
      case 'in': return line.condition_value.split(',').includes(String(value))
      default: return true
    }
  }

  private deriveSource(type: AccountingEventType): string {
    if (type.startsWith('sale')) return 'sale'
    if (type.startsWith('purchase')) return 'purchase'
    if (type.startsWith('expense')) return 'expense'
    if (type.startsWith('return')) return 'return'
    if (type.startsWith('rental')) return 'rental'
    if (type.startsWith('construction')) return 'construction'
    if (type === 'treasury_transfer') return 'treasury'
    if (type === 'customer_payment') return 'sale'
    if (type === 'supplier_payment') return 'purchase'
    if (type === 'payroll') return 'payroll'
    if (type === 'inventory_adjustment') return 'inventory'
    return 'manual'
  }
}

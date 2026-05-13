// ============================================================
// Posting Rules Engine — Transaction Templates & Account Mapping
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountingEvent } from './events'
import type { JournalLine } from './types'

interface ResolvedPosting {
  lines: JournalLine[]
  tax_line?: JournalLine
}

export class PostingRulesEngine {
  private supabase: SupabaseClient
  private companyId: string

  constructor(supabase: SupabaseClient, companyId: string) {
    this.supabase = supabase
    this.companyId = companyId
  }

  async resolveEvent(event: AccountingEvent): Promise<ResolvedPosting> {
    const lines: JournalLine[] = []

    if (event.lines && event.lines.length > 0) {
      return { lines: event.lines.map(l => ({
        account_code: l.accountCode,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      }))}
    }

    const rule = await this.findMatchingRule(event.type)
    if (rule) {
      return this.applyRule(rule, event)
    }

    const mapping = await this.findMapping(event.type)
    if (mapping) {
      return this.applyMapping(mapping, event)
    }

    throw new Error(`لا توجد قاعدة ترحيل للنوع: ${event.type}`)
  }

  private async findMatchingRule(eventType: string) {
    const { data } = await this.supabase
      .from('posting_rules')
      .select('*, posting_rule_lines(*)')
      .eq('company_id', this.companyId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle()

    return data as any
  }

  private async findMapping(eventType: string) {
    const { data } = await this.supabase
      .from('account_mappings')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .maybeSingle()

    return data as any
  }

  private async applyRule(rule: any, event: AccountingEvent): Promise<ResolvedPosting> {
    const lines: JournalLine[] = []
    const ruleLines = rule.posting_rule_lines || []

    for (const rl of ruleLines.sort((a: any, b: any) => a.sequence - b.sequence)) {
      const amount = rl.amount_fixed > 0
        ? rl.amount_fixed
        : event.amount * (rl.amount_percent / 100)

      if (amount <= 0) continue

      if (rl.debit_account_id) {
        const { data: acct } = await this.supabase
          .from('accounts')
          .select('code')
          .eq('id', rl.debit_account_id)
          .single()
        if (acct) {
          lines.push({
            account_code: acct.code,
            debit: amount,
            credit: 0,
            description: rl.description || event.description,
          })
        }
      }

      if (rl.credit_account_id) {
        const { data: acct } = await this.supabase
          .from('accounts')
          .select('code')
          .eq('id', rl.credit_account_id)
          .single()
        if (acct) {
          lines.push({
            account_code: acct.code,
            debit: 0,
            credit: amount,
            description: rl.description || event.description,
          })
        }
      }
    }

    return { lines }
  }

  private async applyMapping(mapping: any, event: AccountingEvent): Promise<ResolvedPosting> {
    const lines: JournalLine[] = []
    const amount = event.amount

    const { data: drAcct } = await this.supabase
      .from('accounts')
      .select('code')
      .eq('id', mapping.debit_account_id)
      .single()

    const { data: crAcct } = await this.supabase
      .from('accounts')
      .select('code')
      .eq('id', mapping.credit_account_id)
      .single()

    if (drAcct) {
      lines.push({
        account_code: drAcct.code,
        debit: amount,
        credit: 0,
        description: event.description,
      })
    }

    if (crAcct) {
      lines.push({
        account_code: crAcct.code,
        debit: 0,
        credit: amount,
        description: event.description,
      })
    }

    let tax_line: JournalLine | undefined
    if (mapping.tax_account_id && mapping.tax_rate > 0) {
      const { data: taxAcct } = await this.supabase
        .from('accounts')
        .select('code')
        .eq('id', mapping.tax_account_id)
        .single()

      if (taxAcct) {
        const taxAmount = amount * (mapping.tax_rate / 100)
        tax_line = {
          account_code: taxAcct.code,
          debit: taxAmount,
          credit: 0,
          description: `ضريبة ${mapping.tax_rate}%`,
        }
      }
    }

    return { lines, tax_line }
  }
}

// ── Cost Center Allocation ─────────────────────────────────────
export async function allocateToCostCenters(
  supabase: SupabaseClient,
  companyId: string,
  journalEntryId: string,
  lines: Array<{ account_id: string; debit: number; credit: number }>,
): Promise<void> {
  const { data: rules } = await supabase
    .from('cost_center_allocation_rules')
    .select('*, cost_centers!inner(code, name_ar)')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (!rules || rules.length === 0) return

  for (const line of lines) {
    const matchingRules = rules.filter(
      (r: any) => !r.account_id || r.account_id === line.account_id
    )
    for (const rule of matchingRules) {
      let allocAmount = 0
      if (rule.allocation_type === 'percentage') {
        allocAmount = (line.debit + line.credit) * (rule.allocation_value / 100)
      } else if (rule.allocation_type === 'fixed') {
        allocAmount = Math.min(rule.allocation_value, line.debit + line.credit)
      }

      if (allocAmount > 0) {
        await supabase.from('journal_entry_lines').insert({
          journal_entry_id: journalEntryId,
          account_id: line.account_id,
          debit: allocAmount,
          credit: 0,
          cost_center_id: rule.cost_center_id,
          description: `توزيع: ${rule.cost_centers?.name_ar || rule.cost_center_id}`,
        })
      }
    }
  }
}

// ── Branch Allocation ──────────────────────────────────────────
export async function allocateToBranches(
  supabase: SupabaseClient,
  companyId: string,
  journalEntryId: string,
  sourceBranchId?: string,
): Promise<void> {
  if (!sourceBranchId) return

  const { data: branches } = await supabase
    .from('branches')
    .select('id, code, name_ar')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (!branches || branches.length <= 1) return

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', journalEntryId)

  if (!lines) return

  const otherBranches = branches.filter((b: any) => b.id !== sourceBranchId)
  const sharePerBranch = 1 / (otherBranches.length + 1)

  for (const line of lines) {
    const amount = (line.debit + line.credit) * sharePerBranch
    if (amount <= 0) continue

    for (const branch of otherBranches) {
      await supabase.from('journal_entry_lines').insert({
        journal_entry_id: journalEntryId,
        account_id: line.account_id,
        debit: amount,
        credit: 0,
        branch_id: branch.id,
        description: `توزيع فرع: ${branch.name_ar}`,
      })
    }
  }
}

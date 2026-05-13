import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { PostingRuleEntity, AccountMappingEntity } from '../entities/posting-rule.entity'

export class PostingRuleRepository extends BaseRepository<PostingRuleEntity> {
  protected readonly table = 'posting_rules'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByIdWithLines(id: string): Promise<PostingRuleEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(`
        *,
        posting_rule_lines (*)
      `)
      .eq('company_id', this.companyId)
      .eq('id', id)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as PostingRuleEntity
  }

  async findByEvent(eventType: string): Promise<PostingRuleEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(`
        *,
        posting_rule_lines (*)
      `)
      .eq('company_id', this.companyId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as PostingRuleEntity[]
  }

  async findAllActive(): Promise<PostingRuleEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(`
        *,
        posting_rule_lines (*)
      `)
      .eq('company_id', this.companyId)
      .order('priority', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as PostingRuleEntity[]
  }

  async createWithLines(input: {
    name: string
    name_ar?: string
    event_type: string
    description?: string
    is_active?: boolean
    priority?: number
    lines: Array<{
      sequence: number
      debit_account_id?: string | null
      credit_account_id?: string | null
      condition_field?: string | null
      condition_operator?: string | null
      condition_value?: string | null
      amount_percent?: number
      amount_fixed?: number
      description?: string | null
    }>
  }): Promise<PostingRuleEntity> {
    const { lines, ...ruleData } = input
    const { data: rule, error: ruleError } = await this.db
      .from(this.table)
      .insert({ ...ruleData, company_id: this.companyId })
      .select()
      .single()
    if (ruleError) throw new RepositoryError(ruleError.message, ruleError.code)

    if (lines.length > 0) {
      const { error: linesError } = await this.db
        .from('posting_rule_lines')
        .insert(lines.map(l => ({ ...l, posting_rule_id: rule.id })))
      if (linesError) throw new RepositoryError(linesError.message, linesError.code)
    }

    return this.findByIdWithLines(rule.id) as Promise<PostingRuleEntity>
  }

  async updateWithLines(id: string, input: {
    name?: string
    name_ar?: string
    event_type?: string
    description?: string | null
    is_active?: boolean
    priority?: number
    lines?: Array<{
      sequence: number
      debit_account_id?: string | null
      credit_account_id?: string | null
      condition_field?: string | null
      condition_operator?: string | null
      condition_value?: string | null
      amount_percent?: number
      amount_fixed?: number
      description?: string | null
    }>
  }): Promise<PostingRuleEntity> {
    const { lines, ...ruleData } = input
    if (Object.keys(ruleData).length > 0) {
      await this.update(id, ruleData)
    }
    if (lines) {
      await this.db.from('posting_rule_lines').delete().eq('posting_rule_id', id)
      if (lines.length > 0) {
        const { error } = await this.db
          .from('posting_rule_lines')
          .insert(lines.map(l => ({ ...l, posting_rule_id: id })))
        if (error) throw new RepositoryError(error.message, error.code)
      }
    }
    return this.findByIdWithLines(id) as Promise<PostingRuleEntity>
  }
}

export class AccountMappingRepository extends BaseRepository<AccountMappingEntity> {
  protected readonly table = 'account_mappings'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByEvent(eventType: string): Promise<AccountMappingEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as AccountMappingEntity | null
  }

  async upsert(input: {
    event_type: string
    debit_account_id: string
    credit_account_id: string
    tax_account_id?: string | null
    tax_rate?: number
    description?: string | null
  }): Promise<AccountMappingEntity> {
    const { data, error } = await this.db
      .from(this.table)
      .upsert({
        company_id: this.companyId,
        ...input,
      }, { onConflict: 'company_id,event_type' })
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as AccountMappingEntity
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from './base.repository'
import type { SubscriptionRow } from '@/validators/subscription'

/**
 * Subscription repository — NOT company-scoped (company_id is text, no FK).
 * Queries are scoped by company_id string comparison.
 */
export class SubscriptionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByCompanyId(companyId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id, company_id, plan, status, start_date, end_date, trial_ends_at, notes')
      .eq('company_id', String(companyId))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as SubscriptionRow | null
  }

  async findById(id: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id, company_id, plan, status, start_date, end_date, trial_ends_at, notes')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as SubscriptionRow | null
  }

  async update(id: string, updates: Partial<SubscriptionRow>): Promise<SubscriptionRow> {
    const { data, error } = await this.db
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as SubscriptionRow
  }

  async listExpiring(withinDays: number): Promise<SubscriptionRow[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id, company_id, plan, status, start_date, end_date, trial_ends_at, notes')
      .in('status', ['active', 'trialing'])
      .lte('end_date', cutoff.toISOString().split('T')[0])
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as SubscriptionRow[]
  }
}

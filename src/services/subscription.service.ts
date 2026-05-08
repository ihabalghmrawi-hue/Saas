import type { SupabaseClient }         from '@supabase/supabase-js'
import { SubscriptionRepository }       from '@/repositories/subscription.repository'
import { computeLifecycle, needsStatusSync } from '@/lib/subscription'
import type { SubscriptionRow }         from '@/validators/subscription'
import type { ServiceResult }           from './product.service'

export class SubscriptionService {
  private readonly repo: SubscriptionRepository

  constructor(private readonly db: SupabaseClient) {
    this.repo = new SubscriptionRepository(db)
  }

  async getForCompany(companyId: string): Promise<ServiceResult<SubscriptionRow & { lifecycle: ReturnType<typeof computeLifecycle> }>> {
    const row = await this.repo.findByCompanyId(companyId)
    const lifecycle = computeLifecycle(row)
    if (!row) {
      return {
        ok:   true,
        data: { id: '', company_id: companyId, plan: 'free', status: 'expired', start_date: null, end_date: null, trial_ends_at: null, notes: null, lifecycle },
      }
    }
    return { ok: true, data: { ...row, lifecycle } }
  }

  async syncStatusIfNeeded(companyId: string): Promise<{ synced: boolean; from?: string; to?: string }> {
    const row = await this.repo.findByCompanyId(companyId)
    if (!row) return { synced: false }

    const computed = computeLifecycle(row)
    if (!needsStatusSync(row, computed)) return { synced: false }

    await this.repo.update(row.id, { status: computed.status })
    return { synced: true, from: row.status, to: computed.status }
  }

  async extend(
    id:   string,
    days: number,
  ): Promise<ServiceResult<SubscriptionRow>> {
    const row = await this.repo.findById(id)
    if (!row) return { ok: false, error: 'الاشتراك غير موجود', code: 'NOT_FOUND' }

    const base    = row.end_date && new Date(row.end_date) > new Date()
      ? new Date(row.end_date)
      : new Date()
    base.setDate(base.getDate() + days)

    try {
      const updated = await this.repo.update(id, {
        end_date: base.toISOString().split('T')[0],
        status:   'active',
      })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async suspend(id: string): Promise<ServiceResult<SubscriptionRow>> {
    try {
      const updated = await this.repo.update(id, { status: 'suspended' })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async activate(id: string): Promise<ServiceResult<SubscriptionRow>> {
    try {
      const updated = await this.repo.update(id, { status: 'active' })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  /** Batch: sync all active/trialing subs that have drifted. Returns count synced. */
  async batchSyncExpired(): Promise<number> {
    const expiring = await this.repo.listExpiring(0)   // all past or at-today
    let synced = 0
    for (const row of expiring) {
      const computed = computeLifecycle(row)
      if (needsStatusSync(row, computed)) {
        await this.repo.update(row.id, { status: computed.status })
        synced++
      }
    }
    return synced
  }
}

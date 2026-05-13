import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountingEventPayload } from './accounting-event'
import type { ServiceResult } from '../types'

type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical'

interface NotificationInput {
  companyId: string
  type: string
  title: string
  body?: string
  severity?: NotificationSeverity
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export class NotificationService {
  constructor(private readonly db: SupabaseClient) {}

  async send(input: NotificationInput): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await this.db
        .from('notifications')
        .insert({
          company_id: input.companyId,
          type: input.type,
          title: input.title,
          body: input.body || null,
          severity: input.severity || 'info',
          action_url: input.actionUrl || null,
          metadata: input.metadata || null,
        })
        .select('id')
        .single()

      if (error) throw error
      return { ok: true, data: { id: data.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'NOTIFICATION_FAILED' }
    }
  }

  async sendAccountingAlert(
    payload: AccountingEventPayload,
    overrides?: { title?: string; severity?: NotificationSeverity },
  ): Promise<ServiceResult<{ id: string }>> {
    const typeMap: Record<string, { title: string; severity: NotificationSeverity }> = {
      'accounting.journal.posted': { title: 'تم ترحيل قيد محاسبي', severity: 'info' },
      'accounting.journal.reversed': { title: 'تم عكس قيد محاسبي', severity: 'warning' },
      'accounting.journal.voided': { title: 'تم إلغاء قيد محاسبي', severity: 'warning' },
      'accounting.integrity.failed': { title: 'فشل فحص النزاهة المحاسبية', severity: 'error' },
      'accounting.period.closed': { title: 'تم إغلاق الفترة المالية', severity: 'info' },
      'accounting.reconciliation.completed': { title: 'تم إتمام التسوية', severity: 'info' },
      'accounting.recurring.executed': { title: 'تم تشغيل قيد دوري', severity: 'info' },
      'accounting.integrity.passed': { title: 'فحص النزاهة ناجح', severity: 'info' },
    }

    const key = payload.source
      ? `accounting.${payload.source.replace('accounting.', '')}`
      : ''

    const defaults = typeMap[key as keyof typeof typeMap] || { title: 'إشعار محاسبي', severity: 'info' as NotificationSeverity }

    return this.send({
      companyId: payload.companyId,
      type: key || payload.type,
      title: overrides?.title || defaults.title,
      body: payload.description,
      severity: overrides?.severity || defaults.severity,
      actionUrl: payload.journalEntryId ? `/dashboard/accounting/ledger/${payload.journalEntryId}` : undefined,
      metadata: payload.metadata,
    })
  }
}

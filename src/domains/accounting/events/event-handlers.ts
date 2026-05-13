import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountingEventBus } from './event-bus'
import { NotificationService } from './notification.service'
import { JobQueueService } from './job-queue.service'
import { IntegrityService } from '../services/integrity.service'
import { RecurringJournalRepository } from '../repositories/recurring.repository'
import type { AccountingEventPayload, AccountingDomainEvent, EventHandler } from './accounting-event'

export function registerDefaultHandlers(
  supabase: SupabaseClient,
  companyId: string,
): () => void {
  const bus = AccountingEventBus.getInstance()
  const notificationService = new NotificationService(supabase)
  const jobQueue = new JobQueueService(supabase)
  const integrityService = new IntegrityService(supabase, companyId)
  const recurringRepo = new RecurringJournalRepository(supabase, companyId)

  const handlers: Array<{ event: AccountingDomainEvent; handler: EventHandler }> = [
    {
      event: 'accounting.journal.posted',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload)

        if (payload.amount > 100000) {
          await supabase.from('ai_insights').insert({
            company_id: payload.companyId,
            type: 'alert',
            category: 'large_transaction',
            title: 'معاملة بقيمة كبيرة',
            content: `تم ترحيل قيد بقيمة ${payload.amount} - ${payload.description}`,
            confidence: 0.95,
            metadata: { entry_number: payload.entryNumber, reference: payload.reference },
          })
        }
      },
    },
    {
      event: 'accounting.journal.reversed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload, {
          title: 'تم عكس قيد محاسبي',
          severity: 'warning',
        })
      },
    },
    {
      event: 'accounting.journal.voided',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload, {
          title: 'تم إلغاء قيد محاسبي',
          severity: 'warning',
        })
      },
    },
    {
      event: 'accounting.period.closed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload)
        await integrityService.runAllChecks()
      },
    },
    {
      event: 'accounting.fiscal.year.closed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload, {
          title: 'تم إغلاق السنة المالية',
          severity: 'warning',
        })
      },
    },
    {
      event: 'accounting.reconciliation.completed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload, {
          severity: 'info',
        })
      },
    },
    {
      event: 'accounting.recurring.executed',
      handler: async (payload) => {
        if (payload.metadata?.nextRunDate === null) {
          await notificationService.send({
            companyId: payload.companyId,
            type: 'recurring_completed',
            title: 'اكتمل القيد الدوري',
            body: `اكتمل القيد الدوري: ${payload.description}`,
            severity: 'info',
            metadata: payload.metadata,
          })
        }
      },
    },
    {
      event: 'accounting.integrity.failed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload, {
          severity: 'error',
        })
        await supabase.from('financial_integrity_logs').insert({
          company_id: payload.companyId,
          check_type: 'integrity_check',
          severity: 'error',
          status: 'open',
          description: payload.description,
          details: payload.metadata || {},
          detected_at: new Date().toISOString(),
        })
      },
    },
    {
      event: 'accounting.integrity.passed',
      handler: async (payload) => {
        await notificationService.sendAccountingAlert(payload)
      },
    },
    {
      event: 'accounting.snapshot.created',
      handler: async () => {},
    },
    {
      event: 'accounting.account.created',
      handler: async () => {},
    },
    {
      event: 'accounting.account.updated',
      handler: async () => {},
    },
  ]

  for (const { event, handler } of handlers) {
    bus.on(event, handler)
  }

  return () => {
    for (const { event, handler } of handlers) {
      bus.off(event, handler)
    }
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountingEventPayload, AccountingDomainEvent, EventHandler } from './accounting-event'

type HandlerMap = Map<AccountingDomainEvent, Set<EventHandler>>

export class AccountingEventBus {
  private static instance: AccountingEventBus
  private handlers: HandlerMap = new Map()
  private history: AccountingEventPayload[] = []
  private readonly maxHistory = 1000

  static getInstance(): AccountingEventBus {
    if (!this.instance) {
      this.instance = new AccountingEventBus()
    }
    return this.instance
  }

  on(event: AccountingDomainEvent, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
  }

  off(event: AccountingDomainEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler)
  }

  async emit(event: AccountingDomainEvent, payload: AccountingEventPayload, supabase?: SupabaseClient): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const promises = Array.from(handlers).map(h => h(payload).catch(err => {
        console.error(`[AccountingEventBus] Handler failed for ${event}:`, err)
      }))
      await Promise.all(promises)
    }

    if (supabase) {
      try {
        await supabase.from('journal_audit_trail').insert({
          journal_entry_id: payload.journalEntryId || null,
          company_id: payload.companyId,
          action: event.replace('accounting.', ''),
          new_values: payload as any,
          performed_at: payload.timestamp,
        })
      } catch {
        // Non-critical: audit log insertion failure
      }
    }

    this.history.push(payload)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  getHistory(limit = 50): AccountingEventPayload[] {
    return this.history.slice(-limit)
  }

  clear(): void {
    this.handlers.clear()
    this.history = []
  }
}

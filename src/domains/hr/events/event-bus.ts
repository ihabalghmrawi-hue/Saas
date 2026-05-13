import type { HrDomainEvent, PayrollEventType } from '../types'

type EventHandler = (event: HrDomainEvent) => void | Promise<void>

export class HrEventBus {
  private static instance: HrEventBus
  private handlers = new Map<string, Set<EventHandler>>()

  static getInstance(): HrEventBus {
    if (!this.instance) this.instance = new HrEventBus()
    return this.instance
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set())
    this.handlers.get(eventType)!.add(handler)
    return () => this.handlers.get(eventType)?.delete(handler)
  }

  emit(eventType: string, event: Omit<HrDomainEvent, 'id'> & { id?: string }): void {
    const fullEvent: HrDomainEvent = { id: event.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, ...event, type: eventType }
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      handlers.forEach(h => {
        try { Promise.resolve(h(fullEvent)).catch(() => {}) } catch {}
      })
    }
    const wildcard = this.handlers.get('*')
    if (wildcard) {
      wildcard.forEach(h => {
        try { Promise.resolve(h(fullEvent)).catch(() => {}) } catch {}
      })
    }
  }

  removeAll(): void {
    this.handlers.clear()
  }
}

export function createHrEventBus(): HrEventBus {
  return HrEventBus.getInstance()
}

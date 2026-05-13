import type { SalesDomainEvent, SalesEventPayload, EventHandler } from '../types'

type HandlerMap = Map<SalesDomainEvent, Set<EventHandler>>

export class SalesEventBus {
  private static instance: SalesEventBus
  private handlers: HandlerMap = new Map()
  private history: SalesEventPayload[] = []
  private readonly maxHistory = 500

  static getInstance(): SalesEventBus {
    if (!this.instance) this.instance = new SalesEventBus()
    return this.instance
  }

  on(event: SalesDomainEvent, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }

  off(event: SalesDomainEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler)
  }

  async emit(event: SalesDomainEvent, payload: SalesEventPayload): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(h =>
          h(payload).catch(err => console.error(`[SalesEventBus] ${event}:`, err)),
        ),
      )
    }
    this.history.push(payload)
    if (this.history.length > this.maxHistory) this.history.shift()
  }

  getHistory(limit = 50): SalesEventPayload[] {
    return this.history.slice(-limit)
  }

  clear(): void { this.handlers.clear(); this.history = [] }
}

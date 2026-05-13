import type { InventoryDomainEvent, InventoryEventPayload, EventHandler } from '../types'

type HandlerMap = Map<InventoryDomainEvent, Set<EventHandler>>

export class InventoryEventBus {
  private static instance: InventoryEventBus
  private handlers: HandlerMap = new Map()
  private history: InventoryEventPayload[] = []
  private readonly maxHistory = 500

  static getInstance(): InventoryEventBus {
    if (!this.instance) {
      this.instance = new InventoryEventBus()
    }
    return this.instance
  }

  on(event: InventoryDomainEvent, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
  }

  off(event: InventoryDomainEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler)
  }

  async emit(event: InventoryDomainEvent, payload: InventoryEventPayload): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const promises = Array.from(handlers).map(h =>
        h(payload).catch(err => console.error(`[InventoryEventBus] Handler failed for ${event}:`, err)),
      )
      await Promise.all(promises)
    }

    this.history.push(payload)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  getHistory(limit = 50): InventoryEventPayload[] {
    return this.history.slice(-limit)
  }

  clear(): void {
    this.handlers.clear()
    this.history = []
  }
}

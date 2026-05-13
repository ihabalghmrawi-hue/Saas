import { InventoryEventBus } from './event-bus'
import type { InventoryDomainEvent, EventHandler, InventoryEventPayload } from '../types'

export function registerDefaultHandlers(): () => void {
  const bus = InventoryEventBus.getInstance()

  const handlers: Array<{ event: InventoryDomainEvent; handler: EventHandler }> = [
    {
      event: 'inventory.received',
      handler: async () => {},
    },
    {
      event: 'inventory.issued',
      handler: async () => {},
    },
    {
      event: 'inventory.adjusted',
      handler: async () => {},
    },
    {
      event: 'inventory.transferred',
      handler: async () => {},
    },
    {
      event: 'inventory.transfer.received',
      handler: async () => {},
    },
    {
      event: 'inventory.low_stock',
      handler: async (payload) => {
        console.warn(`[LOW STOCK] ${payload.description}: ${payload.qty} remaining`)
      },
    },
    {
      event: 'inventory.reserved',
      handler: async () => {},
    },
    {
      event: 'inventory.reconciled',
      handler: async () => {},
    },
    {
      event: 'inventory.snapshot.created',
      handler: async () => {},
    },
    {
      event: 'inventory.reorder.generated',
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

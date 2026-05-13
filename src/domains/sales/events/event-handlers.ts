import { SalesEventBus } from './event-bus'
import type { SalesDomainEvent, EventHandler } from '../types'

export function registerDefaultHandlers(): () => void {
  const bus = SalesEventBus.getInstance()

  const handlers: Array<{ event: SalesDomainEvent; handler: EventHandler }> = [
    { event: 'sales.quotation.created', handler: async () => {} },
    { event: 'sales.order.created', handler: async () => {} },
    { event: 'sales.invoice.posted', handler: async () => {} },
    { event: 'sales.invoice.paid', handler: async () => {} },
    { event: 'sales.payment.received', handler: async () => {} },
    { event: 'sales.shipment.delivered', handler: async () => {} },
    { event: 'sales.return.created', handler: async () => {} },
    { event: 'sales.return.completed', handler: async () => {} },
    { event: 'sales.credit_limit.exceeded', handler: async (p) => { console.warn(`[CREDIT LIMIT] ${p.description}`) } },
    { event: 'sales.invoice.overdue', handler: async () => {} },
  ]

  for (const { event, handler } of handlers) bus.on(event, handler)

  return () => {
    for (const { event, handler } of handlers) bus.off(event, handler)
  }
}

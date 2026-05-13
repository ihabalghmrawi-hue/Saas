import { RedisClient } from './client'

const CHANNEL_PREFIX = 'events:'

export type EventHandler = (channel: string, data: unknown) => void | Promise<void>

export class EventBus {
  private client: RedisClient
  private subscriber: RedisClient
  private handlers: Map<string, Set<EventHandler>>
  private subscribed: Set<string>
  private internalHandler: ((channel: string, message: string) => void) | null

  constructor(client: RedisClient, subscriber?: RedisClient) {
    this.client = client
    this.subscriber = subscriber ?? client.duplicate()
    this.handlers = new Map()
    this.subscribed = new Set()
    this.internalHandler = null
  }

  async publish<T>(channel: string, data: T): Promise<number> {
    const message = JSON.stringify({
      data,
      timestamp: Date.now(),
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    })
    return this.client.publish(`${CHANNEL_PREFIX}${channel}`, message)
  }

  async subscribe(channel: string, handler: EventHandler): Promise<void> {
    const fullChannel = `${CHANNEL_PREFIX}${channel}`
    if (!this.handlers.has(fullChannel)) {
      this.handlers.set(fullChannel, new Set())
    }
    this.handlers.get(fullChannel)!.add(handler)

    if (!this.subscribed.has(fullChannel)) {
      if (!this.internalHandler) {
        this.internalHandler = (ch: string, message: string) => {
          try {
            const parsed = JSON.parse(message)
            const h = this.handlers.get(ch)
            if (h) {
              for (const handler of h) {
                Promise.resolve(handler(ch, parsed.data)).catch((err) =>
                  console.error(`[EventBus] handler error on ${ch}:`, err)
                )
              }
            }
          } catch {
            console.error(`[EventBus] failed to parse message on ${ch}`)
          }
        }
        this.subscriber.on('message', this.internalHandler)
      }
      await this.subscriber.subscribe(fullChannel)
      this.subscribed.add(fullChannel)
    }
  }

  async unsubscribe(channel: string, handler?: EventHandler): Promise<void> {
    const fullChannel = `${CHANNEL_PREFIX}${channel}`
    if (!this.handlers.has(fullChannel)) return

    if (handler) {
      this.handlers.get(fullChannel)!.delete(handler)
      if (this.handlers.get(fullChannel)!.size === 0) {
        this.handlers.delete(fullChannel)
        await this.subscriber.unsubscribe(fullChannel)
        this.subscribed.delete(fullChannel)
      }
    } else {
      this.handlers.delete(fullChannel)
      await this.subscriber.unsubscribe(fullChannel)
      this.subscribed.delete(fullChannel)
    }
  }

  async patternSubscribe(pattern: string, handler: EventHandler): Promise<void> {
    const fullPattern = `${CHANNEL_PREFIX}${pattern}`
    if (!this.handlers.has(fullPattern)) {
      this.handlers.set(fullPattern, new Set())
    }
    this.handlers.get(fullPattern)!.add(handler)

    if (!this.subscribed.has(fullPattern)) {
      await this.subscriber.psubscribe(fullPattern)
      this.subscribed.add(fullPattern)
    }
  }

  async patternUnsubscribe(pattern: string): Promise<void> {
    const fullPattern = `${CHANNEL_PREFIX}${pattern}`
    this.handlers.delete(fullPattern)
    await this.subscriber.punsubscribe(fullPattern)
    this.subscribed.delete(fullPattern)
  }

  async disconnect(): Promise<void> {
    this.handlers.clear()
    this.subscribed.clear()
    this.subscriber.removeAllListeners()
    await this.subscriber.quit()
  }

  activeSubscriptions(): number {
    let count = 0
    for (const handlers of this.handlers.values()) {
      count += handlers.size
    }
    return count
  }
}

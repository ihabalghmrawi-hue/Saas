import type { RedisClient } from './client'
import { randomUUID } from 'crypto'
import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('trace-propagator')

export interface TraceContext {
  traceId: string
  parentSpanId: string
  serviceName: string
  operationName: string
  baggage?: Record<string, string>
}

export const TRACEPARENT_HEADER = 'traceparent'
export const TRACESTATE_HEADER = 'tracestate'
export const BAGGAGE_HEADER = 'baggage'

export class TracePropagator {
  private client: RedisClient
  private prefix: string
  private serviceName: string

  constructor(client: RedisClient, options?: { prefix?: string; serviceName?: string }) {
    this.client = client
    this.prefix = options?.prefix || 'finance:trace:'
    this.serviceName = options?.serviceName || 'unknown'
  }

  inject(context: TraceContext): { [TRACEPARENT_HEADER]: string; [TRACESTATE_HEADER]?: string; [BAGGAGE_HEADER]?: string } {
    const version = '00'
    const traceFlags = '01'
    const traceparent = `${version}-${context.traceId}-${context.parentSpanId}-${traceFlags}`

    const headers: any = {
      [TRACEPARENT_HEADER]: traceparent,
    }

    if (context.baggage && Object.keys(context.baggage).length > 0) {
      headers[BAGGAGE_HEADER] = Object.entries(context.baggage)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join(',')
    }

    headers[TRACESTATE_HEADER] = `service=${encodeURIComponent(context.serviceName)},op=${encodeURIComponent(context.operationName)}`

    return headers
  }

  extract(headers: Record<string, string | string[] | undefined>): TraceContext | null {
    const traceparent = this.getHeader(headers, TRACEPARENT_HEADER)
    if (!traceparent) return null

    const parts = traceparent.split('-')
    if (parts.length < 4) return null

    const tracestate = this.getHeader(headers, TRACESTATE_HEADER)
    const baggage = this.extractBaggage(this.getHeader(headers, BAGGAGE_HEADER))

    let serviceName = this.serviceName
    let operationName = 'unknown'
    if (tracestate) {
      for (const entry of tracestate.split(',')) {
        const [k, v] = entry.split('=')
        if (k === 'service') serviceName = decodeURIComponent(v)
        if (k === 'op') operationName = decodeURIComponent(v)
      }
    }

    return {
      traceId: parts[1],
      parentSpanId: parts[2],
      serviceName,
      operationName,
      baggage,
    }
  }

  private getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
    const val = headers[name] || headers[name.toLowerCase()]
    if (Array.isArray(val)) return val[0]
    return val
  }

  private extractBaggage(header: string | undefined): Record<string, string> | undefined {
    if (!header) return undefined
    const baggage: Record<string, string> = {}
    for (const entry of header.split(',')) {
      const [k, v] = entry.split('=')
      if (k && v) baggage[decodeURIComponent(k.trim())] = decodeURIComponent(v.trim())
    }
    return Object.keys(baggage).length > 0 ? baggage : undefined
  }

  async persistTraceContext(context: TraceContext): Promise<void> {
    const key = `${this.prefix}ctx:${context.traceId}`
    await this.client.setex(key, 3600, JSON.stringify(context))
  }

  async getTraceContext(traceId: string): Promise<TraceContext | null> {
    const raw = await this.client.get(`${this.prefix}ctx:${traceId}`)
    return raw ? JSON.parse(raw) : null
  }

  continuationHeaders(context: TraceContext, nextService: string, nextOperation: string): Record<string, string> {
    const childSpanId = randomUUID().replace(/-/g, '').slice(0, 16)
    const continued: TraceContext = {
      ...context,
      parentSpanId: childSpanId,
      serviceName: nextService,
      operationName: nextOperation,
    }
    return this.inject(continued) as Record<string, string>
  }

  injectIntoMessage(context: TraceContext, message: Record<string, unknown>): Record<string, unknown> {
    return {
      ...message,
      _traceContext: {
        traceId: context.traceId,
        parentSpanId: context.parentSpanId,
        serviceName: context.serviceName,
        operationName: context.operationName,
        baggage: context.baggage,
      },
    }
  }

  extractFromMessage(message: Record<string, unknown>): TraceContext | null {
    const ctx = message._traceContext as TraceContext | undefined
    if (!ctx) return null
    const { traceId, parentSpanId, serviceName, operationName, baggage } = ctx
    if (!traceId || !parentSpanId) return null
    return { traceId, parentSpanId, serviceName: serviceName || this.serviceName, operationName: operationName || 'unknown', baggage }
  }

  createNewContext(operationName: string): TraceContext {
    return {
      traceId: randomUUID().replace(/-/g, ''),
      parentSpanId: randomUUID().replace(/-/g, '').slice(0, 16),
      serviceName: this.serviceName,
      operationName,
    }
  }
}

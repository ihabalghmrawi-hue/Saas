import { TracePropagator, TRACEPARENT_HEADER, TRACESTATE_HEADER, BAGGAGE_HEADER } from '@/lib/redis/trace-propagator'
import { startSpan, endSpan } from '@/lib/observability/tracer'
import type { RedisClient } from '@/lib/redis/client'

export interface RequestContext {
  traceId: string
  spanId: string
  serviceName: string
  operationName: string
  baggage?: Record<string, string>
}

const contexts = new Map<string, RequestContext>()

let propagator: TracePropagator | null = null

export function initTraceMiddleware(client: RedisClient, serviceName?: string): void {
  propagator = new TracePropagator(client, { serviceName: serviceName || 'finance-api' })
}

export function extractRequestContext(headers: Record<string, string | string[] | undefined>): RequestContext {
  if (!propagator) {
    return { traceId: 'unknown', spanId: 'unknown', serviceName: 'finance-api', operationName: 'request' }
  }

  const traceContext = propagator.extract(headers)
  if (traceContext) {
    propagator.persistTraceContext(traceContext).catch(() => {})
    const span = startSpan(traceContext.serviceName, traceContext.operationName)
    const ctx: RequestContext = {
      traceId: traceContext.traceId,
      spanId: span.spanId,
      serviceName: traceContext.serviceName,
      operationName: traceContext.operationName,
      baggage: traceContext.baggage,
    }
    contexts.set(ctx.spanId, ctx)
    return ctx
  }

  const newCtx = propagator.createNewContext('request')
  const span = startSpan(newCtx.serviceName, newCtx.operationName)
  const ctx: RequestContext = {
    traceId: newCtx.traceId,
    spanId: span.spanId,
    serviceName: newCtx.serviceName,
    operationName: newCtx.operationName,
  }
  contexts.set(ctx.spanId, ctx)
  return ctx
}

export function finalizeContext(spanId: string, status?: string): void {
  endSpan(spanId, (status as any) || 'ok')
  contexts.delete(spanId)
}

export function getContext(spanId: string): RequestContext | undefined {
  return contexts.get(spanId)
}

export function responseHeaders(ctx: RequestContext): Record<string, string> {
  if (!propagator) return {}
  return propagator.inject({
    traceId: ctx.traceId,
    parentSpanId: ctx.spanId,
    serviceName: ctx.serviceName,
    operationName: ctx.operationName,
    baggage: ctx.baggage,
  }) as Record<string, string>
}

export { TRACEPARENT_HEADER, TRACESTATE_HEADER, BAGGAGE_HEADER }

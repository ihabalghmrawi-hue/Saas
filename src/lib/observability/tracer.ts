import { randomUUID } from 'crypto'
import { getCorrelationId, setCorrelationId } from './correlation'

export type SpanStatus = 'ok' | 'error' | 'warning'

export interface Span {
  spanId: string
  traceId: string
  parentSpanId: string | null
  serviceName: string
  operationName: string
  startTime: number
  endTime: number | null
  duration: number | null
  status: SpanStatus
  attributes: Record<string, unknown>
  events: TraceEvent[]
}

export interface TraceEvent {
  name: string
  timestamp: number
  attributes: Record<string, unknown>
}

let spans = new Map<string, Span>()
let currentTraceId: string | null = null

export function configureTracerStores(stores: { spans?: Map<string, Span> }): void {
  if (stores.spans) spans = stores.spans
}

export function startSpan(serviceName: string, operationName: string, attributes?: Record<string, unknown>): Span {
  const traceId = currentTraceId || getCorrelationId()
  currentTraceId = traceId
  setCorrelationId(traceId)

  const span: Span = {
    spanId: randomUUID(),
    traceId,
    parentSpanId: null,
    serviceName,
    operationName,
    startTime: Date.now(),
    endTime: null,
    duration: null,
    status: 'ok',
    attributes: attributes || {},
    events: [],
  }

  spans.set(span.spanId, span)
  return span
}

export function startChildSpan(parent: Span, operationName: string, attributes?: Record<string, unknown>): Span {
  const span: Span = {
    spanId: randomUUID(),
    traceId: parent.traceId,
    parentSpanId: parent.spanId,
    serviceName: parent.serviceName,
    operationName,
    startTime: Date.now(),
    endTime: null,
    duration: null,
    status: 'ok',
    attributes: attributes || {},
    events: [],
  }

  spans.set(span.spanId, span)
  return span
}

export function endSpan(spanId: string, status: SpanStatus = 'ok'): Span | undefined {
  const span = spans.get(spanId)
  if (!span) return undefined

  span.endTime = Date.now()
  span.duration = span.endTime - span.startTime
  span.status = status
  return span
}

export function addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
  const span = spans.get(spanId)
  if (!span) return

  span.events.push({ name, timestamp: Date.now(), attributes: attributes || {} })
}

export function setSpanAttribute(spanId: string, key: string, value: unknown): void {
  const span = spans.get(spanId)
  if (!span) return
  span.attributes[key] = value
}

export function getSpan(spanId: string): Span | undefined {
  return spans.get(spanId)
}

export function getTrace(traceId: string): Span[] {
  return Array.from(spans.values()).filter(s => s.traceId === traceId)
}

export function getCurrentTraceId(): string | null {
  return currentTraceId
}

export function clearSpans(): void {
  spans.clear()
}

export function getActiveSpanCount(): number {
  return spans.size
}

export function exportTrace(traceId: string): object {
  const traceSpans = getTrace(traceId)
  return {
    traceId,
    spanCount: traceSpans.length,
    spans: traceSpans.map(s => ({
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      serviceName: s.serviceName,
      operationName: s.operationName,
      startTime: new Date(s.startTime).toISOString(),
      duration: s.duration,
      status: s.status,
      attributes: s.attributes,
      events: s.events.map(e => ({
        name: e.name,
        timestamp: new Date(e.timestamp).toISOString(),
        attributes: e.attributes,
      })),
    })),
  }
}

export async function traceAsync<T>(
  serviceName: string,
  operationName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>,
): Promise<T> {
  const span = startSpan(serviceName, operationName, attributes)
  try {
    const result = await fn(span)
    endSpan(span.spanId, 'ok')
    return result
  } catch (error) {
    addSpanEvent(span.spanId, 'error', { error: error instanceof Error ? error.message : String(error) })
    endSpan(span.spanId, 'error')
    throw error
  }
}

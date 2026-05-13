import { randomUUID } from 'crypto'

const CORRELATION_HEADER = 'x-correlation-id'
const CAUSATION_HEADER = 'x-causation-id'

const asyncLocalStorage = new Map<string, string>()

const store = new Map<string, string>()

export function generateCorrelationId(): string {
  return randomUUID()
}

export function setCorrelationId(id?: string): string {
  const cid = id || generateCorrelationId()
  store.set('correlationId', cid)
  return cid
}

export function getCorrelationId(): string {
  return store.get('correlationId') || generateCorrelationId()
}

export function setCausationId(id?: string): string {
  const cid = id || generateCorrelationId()
  store.set('causationId', cid)
  return cid
}

export function getCausationId(): string {
  return store.get('causationId') || ''
}

export interface TraceContext {
  correlationId: string
  causationId?: string
  spanId: string
  parentSpanId?: string
  service: string
  startTime: number
}

const traceStore = new Map<string, TraceContext>()

export function startTrace(service: string, parentContext?: Partial<TraceContext>): TraceContext {
  const trace: TraceContext = {
    correlationId: parentContext?.correlationId || getCorrelationId(),
    causationId: parentContext?.causationId || getCausationId(),
    spanId: generateCorrelationId(),
    parentSpanId: parentContext?.spanId,
    service,
    startTime: Date.now(),
  }
  traceStore.set(trace.spanId, trace)
  return trace
}

export function endTrace(spanId: string): { trace: TraceContext; duration: number } {
  const trace = traceStore.get(spanId)
  if (!trace) throw new Error(`Trace not found: ${spanId}`)
  traceStore.delete(spanId)
  return { trace, duration: Date.now() - trace.startTime }
}

export function getTrace(spanId: string): TraceContext | undefined {
  return traceStore.get(spanId)
}

export function correlationHeaders(context?: Partial<TraceContext>): Record<string, string> {
  return {
    [CORRELATION_HEADER]: context?.correlationId || getCorrelationId(),
    [CAUSATION_HEADER]: context?.spanId || getCausationId(),
  }
}

export function extractCorrelationContext(headers: Record<string, string | string[] | undefined>): Partial<TraceContext> {
  const correlationId = extractHeader(headers, CORRELATION_HEADER)
  const causationId = extractHeader(headers, CAUSATION_HEADER)
  return {
    correlationId: correlationId || generateCorrelationId(),
    causationId: causationId || undefined,
  }
}

function extractHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name]
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
}

export function createTraceLogger(service: string, context?: Partial<TraceContext>) {
  const trace = context?.spanId ? getTrace(context.spanId) : undefined
  const cid = context?.correlationId || getCorrelationId()

  return {
    info: (msg: string, data?: unknown) => {
      console.log(JSON.stringify({ level: 'info', service, correlationId: cid, spanId: trace?.spanId, msg, data, timestamp: new Date().toISOString() }))
    },
    warn: (msg: string, data?: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', service, correlationId: cid, spanId: trace?.spanId, msg, data, timestamp: new Date().toISOString() }))
    },
    error: (msg: string, error?: unknown, data?: unknown) => {
      console.error(JSON.stringify({ level: 'error', service, correlationId: cid, spanId: trace?.spanId, msg, error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error, data, timestamp: new Date().toISOString() }))
    },
    debug: (msg: string, data?: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(JSON.stringify({ level: 'debug', service, correlationId: cid, spanId: trace?.spanId, msg, data, timestamp: new Date().toISOString() }))
      }
    },
    getTraceId: () => cid,
    getSpanId: () => trace?.spanId,
  }
}
